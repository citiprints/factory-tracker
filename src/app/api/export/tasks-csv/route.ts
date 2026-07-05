import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

function toCsvValue(value: unknown): string {
	if (value == null) return "";
	const s = String(value);
	if (s.includes(",") || s.includes("\n") || s.includes('"')) {
		return '"' + s.replace(/"/g, '""') + '"';
	}
	return s;
}

export async function GET() {
	const user = await getCurrentUser();
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const tasks = await prisma.task.findMany({ orderBy: { createdAt: "desc" } });
	const headers = [
		"id","title","description","status","priority","startAt","dueAt","estimatedHours","actualHours","customer","jobNumber","customFields","createdAt","updatedAt"
	];
	const rows = tasks.map(t => [
		t.id,
		t.title,
		t.description,
		t.status,
		t.priority,
		t.startAt?.toISOString() ?? "",
		t.dueAt?.toISOString() ?? "",
		t.estimatedHours ?? "",
		t.actualHours ?? "",
		t.customer ?? "",
		t.jobNumber ?? "",
		t.customFields ?? "",
		t.createdAt.toISOString(),
		t.updatedAt.toISOString()
	]);
	const csv = [headers.map(toCsvValue).join(","), ...rows.map(r => r.map(toCsvValue).join(","))].join("\n");

	return new NextResponse(csv, {
		status: 200,
		headers: {
			"Content-Type": "text/csv; charset=utf-8",
			"Content-Disposition": `attachment; filename="tasks-export.csv"`
		}
	});
}
