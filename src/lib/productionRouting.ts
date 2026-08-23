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

// A node with 2+ incoming edges is a join point, but "wait for every
// predecessor" is only correct when those predecessors are siblings in an
// AND fan-out. The far more common shape -- several OR alternatives that
// all lead to the same next stage (e.g. Foil / Bottom / Die Cutting, only
// one of which is ever chosen, all reconverging on Box Making) -- must NOT
// wait for the alternatives that were never picked, since they'll never
// complete. This walks backward from a not-yet-visited predecessor to
// determine whether it's still genuinely possible for this item to reach
// it, or whether an earlier OR choice has already ruled it out for good.
async function isNodeRuledOut(despatchItemId: string, nodeId: string, cache: Map<string, boolean>): Promise<boolean> {
	if (cache.has(nodeId)) return cache.get(nodeId)!;
	cache.set(nodeId, false); // guard against revisiting mid-computation (graph is a DAG, shouldn't recurse back here)

	const row = await prisma.itemStageProgress.findFirst({ where: { despatchItemId, nodeId } });
	if (row) return false; // already visited -- definitely not ruled out

	const incoming = await prisma.stageEdge.findMany({ where: { toNodeId: nodeId } });
	if (incoming.length === 0) return false; // start node or disconnected -- not ruled out by this logic

	for (const edge of incoming) {
		const fromRow = await prisma.itemStageProgress.findFirst({ where: { despatchItemId, nodeId: edge.fromNodeId } });
		if (!fromRow) {
			if (!(await isNodeRuledOut(despatchItemId, edge.fromNodeId, cache))) {
				cache.set(nodeId, false);
				return false; // this predecessor hasn't been ruled out either -- still possible
			}
			continue;
		}
		const fromNode = await prisma.stageNode.findUnique({ where: { id: edge.fromNodeId } });
		const fromOutgoing = await prisma.stageEdge.findMany({ where: { fromNodeId: edge.fromNodeId } });
		if (fromOutgoing.length < 2 || fromNode?.branchType === "AND") {
			cache.set(nodeId, false);
			return false; // single path, or an AND fan-out -- this edge will be (or was) taken
		}
		if (!fromRow.completedAt) {
			cache.set(nodeId, false);
			return false; // OR node reached but choice not made yet -- still possible
		}
		const chosenRow = await prisma.itemStageProgress.findFirst({
			where: { despatchItemId, nodeId: { in: fromOutgoing.map((e) => e.toNodeId) } },
		});
		if (!chosenRow || chosenRow.nodeId === nodeId) {
			cache.set(nodeId, false);
			return false; // this is the chosen path, or the choice isn't resolved yet
		}
		// a different branch was chosen -- this specific incoming path is dead, check the others
	}
	cache.set(nodeId, true);
	return true; // every incoming path is dead
}

// Creates a progress row for `nodeId` for this item, unless it's already
// been activated -- or, if it's a join point (2+ incoming edges), unless
// every one of its still-possible predecessors (excluding any ruled out by
// an earlier OR choice elsewhere in the graph) has completed. Called once
// per outgoing edge of a completing stage, so an AND fan-out node activates
// several of these at once (one per parallel path), while a true join node
// quietly no-ops until its last live parallel path catches up.
async function activateNode(despatchItemId: string, nodeId: string) {
	const alreadyActive = await prisma.itemStageProgress.findFirst({ where: { despatchItemId, nodeId } });
	if (alreadyActive) return;

	const incoming = await prisma.stageEdge.findMany({ where: { toNodeId: nodeId } });
	if (incoming.length > 1) {
		for (const edge of incoming) {
			if (await isNodeRuledOut(despatchItemId, edge.fromNodeId, new Map())) continue;
			const fromRow = await prisma.itemStageProgress.findFirst({ where: { despatchItemId, nodeId: edge.fromNodeId } });
			if (!fromRow || !fromRow.completedAt) return; // still waiting on a real (not ruled-out) predecessor
		}
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

// Reverses one step of progress on a stage: a completed stage reverts to
// in-progress (not done, but still reachable -- someone still has to
// re-tick it); an in-progress stage that was reached via a choice or an AND
// fan-out is removed outright, putting the node back to however it looked
// before it was ever activated. Either way, anything that was only reachable
// *because* of this stage is rolled back too -- but only if none of it has
// itself been completed yet, since undoing past real, finished work would
// silently destroy history instead of just correcting a misclick.
export async function undoStage(despatchItemId: string, progressId: string) {
	const row = await prisma.itemStageProgress.findUnique({ where: { id: progressId } });
	if (!row || row.despatchItemId !== despatchItemId) throw new Error("Stage not found for this item.");
	if (!row.nodeId) throw new Error("This stage can't be undone.");

	async function collectDescendants(nodeId: string): Promise<string[]> {
		const edges = await prisma.stageEdge.findMany({ where: { fromNodeId: nodeId } });
		let collected: string[] = [];
		for (const edge of edges) {
			const childRow = await prisma.itemStageProgress.findFirst({ where: { despatchItemId, nodeId: edge.toNodeId } });
			if (!childRow) continue;
			if (childRow.completedAt) throw new Error(`Can't undo -- "${childRow.stageName}" has already been completed.`);
			collected.push(childRow.id, ...(await collectDescendants(edge.toNodeId)));
		}
		return collected;
	}

	if (row.completedAt) {
		const toRemove = await collectDescendants(row.nodeId);
		if (toRemove.length > 0) await prisma.itemStageProgress.deleteMany({ where: { id: { in: toRemove } } });
		await prisma.itemStageProgress.update({ where: { id: row.id }, data: { startedAt: null, completedAt: null } });
	} else {
		const incoming = await prisma.stageEdge.findMany({ where: { toNodeId: row.nodeId } });
		if (incoming.length === 0) throw new Error("Can't undo the starting stage.");
		const toRemove = await collectDescendants(row.nodeId);
		if (toRemove.length > 0) await prisma.itemStageProgress.deleteMany({ where: { id: { in: toRemove } } });
		await prisma.itemStageProgress.delete({ where: { id: row.id } });
	}
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
