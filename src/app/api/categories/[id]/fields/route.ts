import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, isAdmin } from "@/lib/session";
import { z } from "zod";

const CreateFieldSchema = z.object({
	key: z.string().min(1).max(60).regex(/^[a-zA-Z][a-zA-Z0-9_]*$/, "Use letters, numbers, and underscores, starting with a letter."),
	label: z.string().min(1).max(80),
	type: z.enum(["TEXT", "NUMBER", "DATE", "BOOLEAN"]),
	required: z.boolean().optional(),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const user = await getCurrentUser();
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	if (!isAdmin(user)) return NextResponse.json({ error: "Only admins/managers can add fields." }, { status: 403 });

	const { id } = await params;
	const parsed = CreateFieldSchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) {
		return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid field." }, { status: 400 });
	}

	const count = await prisma.taskCategoryField.count({ where: { categoryId: id } });
	try {
		const field = await prisma.taskCategoryField.create({
			data: {
				categoryId: id,
				key: parsed.data.key,
				label: parsed.data.label,
				type: parsed.data.type,
				required: parsed.data.required ?? false,
				order: count,
			},
		});
		return NextResponse.json({ field }, { status: 201 });
	} catch (err: any) {
		if (err?.code === "P2002") {
			return NextResponse.json({ error: "A field with that key already exists in this category." }, { status: 409 });
		}
		return NextResponse.json({ error: "Couldn't add the field." }, { status: 500 });
	}
}
