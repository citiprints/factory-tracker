import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, isAdmin } from "@/lib/session";

// Leaving a team revokes only the access that team granted — Assignment
// rows this user holds directly (viaTeamId null) are left untouched.
export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string; userId: string }> }) {
	const user = await getCurrentUser();
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	if (!isAdmin(user)) return NextResponse.json({ error: "Only admins/managers can manage team members." }, { status: 403 });

	const { id: teamId, userId } = await params;

	await prisma.$transaction([
		prisma.assignment.deleteMany({ where: { userId, viaTeamId: teamId } }),
		prisma.teamMember.deleteMany({ where: { teamId, userId } }),
	]);

	return NextResponse.json({ ok: true });
}
