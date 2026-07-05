import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { z } from "zod";

const CreateFieldSchema = z.object({
	key: z.string().min(1),
	label: z.string().min(1),
	type: z.enum(["TEXT","NUMBER","DATE","BOOLEAN"]),
	required: z.boolean().optional(),
	order: z.number().int().optional()
});

export async function GET() {
	const user = await getCurrentUser();
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	const fields = await prisma.customFieldDef.findMany({ orderBy: { order: "asc" } });
	return NextResponse.json({ fields });
}

export async function POST(request: Request) {
	const user = await getCurrentUser();
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	try {
		const json = await request.json();
		const data = CreateFieldSchema.parse(json);
		const field = await prisma.customFieldDef.create({
			data: {
				key: data.key,
				label: data.label,
				type: data.type,
				required: data.required ?? false,
				order: data.order ?? 0
			}
		});
		return NextResponse.json({ field }, { status: 201 });
	} catch (error) {
		if (error instanceof z.ZodError) return NextResponse.json({ error: error.flatten() }, { status: 400 });
		return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
	}
}
