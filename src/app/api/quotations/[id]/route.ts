import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/db";
import { z } from "zod";

const UpdateQuotationSchema = z.object({
	title: z.string().min(1),
	description: z.string().optional(),
	status: z.enum(["TODO","IN_PROGRESS","BLOCKED","DONE","CANCELLED","ARCHIVED","CLIENT_TO_REVERT"]).optional(),
	priority: z.enum(["LOW","MEDIUM","HIGH","URGENT"]).optional(),
	customerId: z.string().optional(),
	customFields: z.any().optional(),
	assigneeId: z.string().optional(),
});

const ConvertToTaskSchema = z.object({
	startAt: z.string().min(1),
	dueAt: z.string().min(1),
});

export async function PATCH(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const user = await getCurrentUser();
		if (!user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const { id } = await params;
		const json = await request.json();
		const data = UpdateQuotationSchema.parse(json);

		// Get the existing task to verify it's a quotation
		const existingTask = await prisma.task.findUnique({
			where: { id }
		});

		if (!existingTask) {
			return NextResponse.json({ error: "Quotation not found" }, { status: 404 });
		}

		// Parse customFields to check if it's a quotation
		const customFields = typeof existingTask.customFields === "string" 
			? JSON.parse(existingTask.customFields) 
			: existingTask.customFields || {};
		
		if (!customFields.isQuotation) {
			return NextResponse.json({ error: "Task is not a quotation" }, { status: 400 });
		}

		// Update the task
		const updatedTask = await prisma.task.update({
			where: { id },
			data: {
				title: data.title,
				description: data.description ?? "",
				status: data.status ?? existingTask.status,
				priority: data.priority ?? existingTask.priority,
				customerId: data.customerId || null,
				customFields: data.customFields ? JSON.stringify(data.customFields) : existingTask.customFields,
			},
			include: {
				customerRef: true,
				assignments: {
					include: {
						user: true
					}
				}
			}
		});

		// Update assignment if assigneeId is provided
		if (data.assigneeId) {
			// Remove existing assignments
			await prisma.assignment.deleteMany({
				where: { taskId: id }
			});

			// Create new assignment
			await prisma.assignment.create({
				data: {
					taskId: id,
					userId: data.assigneeId,
					role: "assignee"
				}
			});
		}

		return NextResponse.json({ quotation: updatedTask });
	} catch (error) {
		console.error("Failed to update quotation:", error);
		
		if (error instanceof z.ZodError) {
			const errors = error.flatten();
			const errorMessage = Object.values(errors.fieldErrors).flat().join(", ") || "Invalid input";
			return NextResponse.json({ error: errorMessage }, { status: 400 });
		}
		
		return NextResponse.json({ error: "Failed to update quotation" }, { status: 500 });
	}
}

export async function DELETE(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const user = await getCurrentUser();
		if (!user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const { id } = await params;

		// Get the existing task to verify it's a quotation
		const existingTask = await prisma.task.findUnique({
			where: { id }
		});

		if (!existingTask) {
			return NextResponse.json({ error: "Quotation not found" }, { status: 404 });
		}

		// Parse customFields to check if it's a quotation
		const customFields = typeof existingTask.customFields === "string" 
			? JSON.parse(existingTask.customFields) 
			: existingTask.customFields || {};
		
		if (!customFields.isQuotation) {
			return NextResponse.json({ error: "Task is not a quotation" }, { status: 400 });
		}

		// Delete the quotation
		await prisma.task.delete({
			where: { id }
		});

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("Failed to delete quotation:", error);
		return NextResponse.json({ error: "Failed to delete quotation" }, { status: 500 });
	}
}

export async function POST(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const user = await getCurrentUser();
		if (!user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const { id } = await params;
		const json = await request.json();
		const data = ConvertToTaskSchema.parse(json);

		// Get the existing task to verify it's a quotation
		const existingTask = await prisma.task.findUnique({
			where: { id }
		});

		if (!existingTask) {
			return NextResponse.json({ error: "Quotation not found" }, { status: 404 });
		}

		// Parse customFields to check if it's a quotation
		const customFields = typeof existingTask.customFields === "string" 
			? JSON.parse(existingTask.customFields) 
			: existingTask.customFields || {};
		
		if (!customFields.isQuotation) {
			return NextResponse.json({ error: "Task is not a quotation" }, { status: 400 });
		}

		// Convert quotation to task by removing isQuotation flag and adding dates
		const updatedCustomFields = { ...customFields };
		delete updatedCustomFields.isQuotation;

		const convertedTask = await prisma.task.update({
			where: { id },
			data: {
				startAt: new Date(data.startAt),
				dueAt: new Date(data.dueAt),
				customFields: JSON.stringify(updatedCustomFields),
			},
			include: {
				customerRef: true,
				assignments: {
					include: {
						user: true
					}
				}
			}
		});

		return NextResponse.json({ task: convertedTask });
	} catch (error) {
		console.error("Failed to convert quotation to task:", error);
		
		if (error instanceof z.ZodError) {
			const errors = error.flatten();
			const errorMessage = Object.values(errors.fieldErrors).flat().join(", ") || "Invalid input";
			return NextResponse.json({ error: errorMessage }, { status: 400 });
		}
		
		return NextResponse.json({ error: "Failed to convert quotation to task" }, { status: 500 });
	}
}
