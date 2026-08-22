import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { notifyUser } from "@/lib/notify";
import { logActivity } from "@/lib/audit";
import { assignTeamToTask } from "@/lib/teams";
import { canAccessPayments } from "@/lib/payments";
import { TASK_STATUSES, TASK_PRIORITIES } from "@/lib/constants";
import { z } from "zod";

const CreateTaskSchema = z.object({
	title: z.string().min(1),
	description: z.string().optional(),
	status: z.enum(TASK_STATUSES).optional(),
	priority: z.enum(TASK_PRIORITIES).optional(),
	startAt: z.string().nullable().optional(),
	dueAt: z.string().nullable().optional(),
	estimatedHours: z.number().optional(),
	customer: z.string().optional(),
	customerId: z.string().optional(),
	jobNumber: z.string().optional(),
	customFields: z.any().optional(),
	assigneeId: z.string().optional(),
	assigneeIds: z.array(z.string()).optional(),
	teamIds: z.array(z.string()).optional(),
});

export async function GET(request: NextRequest) {
	const user = await getCurrentUser();
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	
	const { searchParams } = new URL(request.url);
	const limit = parseInt(searchParams.get('limit') || '50');
	const offset = parseInt(searchParams.get('offset') || '0');
	const includeArchived = searchParams.get('includeArchived') === 'true';
	const includeQuotations = searchParams.get('includeQuotations') === 'true';
	
	// Build where clause for filtering
	const whereClause: any = {};
	
	if (!includeArchived) {
		whereClause.status = { not: "ARCHIVED" };
	}
	
	if (!includeQuotations) {
		// `customFields: { not: { contains: ... } }` alone drops rows where
		// customFields is NULL entirely -- SQL's three-valued logic makes
		// `NOT (NULL LIKE ...)` evaluate to NULL, which WHERE treats as
		// false, silently hiding any task with no customFields set (e.g.
		// one created directly via the API without that field). Explicitly
		// allow NULL through instead of just excluding the quotation match.
		whereClause.OR = [
			{ customFields: null },
			{ customFields: { not: { contains: '"isQuotation":true' } } },
		];
	}
	
	const tasks = await prisma.task.findMany({
		where: whereClause,
		orderBy: { createdAt: "desc" },
		take: limit,
		skip: offset,
		include: { 
			createdBy: { select: { id: true, name: true } },
			assignments: { 
				include: { user: { select: { id: true, name: true } } } 
			}, 
			subtasks: {
				select: {
					id: true,
					title: true,
					status: true,
					assigneeId: true,
					dueAt: true,
					order: true
				}
			},
			despatchItems: {
				orderBy: { order: "asc" },
				include: { stageProgress: { orderBy: { order: "asc" } } },
			},
			// Lightweight only — just enough for a quick status badge on the
			// list without a per-task fetch. Full details still come from the
			// dedicated onboarding-form endpoint when someone expands it.
			onboardingForms: {
				where: { status: { not: "REVOKED" } },
				orderBy: { createdAt: "desc" },
				take: 1,
				select: { status: true }
			},
			teamAssignments: {
				include: { team: { select: { id: true, name: true } } }
			},
			customerRef: {
				select: {
					id: true,
					name: true,
					email: true
				}
			} 
		}
	});
	
	// Get total count for pagination
	const totalCount = await prisma.task.count({
		where: whereClause
	});

	// totalAmount is financial data gated to admins/Accounts team — strip it
	// from the payload entirely for everyone else, rather than trusting the
	// UI alone to hide it (the raw response would otherwise leak it).
	const paymentAccess = await canAccessPayments(user);
	const visibleTasks = paymentAccess
		? tasks
		: tasks.map(({ totalAmount, ...rest }) => rest);

	// Cheap, eager per-request count of this user's unread comment
	// notifications, grouped by task — same pattern as onboardingStatus above.
	const unreadCounts = await prisma.notification.groupBy({
		by: ["taskId"],
		where: { userId: user.id, type: "COMMENT", readAt: null, taskId: { in: tasks.map((t) => t.id) } },
		_count: true,
	});
	const unreadByTask = new Map(unreadCounts.map((c) => [c.taskId, c._count]));
	const tasksWithCounts = visibleTasks.map((t) => ({
		...t,
		unreadCommentCount: unreadByTask.get(t.id) ?? 0,
	}));

	return NextResponse.json({
		tasks: tasksWithCounts,
		pagination: {
			total: totalCount,
			limit,
			offset,
			hasMore: offset + limit < totalCount
		}
	});
}

export async function POST(request: Request) {
	const user = await getCurrentUser();
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	
	try {
		const json = await request.json();
		const data = CreateTaskSchema.parse(json);

		const task = await prisma.task.create({
			data: {
				title: data.title,
				description: data.description ?? "",
				status: (data.status as any) ?? "TODO",
				priority: (data.priority as any) ?? "MEDIUM",
				startAt: data.startAt ? new Date(data.startAt) : null,
				dueAt: data.dueAt ? new Date(data.dueAt) : null,
				estimatedHours: data.estimatedHours ?? null,
				customer: data.customer,
				customerId: data.customerId,
				jobNumber: data.jobNumber,
				customFields: data.customFields ? JSON.stringify(data.customFields) : undefined,
				createdById: user.id
			}
		});

		await logActivity({
			entityType: "task",
			entityId: task.id,
			action: "CREATED",
			actorId: user.id,
			taskId: task.id,
			after: { title: task.title, status: task.status, priority: task.priority, customerId: task.customerId },
		});

		// Create assignments for everyone selected (assigneeIds takes priority;
		// assigneeId kept for any older callers still sending a single id).
		const assigneeIds = Array.from(
			new Set([...(data.assigneeIds ?? []), ...(data.assigneeId ? [data.assigneeId] : [])])
		);

		for (const uid of assigneeIds) {
			await prisma.assignment.create({
				data: { taskId: task.id, userId: uid, role: "assignee" },
			});

			await notifyUser({
				userId: uid,
				title: "New task assigned",
				body: task.title,
				type: "TASK_ASSIGNED",
				linkPath: `/tasks?open=${task.id}`,
			});
		}

		for (const teamId of data.teamIds ?? []) {
			await assignTeamToTask(task.id, teamId, task.title);
		}

		return NextResponse.json({ task }, { status: 201 });
	} catch (error) {
		console.error("/api/tasks POST error", error);
		
		if (error instanceof z.ZodError) {
			const errors = error.flatten();
			const errorMessage = Object.values(errors.fieldErrors).flat().join(", ") || "Invalid input";
			return NextResponse.json({ error: errorMessage }, { status: 400 });
		}
		
		const message = (error as any)?.message || "Internal Server Error";
		return NextResponse.json({ error: message }, { status: 500 });
	}
}
