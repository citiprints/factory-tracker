import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { logActivity } from "@/lib/audit";
import { completeStage } from "@/lib/productionRouting";
import { z } from "zod";

const AdvanceSchema = z.object({
	// Which specific in-progress stage to complete -- an item can have
	// several active at once under a parallel (AND) fan-out, so this can't
	// be inferred implicitly the way a single linear/OR route could.
	stageId: z.string().min(1),
});

// Completes one specific stage. If that stage's node has exactly one
// outgoing edge, or 2+ marked AND (parallel), the next stage(s) auto-
// activate immediately; a 2+-edge OR branch point instead returns the
// options for the client to offer a choice via choose-branch.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
	const user = await getCurrentUser();
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const { id } = await params;

	let stageId: string;
	try {
		({ stageId } = AdvanceSchema.parse(await request.json()));
	} catch (error) {
		if (error instanceof z.ZodError) return NextResponse.json({ error: error.flatten() }, { status: 400 });
		return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
	}

	const completedStage = await prisma.itemStageProgress.findUnique({ where: { id: stageId } });
	if (!completedStage || completedStage.despatchItemId !== id) {
		return NextResponse.json({ error: "Stage not found for this item." }, { status: 404 });
	}
	if (completedStage.completedAt) {
		return NextResponse.json({ error: "This stage is already complete." }, { status: 409 });
	}

	let result;
	try {
		result = await completeStage(id, stageId);
	} catch (error: any) {
		return NextResponse.json({ error: error.message ?? "Internal Server Error" }, { status: 409 });
	}

	const despatchItem = await prisma.despatchItem.findUnique({ where: { id } });

	await logActivity({
		entityType: "despatch_item",
		entityId: id,
		action: "STAGE_ADVANCED",
		actorId: user.id,
		taskId: despatchItem?.taskId,
		after: { stageName: completedStage.stageName },
	});

	if (result.kind === "needsBranchChoice") {
		return NextResponse.json({ needsBranchChoice: true, options: result.options, stage: completedStage });
	}

	// Deliberately doesn't auto-advance status to Packed here, even once
	// every stage is done -- that used to happen silently in this same
	// request, which is exactly what made "what happens after the last
	// checkbox?" so unclear. The UI now shows an explicit "All stages
	// complete" banner instead, and Packed only happens once someone
	// confirms it via the PATCH route (which carries its own assembly gate
	// for components).
	return NextResponse.json({ stage: completedStage, isRouteComplete: result.isRouteComplete });
}
