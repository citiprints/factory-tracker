import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

export async function GET() {
	const user = await getCurrentUser();
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const users = await prisma.user.findMany({
		select: {
			id: true,
			name: true,
			email: true,
			role: true,
			active: true,
			createdAt: true
		},
		where: {
			active: true
		},
		orderBy: {
			name: "asc"
		}
	});

	return NextResponse.json({ users });
}
