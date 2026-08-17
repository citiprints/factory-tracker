import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, isAdmin } from "@/lib/session";
import { notifyUser } from "@/lib/notify";
import { z } from "zod";

const CreateCommentSchema = z.object({
	body: z.string().min(1).max(4000),
});

async function canAccessTask(userId: string, taskId: string, admin: boolean) {
	if (admin) return true;
	const assignment = await prisma.assignment.findFirst({ where: { taskId, userId } });
	return !!assignment;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const user = await getCurrentUser();
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const { id } = await params;
	const admin = isAdmin(user);
	if (!(await canAccessTask(user.id, id, admin))) {
		return NextResponse.json({ error: "You don't have access to this task." }, { status: 403 });
	}

	const comments = await prisma.comment.findMany({
		where: { taskId: id },
		orderBy: { createdAt: "asc" },
		include: { author: { select: { id: true, name: true } } },
	});

	return NextResponse.json({ comments });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const user = await getCurrentUser();
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const { id } = await params;
	const admin = isAdmin(user);
	if (!(await canAccessTask(user.id, id, admin))) {
		return NextResponse.json({ error: "You don't have access to this task." }, { status: 403 });
	}

	const parsed = CreateCommentSchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) {
		return NextResponse.json({ error: "Comment can't be empty." }, { status: 400 });
	}

	const comment = await prisma.comment.create({
		data: { taskId: id, authorId: user.id, body: parsed.data.body },
		include: { author: { select: { id: true, name: true } } },
	});

	// Notify everyone else on the task (assignees + creator), not the author.
	const [assignments, taskRow, teams] = await Promise.all([
		prisma.assignment.findMany({ where: { taskId: id }, select: { userId: true, user: { select: { name: true } } } }),
		prisma.task.findUnique({ where: { id }, select: { createdById: true, createdBy: { select: { name: true } } } }),
		prisma.team.findMany({ include: { members: { select: { userId: true } } } }),
	]);
	const recipients = new Map<string, string>(assignments.map((a) => [a.userId, a.user.name]));
	if (taskRow?.createdById) recipients.set(taskRow.createdById, taskRow.createdBy?.name ?? "");
	recipients.delete(user.id);

	// Anyone whose name is @mentioned (and who already has access to this
	// task) gets a clearly different notification, so a tag actually reads
	// as "you were tagged" rather than blending into general chat noise.
	const mentionedNames = new Set(
		[...recipients.values()].filter((name) => name && new RegExp(`@${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(parsed.data.body))
	);

	// @TeamName notifies every member of that team, even if the team isn't
	// assigned to this task and its members have no other access to it.
	const mentionedViaTeam = new Set<string>();
	for (const team of teams) {
		const pattern = new RegExp(`@${team.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`);
		if (!pattern.test(parsed.data.body)) continue;
		for (const member of team.members) {
			if (member.userId !== user.id) mentionedViaTeam.add(member.userId);
		}
	}

	const allRecipientIds = new Set([...recipients.keys(), ...mentionedViaTeam]);
	for (const uid of allRecipientIds) {
		const mentioned = mentionedNames.has(recipients.get(uid) ?? "") || mentionedViaTeam.has(uid);
		await notifyUser({
			userId: uid,
			title: mentioned ? `${user.name} mentioned you` : `${user.name} commented`,
			body: parsed.data.body.slice(0, 140),
			type: "GENERAL",
			linkPath: `/tasks?open=${id}`,
		}).catch(() => {});
	}

	return NextResponse.json({ comment }, { status: 201 });
}
