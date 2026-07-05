import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { notifyUser } from "@/lib/notify";
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
		whereClause.customFields = {
			not: {
				contains: '"isQuotation":true'
			}
		};
	}
	
	const tasks = await prisma.task.findMany({
		where: whereClause,
		orderBy: { createdAt: "desc" },
		take: limit,
		skip: offset,
		include: { 
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
	
	return NextResponse.json({ 
		tasks,
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

		// Create assignment if assigneeId is provided
		if (data.assigneeId) {
			await prisma.assignment.create({
				data: {
					taskId: task.id,
					userId: data.assigneeId,
					role: "assignee"
				}
			});

			await notifyUser({
				userId: data.assigneeId,
				title: "New task assigned",
				body: task.title,
				type: "TASK_ASSIGNED",
				linkPath: `/tasks/${task.id}`,
			});
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
