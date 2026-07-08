import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, isAdmin } from "@/lib/session";
import { z } from "zod";

const CreateCategorySchema = z.object({
	name: z.string().min(1).max(60),
});

export async function GET() {
	const user = await getCurrentUser();
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const categories = await prisma.taskCategory.findMany({
		orderBy: { order: "asc" },
		include: { fields: { orderBy: { order: "asc" } } },
	});
	return NextResponse.json({ categories });
}

export async function POST(request: NextRequest) {
	const user = await getCurrentUser();
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	if (!isAdmin(user)) return NextResponse.json({ error: "Only admins/managers can add categories." }, { status: 403 });

	const parsed = CreateCategorySchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) {
		return NextResponse.json({ error: "Give the category a name." }, { status: 400 });
	}

	const count = await prisma.taskCategory.count();
	try {
		const category = await prisma.taskCategory.create({
			data: { name: parsed.data.name, order: count },
			include: { fields: true },
		});
		return NextResponse.json({ category }, { status: 201 });
	} catch (err: any) {
		if (err?.code === "P2002") {
			return NextResponse.json({ error: "A category with that name already exists." }, { status: 409 });
		}
		return NextResponse.json({ error: "Couldn't create the category." }, { status: 500 });
	}
}
