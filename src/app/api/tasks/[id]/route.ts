import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
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
	status: z.enum(["TODO", "IN_PROGRESS", "DONE", "ARCHIVED", "CLIENT_TO_REVERT", "OTHERS"]).optional(),
	priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
	startAt: z.string().optional(),
	dueAt: z.string().optional(),
	customerId: z.string().optional(),
	assigneeId: z.string().optional(),
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

		// Handle paymentStatus via customFields
		if (validatedData.customFields?.paymentStatus) {
			validatedData.customFields = {
				...validatedData.customFields,
				paymentStatus: validatedData.customFields.paymentStatus,
			};
		}

		const task = await prisma.task.update({
			where: { id },
			data: validatedData,
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
