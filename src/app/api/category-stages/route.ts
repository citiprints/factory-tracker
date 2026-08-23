import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, isAdmin } from "@/lib/session";
import { logActivity } from "@/lib/audit";
import { assertIsDag } from "@/lib/productionRouting";
import { z } from "zod";

export async function GET() {
	const user = await getCurrentUser();
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const rows = await prisma.categoryStageTemplate.findMany({
		orderBy: [{ category: "asc" }, { name: "asc" }],
		include: { nodes: true, edges: true },
	});
	const templates = rows.map((r) => ({
		id: r.id,
		category: r.category,
		name: r.name,
		nodes: r.nodes.map((n) => ({ id: n.id, name: n.name, posX: n.posX, posY: n.posY, isStart: n.isStart, branchType: n.branchType })),
		edges: r.edges.map((e) => ({ id: e.id, fromNodeId: e.fromNodeId, toNodeId: e.toNodeId, label: e.label })),
	}));

	return NextResponse.json({ templates });
}

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
const CreateSchema = z.object({
	category: z.string().min(1),
	name: z.string().min(1),
	nodes: z.array(NodeSchema).min(1),
	edges: z.array(EdgeSchema),
});

// Creates a new named route for a category -- a category can have several
// (e.g. "Standard" vs "Laminated") for jobs of the same category that take
// different real paths through production.
export async function POST(request: Request) {
	const user = await getCurrentUser();
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	if (!isAdmin(user)) return NextResponse.json({ error: "Admins only." }, { status: 403 });

	try {
		const json = await request.json();
		const data = CreateSchema.parse(json);

		const existing = await prisma.categoryStageTemplate.findUnique({
			where: { category_name: { category: data.category, name: data.name } },
		});
		if (existing) {
			return NextResponse.json({ error: `"${data.name}" already exists for ${data.category}.` }, { status: 409 });
		}

		try {
			assertIsDag(data.nodes, data.edges);
		} catch (e: any) {
			return NextResponse.json({ error: e.message }, { status: 400 });
		}

		const template = await prisma.$transaction(async (tx) => {
			const created = await tx.categoryStageTemplate.create({
				data: { category: data.category, name: data.name },
			});
			const idMap = new Map<string, string>();
			for (const n of data.nodes) {
				const node = await tx.stageNode.create({
					data: { templateId: created.id, name: n.name, posX: n.posX, posY: n.posY, isStart: n.isStart, branchType: n.branchType },
				});
				idMap.set(n.id, node.id);
			}
			for (const e of data.edges) {
				await tx.stageEdge.create({
					data: {
						templateId: created.id,
						fromNodeId: idMap.get(e.fromNodeId)!,
						toNodeId: idMap.get(e.toNodeId)!,
						label: e.label ?? null,
					},
				});
			}
			return created;
		});

		await logActivity({
			entityType: "category_stage_template",
			entityId: template.id,
			action: "CREATED",
			actorId: user.id,
			after: { category: data.category, name: data.name, nodes: data.nodes, edges: data.edges },
		});

		return NextResponse.json({ template: { id: template.id, category: template.category, name: template.name } }, { status: 201 });
	} catch (error) {
		if (error instanceof z.ZodError) {
			return NextResponse.json({ error: error.flatten() }, { status: 400 });
		}
		return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
	}
}
