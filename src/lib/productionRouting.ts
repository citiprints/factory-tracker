import { prisma } from "@/lib/db";

// Precomputes one ItemStageProgress row per stage in a template -- gives a
// fixed checklist with full timestamp history, not just "current stage".
// Shared by the auto-instantiate path (category has exactly one template)
// and the explicit choose-route path (category has several).
export async function instantiateStages(despatchItemId: string, stages: string[]) {
	if (stages.length === 0) return;
	await prisma.itemStageProgress.createMany({
		data: stages.map((stageName, stageIndex) => ({
			despatchItemId,
			stageName,
			stageIndex,
		})),
	});
}

// Recursively collects every DespatchItem id under (and including) a given
// item's component tree, deepest-first, so callers can delete/query in an
// order that never violates a not-yet-deleted parent reference.
export async function collectComponentIdsDeep(rootId: string): Promise<string[]> {
	const collected: string[] = [];
	let frontier = [rootId];
	while (frontier.length > 0) {
		const children = await prisma.despatchItem.findMany({
			where: { parentItemId: { in: frontier } },
			select: { id: true },
		});
		const childIds = children.map((c) => c.id);
		collected.push(...childIds);
		frontier = childIds;
	}
	return collected;
}
