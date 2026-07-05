import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, isAdmin } from "@/lib/session";

export async function GET() {
	const user = await getCurrentUser();
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	// Non-admins (e.g. filling an assignee dropdown on the Tasks page) only
	// need id/name -- they don't need everyone's email address.
	const admin = isAdmin(user);

	const users = await prisma.user.findMany({
		select: {
			id: true,
			name: true,
			email: admin,
			role: admin,
			active: true,
			createdAt: admin,
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
