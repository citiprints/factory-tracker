import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, isAdmin } from "@/lib/session";
import { z } from "zod";

const UpdateTeamSchema = z.object({
	name: z.string().min(1).max(60).optional(),
	order: z.number().int().optional(),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const user = await getCurrentUser();
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	if (!isAdmin(user)) return NextResponse.json({ error: "Only admins/managers can edit teams." }, { status: 403 });

	const { id } = await params;
	const parsed = UpdateTeamSchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

	try {
		const team = await prisma.team.update({
			where: { id },
			data: parsed.data,
			include: { members: { include: { user: { select: { id: true, name: true } } } } },
		});
		return NextResponse.json({ team });
	} catch (err: any) {
		if (err?.code === "P2002") {
			return NextResponse.json({ error: "A team with that name already exists." }, { status: 409 });
		}
		return NextResponse.json({ error: "Couldn't update the team." }, { status: 500 });
	}
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const user = await getCurrentUser();
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	if (!isAdmin(user)) return NextResponse.json({ error: "Only admins/managers can delete teams." }, { status: 403 });

	const { id } = await params;
	// Clean up everything this team materialized before removing it —
	// team members cascade automatically, but the Assignment rows this
	// team's task-assignments created, and the task-assignments themselves,
	// don't have DB-level cascade and would otherwise block the delete.
	await prisma.$transaction([
		prisma.assignment.deleteMany({ where: { viaTeamId: id } }),
		prisma.taskTeamAssignment.deleteMany({ where: { teamId: id } }),
		prisma.team.delete({ where: { id } }),
	]);
	return NextResponse.json({ ok: true });
}
