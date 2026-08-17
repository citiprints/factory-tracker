import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, isAdmin } from "@/lib/session";
import { z } from "zod";

const CreateTeamSchema = z.object({
	name: z.string().min(1).max(60),
});

export async function GET() {
	const user = await getCurrentUser();
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const teams = await prisma.team.findMany({
		orderBy: { order: "asc" },
		include: { members: { include: { user: { select: { id: true, name: true } } } } },
	});
	return NextResponse.json({ teams });
}

export async function POST(request: NextRequest) {
	const user = await getCurrentUser();
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	if (!isAdmin(user)) return NextResponse.json({ error: "Only admins/managers can add teams." }, { status: 403 });

	const parsed = CreateTeamSchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) {
		return NextResponse.json({ error: "Give the team a name." }, { status: 400 });
	}

	const count = await prisma.team.count();
	try {
		const team = await prisma.team.create({
			data: { name: parsed.data.name, order: count },
			include: { members: { include: { user: { select: { id: true, name: true } } } } },
		});
		return NextResponse.json({ team }, { status: 201 });
	} catch (err: any) {
		if (err?.code === "P2002") {
			return NextResponse.json({ error: "A team with that name already exists." }, { status: 409 });
		}
		return NextResponse.json({ error: "Couldn't create the team." }, { status: 500 });
	}
}
