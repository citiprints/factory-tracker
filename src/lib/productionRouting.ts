import { prisma } from "@/lib/db";

type GraphNode = { id: string; isStart: boolean };
type GraphEdge = { fromNodeId: string; toNodeId: string };

// A route must be a DAG with exactly one start node -- no rework/QC-fail
// loops (explicitly out of scope). Used both when saving a route (Settings)
// and defensively before any future path-walking.
export function assertIsDag(nodes: GraphNode[], edges: GraphEdge[]) {
	const startNodes = nodes.filter((n) => n.isStart);
	if (startNodes.length !== 1) {
		throw new Error(`A route needs exactly one start stage (found ${startNodes.length}).`);
	}

	const outgoing = new Map<string, string[]>();
	for (const e of edges) {
		if (!outgoing.has(e.fromNodeId)) outgoing.set(e.fromNodeId, []);
		outgoing.get(e.fromNodeId)!.push(e.toNodeId);
	}

	const WHITE = 0, GRAY = 1, BLACK = 2;
	const color = new Map<string, number>(nodes.map((n) => [n.id, WHITE]));

	function visit(nodeId: string, depth: number) {
		if (depth > 200) throw new Error("This route is too deep or contains a cycle.");
		color.set(nodeId, GRAY);
		for (const next of outgoing.get(nodeId) ?? []) {
			const c = color.get(next);
			if (c === GRAY) throw new Error("Routes can't loop back on themselves -- every path must lead forward to an end.");
			if (c === WHITE) visit(next, depth + 1);
		}
		color.set(nodeId, BLACK);
	}

	for (const n of nodes) {
		if (color.get(n.id) === WHITE) visit(n.id, 0);
	}
}

// Starts an item on a route: finds the template's start node and creates
// the first ItemStageProgress row. Shared by the auto-instantiate path
// (category has exactly one template) and the explicit choose-route path
// (category has several).
export async function startRoute(despatchItemId: string, templateId: string) {
	const startNode = await prisma.stageNode.findFirst({ where: { templateId, isStart: true } });
	if (!startNode) return;

	await prisma.despatchItem.update({ where: { id: despatchItemId }, data: { stageTemplateId: templateId } });
	await prisma.itemStageProgress.create({
		data: {
			despatchItemId,
			nodeId: startNode.id,
			stageName: startNode.name,
			order: 0,
		},
	});
}

export type AdvanceResult =
	| { kind: "advanced"; isLastStage: false }
	| { kind: "lastStage"; isLastStage: true }
	| { kind: "needsBranchChoice"; options: { edgeId: string; toNodeName: string; label: string | null }[] };

// Completes an item's current stage, then looks at that stage's outgoing
// edges: none -> this was the last stage; exactly one -> auto-advances to
// it immediately (feels identical to a plain linear route); two or more ->
// stops and reports the branch options instead of guessing.
export async function advanceCurrentStage(despatchItemId: string): Promise<AdvanceResult> {
	const current = await prisma.itemStageProgress.findFirst({
		where: { despatchItemId, completedAt: null },
		orderBy: { order: "desc" },
	});
	if (!current) throw new Error("All stages for this item are already complete.");

	const now = new Date();
	await prisma.itemStageProgress.update({
		where: { id: current.id },
		data: { startedAt: current.startedAt ?? now, completedAt: now },
	});

	if (!current.nodeId) return { kind: "lastStage", isLastStage: true };

	const edges = await prisma.stageEdge.findMany({
		where: { fromNodeId: current.nodeId },
		include: { to: true },
	});

	if (edges.length === 0) return { kind: "lastStage", isLastStage: true };

	if (edges.length === 1) {
		await prisma.itemStageProgress.create({
			data: {
				despatchItemId,
				nodeId: edges[0].toNodeId,
				stageName: edges[0].to.name,
				order: current.order + 1,
			},
		});
		return { kind: "advanced", isLastStage: false };
	}

	return {
		kind: "needsBranchChoice",
		options: edges.map((e) => ({ edgeId: e.id, toNodeName: e.to.name, label: e.label })),
	};
}

// Creates the next stage for an item sitting at a branch point, once
// someone has picked which edge to follow.
export async function chooseBranch(despatchItemId: string, edgeId: string) {
	const current = await prisma.itemStageProgress.findFirst({
		where: { despatchItemId },
		orderBy: { order: "desc" },
	});
	if (!current || !current.completedAt) {
		throw new Error("This item isn't waiting on a branch choice.");
	}

	const edge = await prisma.stageEdge.findUnique({ where: { id: edgeId }, include: { to: true } });
	if (!edge || edge.fromNodeId !== current.nodeId) {
		throw new Error("That branch doesn't lead on from this item's current stage.");
	}

	await prisma.itemStageProgress.create({
		data: {
			despatchItemId,
			nodeId: edge.toNodeId,
			stageName: edge.to.name,
			order: current.order + 1,
		},
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
