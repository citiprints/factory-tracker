import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { notifyUser } from "@/lib/notify";
import { z } from "zod";

const StageNotesSchema = z.object({
	stageId: z.string().min(1),
	note: z.string().nullable().optional(),
	taggedUserIds: z.array(z.string()).optional(),
});

// Per-item annotations on one stage in the live flowchart -- a free note and
// a list of tagged users. Lives only on this item's own progress row, not
// the reusable route template, so it never shows up in Settings.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
	const user = await getCurrentUser();
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const { id } = await params;

	let data: z.infer<typeof StageNotesSchema>;
	try {
		data = StageNotesSchema.parse(await request.json());
	} catch (error) {
		if (error instanceof z.ZodError) return NextResponse.json({ error: error.flatten() }, { status: 400 });
		return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
	}

	const stage = await prisma.itemStageProgress.findUnique({ where: { id: data.stageId } });
	if (!stage || stage.despatchItemId !== id) {
		return NextResponse.json({ error: "Stage not found for this item." }, { status: 404 });
	}

	const previouslyTagged = new Set<string>(stage.taggedUserIds ? JSON.parse(stage.taggedUserIds) : []);

	const updated = await prisma.itemStageProgress.update({
		where: { id: data.stageId },
		data: {
			...("note" in data ? { note: data.note?.trim() || null } : {}),
			...("taggedUserIds" in data ? { taggedUserIds: JSON.stringify(data.taggedUserIds ?? []) } : {}),
		},
	});

	if (data.taggedUserIds) {
		const despatchItem = await prisma.despatchItem.findUnique({ where: { id }, select: { name: true, taskId: true } });
		const newlyTagged = data.taggedUserIds.filter((uid) => !previouslyTagged.has(uid) && uid !== user.id);
		for (const uid of newlyTagged) {
			await notifyUser({
				userId: uid,
				title: "Tagged on a production stage",
				body: `${user.name ?? "Someone"} tagged you on "${stage.stageName}" (${despatchItem?.name ?? "item"})`,
				type: "STAGE_TAGGED",
				linkPath: `/tasks?open=${despatchItem?.taskId ?? ""}`,
				taskId: despatchItem?.taskId,
			});
		}
	}

	return NextResponse.json({
		stage: { id: updated.id, note: updated.note, taggedUserIds: updated.taggedUserIds ? JSON.parse(updated.taggedUserIds) : [] },
	});
}
