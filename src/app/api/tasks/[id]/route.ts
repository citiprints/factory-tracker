import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, isAdmin } from "@/lib/session";
import { notifyUser } from "@/lib/notify";
import { TASK_STATUSES, TASK_PRIORITIES } from "@/lib/constants";
import { z } from "zod";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";

const R2_ENDPOINT = process.env.R2_ENDPOINT!;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID!;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY!;
const R2_BUCKET = process.env.R2_BUCKET!;

const s3Client = new S3Client({
	region: "auto",
	endpoint: R2_ENDPOINT,
	credentials: {
		accessKeyId: R2_ACCESS_KEY_ID,
		secretAccessKey: R2_SECRET_ACCESS_KEY,
	},
});

const UpdateTaskSchema = z.object({
	title: z.string().min(1).optional(),
	description: z.string().optional(),
	status: z.enum(TASK_STATUSES).optional(),
	priority: z.enum(TASK_PRIORITIES).optional(),
	startAt: z.string().optional(),
	dueAt: z.string().optional(),
	customerId: z.string().optional(),
	assigneeId: z.string().optional(),
	assigneeIds: z.array(z.string()).optional(),
	customFields: z.any().optional(),
});

export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const { id } = await params;
		const user = await getCurrentUser();
		if (!user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const task = await prisma.task.findUnique({
			where: { id },
			include: {
				customerRef: true,
				assignments: {
					include: {
						user: true,
					},
				},
				subtasks: true,
			},
		});

		if (!task) {
			return NextResponse.json({ error: "Task not found" }, { status: 404 });
		}

		return NextResponse.json({ task });
	} catch (error) {
		console.error("Error fetching task:", error);
		return NextResponse.json({ error: "Failed to fetch task" }, { status: 500 });
	}
}

export async function PATCH(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const { id } = await params;
		const user = await getCurrentUser();
		if (!user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const body = await request.json();
		const validatedData = UpdateTaskSchema.parse(body);

		const admin = isAdmin(user);

		if (!admin) {
			// Workers may only update the status of a task they're assigned to.
			// Everything else (reassigning, editing dates/priority/customer,
			// deleting) is an admin/manager-only action.
			const existing = await prisma.task.findUnique({
				where: { id },
				include: { assignments: { select: { userId: true } } },
			});
			if (!existing) {
				return NextResponse.json({ error: "Task not found" }, { status: 404 });
			}
			const isAssignee = existing.assignments.some((a) => a.userId === user.id);
			if (!isAssignee) {
				return NextResponse.json(
					{ error: "You can only update tasks assigned to you." },
					{ status: 403 }
				);
			}
			const attemptedExtraFields = Object.keys(validatedData).filter((k) => k !== "status");
			if (attemptedExtraFields.length > 0) {
				return NextResponse.json(
					{ error: "You can only change the status of this task." },
					{ status: 403 }
				);
			}
		}

		// Handle paymentStatus via customFields
		if (validatedData.customFields?.paymentStatus) {
			validatedData.customFields = {
				...validatedData.customFields,
				paymentStatus: validatedData.customFields.paymentStatus,
			};
		}

		const { assigneeId, assigneeIds, ...taskFields } = validatedData;
		const nextAssigneeIds =
			assigneeIds !== undefined
				? Array.from(new Set(assigneeIds))
				: assigneeId !== undefined
				? assigneeId
					? [assigneeId]
					: []
				: undefined; // undefined = don't touch assignments at all

		let newlyAdded: string[] = [];
		if (nextAssigneeIds !== undefined) {
			const current = await prisma.assignment.findMany({
				where: { taskId: id },
				select: { userId: true },
			});
			const currentIds = new Set<string>(current.map((a) => a.userId));
			const nextIds = new Set<string>(nextAssigneeIds);

			const toRemove: string[] = [...currentIds].filter((uid) => !nextIds.has(uid));
			newlyAdded = [...nextIds].filter((uid) => !currentIds.has(uid));

			if (toRemove.length > 0) {
				await prisma.assignment.deleteMany({ where: { taskId: id, userId: { in: toRemove } } });
			}
			if (newlyAdded.length > 0) {
				await prisma.assignment.createMany({
					data: newlyAdded.map((uid) => ({ taskId: id, userId: uid, role: "assignee" })),
				});
			}
		}

		const task = await prisma.task.update({
			where: { id },
			data: taskFields,
			include: {
				customerRef: true,
				assignments: {
					include: {
						user: true,
					},
				},
				subtasks: true,
			},
		});

		// Only the people who are genuinely new to this task get pinged —
		// re-saving a task with the same assignees shouldn't re-notify them.
		for (const uid of newlyAdded) {
			await notifyUser({
				userId: uid,
				title: "Assigned to a task",
				body: task.title,
				type: "TASK_ASSIGNED",
				linkPath: `/tasks?open=${task.id}`,
			}).catch(() => {});
		}

		return NextResponse.json({ task });
	} catch (error) {
		console.error("Error updating task:", error);
		return NextResponse.json({ error: "Failed to update task" }, { status: 500 });
	}
}

export async function DELETE(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const { id } = await params;
		const user = await getCurrentUser();
		if (!user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}
		if (!isAdmin(user)) {
			return NextResponse.json(
				{ error: "Only admins/managers can delete tasks." },
				{ status: 403 }
			);
		}

		// Get the task to find associated files
		const task = await prisma.task.findUnique({
			where: { id },
		});

		if (!task) {
			return NextResponse.json({ error: "Task not found" }, { status: 404 });
		}

		// Parse customFields to get attachments
		let attachments: string[] = [];
		try {
			if (task.customFields) {
				const customFields = typeof task.customFields === "string" 
					? JSON.parse(task.customFields) 
					: task.customFields;
				attachments = customFields.attachments || [];
			}
		} catch (error) {
			console.error("Error parsing customFields:", error);
		}

		// Delete associated files from R2 (don't let this block task deletion)
		if (attachments.length > 0) {
			const deletePromises = attachments.map(async (attachmentUrl) => {
				try {
					// Extract the filename from the URL (URL format: /api/files/filename)
					const urlParts = attachmentUrl.split('/');
					const filename = urlParts[urlParts.length - 1];
					const key = decodeURIComponent(filename);
					
					console.log(`Deleting R2 file: ${key} from URL: ${attachmentUrl}`);
					
					const deleteCommand = new DeleteObjectCommand({
						Bucket: R2_BUCKET,
						Key: key,
					});
					await s3Client.send(deleteCommand);
					console.log(`Successfully deleted R2 file: ${key}`);
				} catch (error) {
					console.error(`Failed to delete file ${attachmentUrl}:`, error);
					// Don't throw - continue with task deletion even if file deletion fails
				}
			});

			// Wait for file deletions but don't fail if they don't succeed
			await Promise.allSettled(deletePromises);
		}

		// Delete all related records first (due to foreign key constraints)
		await prisma.$transaction([
			// Notifications aren't linked by a real foreign key (linkPath is a
			// free-form string like "/tasks?open=<id>"), so match on that —
			// otherwise a deleted task's notifications sit around forever,
			// pointing at a task that no longer exists.
			prisma.notification.deleteMany({
				where: { linkPath: { contains: id } }
			}),
			// Delete subtasks first (they might have attachments)
			prisma.subtask.deleteMany({
				where: { taskId: id }
			}),
			// Delete assignments
			prisma.assignment.deleteMany({
				where: { taskId: id }
			}),
			// Delete comments
			prisma.comment.deleteMany({
				where: { taskId: id }
			}),
			// Delete attachments
			prisma.attachment.deleteMany({
				where: { taskId: id }
			}),
			// Delete activity logs
			prisma.activityLog.deleteMany({
				where: { taskId: id }
			}),
			// Finally delete the task
			prisma.task.delete({
				where: { id }
			})
		]);

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("Error deleting task:", error);
		return NextResponse.json({ error: "Failed to delete task" }, { status: 500 });
	}
}
