import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, isAdmin } from "@/lib/session";
import { notifyUser } from "@/lib/notify";
import { z } from "zod";

const AddMemberSchema = z.object({
	userId: z.string().min(1),
});

// Joining a team grants access to every task already assigned to that
// team, the same way joining an assignee list would — materialize an
// Assignment row (tagged viaTeamId) for each of the team's current tasks.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const user = await getCurrentUser();
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	if (!isAdmin(user)) return NextResponse.json({ error: "Only admins/managers can manage team members." }, { status: 403 });

	const { id: teamId } = await params;
	const parsed = AddMemberSchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) return NextResponse.json({ error: "Missing userId." }, { status: 400 });
	const { userId } = parsed.data;

	const team = await prisma.team.findUnique({ where: { id: teamId } });
	if (!team) return NextResponse.json({ error: "Team not found." }, { status: 404 });

	try {
		await prisma.teamMember.create({ data: { teamId, userId } });
	} catch (err: any) {
		if (err?.code === "P2002") {
			return NextResponse.json({ error: "That person is already on this team." }, { status: 409 });
		}
		throw err;
	}

	const taskAssignments = await prisma.taskTeamAssignment.findMany({
		where: { teamId },
		include: { task: { select: { id: true, title: true } } },
	});

	for (const ta of taskAssignments) {
		const existing = await prisma.assignment.findFirst({ where: { taskId: ta.taskId, userId } });
		if (existing) continue;
		await prisma.assignment.create({ data: { taskId: ta.taskId, userId, viaTeamId: teamId } });
		await notifyUser({
			userId,
			title: "New task assigned",
			body: `${ta.task.title} (via ${team.name})`,
			type: "TASK_ASSIGNED",
			linkPath: `/tasks?open=${ta.taskId}`,
		}).catch(() => {});
	}

	const updated = await prisma.team.findUnique({
		where: { id: teamId },
		include: { members: { include: { user: { select: { id: true, name: true } } } } },
	});
	return NextResponse.json({ team: updated }, { status: 201 });
}
