import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, isAdmin } from "@/lib/session";
import { logActivity } from "@/lib/audit";
import { assertIsDag } from "@/lib/productionRouting";
import { z } from "zod";

const NodeSchema = z.object({
	id: z.string().min(1), // client-generated temp id, remapped to a real cuid on save
	name: z.string().min(1),
	posX: z.number(),
	posY: z.number(),
	isStart: z.boolean(),
	branchType: z.enum(["OR", "AND"]).default("OR"),
});
const EdgeSchema = z.object({
	fromNodeId: z.string().min(1),
	toNodeId: z.string().min(1),
	label: z.string().nullable().optional(),
});
const UpdateSchema = z.object({
	name: z.string().min(1).optional(),
	nodes: z.array(NodeSchema).min(1).optional(),
	edges: z.array(EdgeSchema).optional(),
});

// Full-replace semantics: if `nodes`/`edges` are provided, the whole graph
// is torn down and rebuilt from the payload -- same "replace the whole
// thing" simplicity the old flat stage-list PATCH used, avoiding
// incremental-diff complexity.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
	const user = await getCurrentUser();
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	if (!isAdmin(user)) return NextResponse.json({ error: "Admins only." }, { status: 403 });

	try {
		const { id } = await params;
		const json = await request.json();
		const data = UpdateSchema.parse(json);

		const previous = await prisma.categoryStageTemplate.findUnique({
			where: { id },
			include: { nodes: true, edges: true },
		});
		if (!previous) return NextResponse.json({ error: "Not found" }, { status: 404 });

		if (data.nodes) {
			try {
				assertIsDag(data.nodes, data.edges ?? []);
			} catch (e: any) {
				return NextResponse.json({ error: e.message }, { status: 400 });
			}
		}

		const template = await prisma.$transaction(async (tx) => {
			if ("name" in data) {
				await tx.categoryStageTemplate.update({ where: { id }, data: { name: data.name } });
			}
			if (data.nodes) {
				await tx.stageEdge.deleteMany({ where: { templateId: id } });
				await tx.stageNode.deleteMany({ where: { templateId: id } });
				const idMap = new Map<string, string>();
				for (const n of data.nodes) {
					const node = await tx.stageNode.create({
						data: { templateId: id, name: n.name, posX: n.posX, posY: n.posY, isStart: n.isStart, branchType: n.branchType },
					});
					idMap.set(n.id, node.id);
				}
				for (const e of data.edges ?? []) {
					await tx.stageEdge.create({
						data: {
							templateId: id,
							fromNodeId: idMap.get(e.fromNodeId)!,
							toNodeId: idMap.get(e.toNodeId)!,
							label: e.label ?? null,
						},
					});
				}
			}
			return tx.categoryStageTemplate.findUniqueOrThrow({ where: { id }, include: { nodes: true, edges: true } });
		});

		await logActivity({
			entityType: "category_stage_template",
			entityId: id,
			action: "UPDATED",
			actorId: user.id,
			before: { name: previous.name, nodes: previous.nodes, edges: previous.edges },
			after: { name: template.name, nodes: template.nodes, edges: template.edges },
		});

		return NextResponse.json({
			template: {
				id: template.id,
				category: template.category,
				name: template.name,
				nodes: template.nodes.map((n) => ({ id: n.id, name: n.name, posX: n.posX, posY: n.posY, isStart: n.isStart, branchType: n.branchType })),
				edges: template.edges.map((e) => ({ id: e.id, fromNodeId: e.fromNodeId, toNodeId: e.toNodeId, label: e.label })),
			},
		});
	} catch (error) {
		if (error instanceof z.ZodError) {
			return NextResponse.json({ error: error.flatten() }, { status: 400 });
		}
		return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
	}
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
	const user = await getCurrentUser();
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	if (!isAdmin(user)) return NextResponse.json({ error: "Admins only." }, { status: 403 });

	const { id } = await params;
	const template = await prisma.categoryStageTemplate.findUnique({ where: { id } });
	if (!template) return NextResponse.json({ error: "Not found" }, { status: 404 });

	// Same RESTRICT-avoidance ordering used everywhere else in this codebase:
	// dependent rows cleared before the parent, deepest first.
	await prisma.stageEdge.deleteMany({ where: { templateId: id } });
	await prisma.stageNode.deleteMany({ where: { templateId: id } });
	await prisma.categoryStageTemplate.delete({ where: { id } });

	await logActivity({
		entityType: "category_stage_template",
		entityId: id,
		action: "DELETED",
		actorId: user.id,
		before: { category: template.category, name: template.name },
	});

	return NextResponse.json({ ok: true });
}
