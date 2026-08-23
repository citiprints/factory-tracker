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

async function nextOrder(despatchItemId: string): Promise<number> {
	const max = await prisma.itemStageProgress.aggregate({
		where: { despatchItemId },
		_max: { order: true },
	});
	return (max._max.order ?? -1) + 1;
}

// Creates a progress row for `nodeId` for this item, unless it's already
// been activated -- or, if it's a join point (2+ incoming edges), unless
// every one of its predecessor nodes has already been completed by this
// item. Called once per outgoing edge of a completing stage, so an AND
// fan-out node activates several of these at once (one per parallel path),
// while a join node quietly no-ops until its last parallel path catches up.
async function activateNode(despatchItemId: string, nodeId: string) {
	const alreadyActive = await prisma.itemStageProgress.findFirst({ where: { despatchItemId, nodeId } });
	if (alreadyActive) return;

	const incoming = await prisma.stageEdge.findMany({ where: { toNodeId: nodeId } });
	if (incoming.length > 1) {
		const predecessorIds = incoming.map((e) => e.fromNodeId);
		const completed = await prisma.itemStageProgress.findMany({
			where: { despatchItemId, nodeId: { in: predecessorIds }, completedAt: { not: null } },
		});
		const completedSet = new Set(completed.map((p) => p.nodeId));
		if (!predecessorIds.every((id) => completedSet.has(id))) return; // still waiting on a parallel path
	}

	const node = await prisma.stageNode.findUnique({ where: { id: nodeId } });
	if (!node) return;
	await prisma.itemStageProgress.create({
		data: { despatchItemId, nodeId, stageName: node.name, order: await nextOrder(despatchItemId) },
	});
}

// True once an item has no stage still in progress and no branch choice
// left unresolved -- i.e. every path through its route has either reached
// a dead end or is blocked waiting on a parallel sibling that hasn't
// activated a join yet (which itself means nothing is currently actionable).
export async function isRouteFullyComplete(despatchItemId: string): Promise<boolean> {
	const incomplete = await prisma.itemStageProgress.count({ where: { despatchItemId, completedAt: null } });
	if (incomplete > 0) return false;

	const completedRows = await prisma.itemStageProgress.findMany({
		where: { despatchItemId, completedAt: { not: null } },
		select: { nodeId: true },
	});
	for (const row of completedRows) {
		if (!row.nodeId) continue;
		const node = await prisma.stageNode.findUnique({ where: { id: row.nodeId } });
		if (!node || node.branchType !== "OR") continue;
		const outgoing = await prisma.stageEdge.findMany({ where: { fromNodeId: row.nodeId } });
		if (outgoing.length < 2) continue;
		const anyTargetActivated = await prisma.itemStageProgress.findFirst({
			where: { despatchItemId, nodeId: { in: outgoing.map((e) => e.toNodeId) } },
		});
		if (!anyTargetActivated) return false; // this OR choice is still pending
	}
	return true;
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
		data: { despatchItemId, nodeId: startNode.id, stageName: startNode.name, order: 0 },
	});
}

export type AdvanceResult =
	| { kind: "advanced"; isRouteComplete: boolean }
	| { kind: "needsBranchChoice"; options: { edgeId: string; toNodeName: string; label: string | null }[] };

// Completes one specific in-progress stage (an item can have several active
// at once under a parallel AND fan-out, so the caller must say which). Then
// looks at that stage's own outgoing edges: none -> nothing to activate;
// exactly one, or 2+ marked AND -> activates all of them (join-checked,
// see activateNode); 2+ marked OR -> stops and reports the choice instead
// of guessing.
export async function completeStage(despatchItemId: string, progressId: string): Promise<AdvanceResult> {
	const stage = await prisma.itemStageProgress.findUnique({ where: { id: progressId } });
	if (!stage || stage.despatchItemId !== despatchItemId) throw new Error("Stage not found for this item.");
	if (stage.completedAt) throw new Error("This stage is already complete.");

	const now = new Date();
	await prisma.itemStageProgress.update({
		where: { id: stage.id },
		data: { startedAt: stage.startedAt ?? now, completedAt: now },
	});

	if (stage.nodeId) {
		const node = await prisma.stageNode.findUnique({ where: { id: stage.nodeId } });
		const edges = await prisma.stageEdge.findMany({ where: { fromNodeId: stage.nodeId }, include: { to: true } });

		if (edges.length >= 2 && node?.branchType === "OR") {
			return { kind: "needsBranchChoice", options: edges.map((e) => ({ edgeId: e.id, toNodeName: e.to.name, label: e.label })) };
		}
		for (const edge of edges) {
			await activateNode(despatchItemId, edge.toNodeId);
		}
	}

	return { kind: "advanced", isRouteComplete: await isRouteFullyComplete(despatchItemId) };
}

// Activates the chosen next stage for an item sitting at an OR branch
// point, once someone has picked which edge to follow.
export async function chooseBranch(despatchItemId: string, edgeId: string) {
	const edge = await prisma.stageEdge.findUnique({ where: { id: edgeId } });
	if (!edge) throw new Error("Branch not found.");

	const fromCompleted = await prisma.itemStageProgress.findFirst({
		where: { despatchItemId, nodeId: edge.fromNodeId, completedAt: { not: null } },
	});
	if (!fromCompleted) throw new Error("This item hasn't reached that branch point yet.");

	await activateNode(despatchItemId, edge.toNodeId);
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
