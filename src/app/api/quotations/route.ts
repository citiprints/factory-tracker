import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/db";

export async function GET() {
	try {
		const user = await getCurrentUser();
		if (!user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const allTasks = await prisma.task.findMany({
			include: {
				customerRef: true,
				assignments: {
					include: {
						user: true
					}
				}
			},
			orderBy: {
				createdAt: "desc"
			}
		});

		// Filter for quotations in JavaScript
		const quotations = allTasks.filter(task => {
			try {
				const customFields = typeof task.customFields === "string" 
					? JSON.parse(task.customFields) 
					: task.customFields || {};
				return customFields.isQuotation === true;
			} catch {
				return false;
			}
		});

		return NextResponse.json({ quotations });
	} catch (error) {
		console.error("Failed to fetch quotations:", error);
		return NextResponse.json({ error: "Failed to fetch quotations" }, { status: 500 });
	}
}
