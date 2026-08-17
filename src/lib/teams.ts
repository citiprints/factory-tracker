import { prisma } from "@/lib/db";
import { notifyUser } from "@/lib/notify";

// Assigns a team to a task: records the TaskTeamAssignment, then
// materializes an Assignment row (tagged viaTeamId) for every current
// member so every existing per-user access check keeps working unchanged.
export async function assignTeamToTask(taskId: string, teamId: string, taskTitle: string) {
	const team = await prisma.team.findUnique({
		where: { id: teamId },
		include: { members: true },
	});
	if (!team) return;

	await prisma.taskTeamAssignment.upsert({
		where: { taskId_teamId: { taskId, teamId } },
		update: {},
		create: { taskId, teamId },
	});

	for (const member of team.members) {
		const existing = await prisma.assignment.findFirst({ where: { taskId, userId: member.userId } });
		if (existing) continue;
		await prisma.assignment.create({ data: { taskId, userId: member.userId, viaTeamId: teamId } });
		await notifyUser({
			userId: member.userId,
			title: "New task assigned",
			body: `${taskTitle} (via ${team.name})`,
			type: "TASK_ASSIGNED",
			linkPath: `/tasks?open=${taskId}`,
		}).catch(() => {});
	}
}

// Removes a team from a task: drops the TaskTeamAssignment and every
// Assignment row it materialized. Assignment rows the same user holds
// directly (viaTeamId null) are untouched.
export async function unassignTeamFromTask(taskId: string, teamId: string) {
	await prisma.$transaction([
		prisma.assignment.deleteMany({ where: { taskId, viaTeamId: teamId } }),
		prisma.taskTeamAssignment.deleteMany({ where: { taskId, teamId } }),
	]);
}
