import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, isAdmin } from "@/lib/session";
import bcrypt from "bcryptjs";
import { logActivity } from "@/lib/audit";
import { z } from "zod";

export async function GET(request: NextRequest) {
	const user = await getCurrentUser();
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	// Non-admins (e.g. filling an assignee dropdown on the Tasks page) only
	// need id/name -- they don't need everyone's email address.
	const admin = isAdmin(user);

	// Deactivated accounts are hidden by default everywhere this list feeds
	// (assignee pickers, mention lists) -- only the admin Team page asks for
	// them back, and only admins are ever allowed to see them.
	const includeInactive = admin && request.nextUrl.searchParams.get("includeInactive") === "true";

	const users = await prisma.user.findMany({
		select: {
			id: true,
			name: true,
			email: admin,
			role: admin,
			active: true,
			createdAt: admin,
		},
		where: includeInactive ? {} : { active: true },
		orderBy: {
			name: "asc"
		}
	});

	return NextResponse.json({ users });
}

const CreateUserSchema = z.object({
	name: z.string().min(1),
	email: z.string().email(),
	password: z.string().min(8),
	role: z.enum(["WORKER", "MANAGER", "ADMIN"]).optional(),
});

// Lets an admin add a team member directly, without them having to self-serve
// sign up -- useful when handing someone a temporary password in person.
export async function POST(request: NextRequest) {
	const user = await getCurrentUser();
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	if (!isAdmin(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

	try {
		const json = await request.json();
		const data = CreateUserSchema.parse(json);
		const email = data.email.trim().toLowerCase();

		const existing = await prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } } });
		if (existing) {
			const message = existing.active
				? "Email already in use"
				: "An account with this email already exists but has been deactivated. Reactivate it instead of creating a new one.";
			return NextResponse.json({ error: message }, { status: 409 });
		}

		const passwordHash = await bcrypt.hash(data.password, 12);
		const created = await prisma.user.create({
			data: {
				name: data.name,
				email,
				password: passwordHash,
				role: data.role ?? "WORKER",
			},
			select: { id: true, name: true, email: true, role: true, active: true, createdAt: true },
		});

		await logActivity({
			entityType: "user",
			entityId: created.id,
			action: "CREATED",
			actorId: user.id,
			after: { name: created.name, email: created.email, role: created.role },
		});

		return NextResponse.json({ user: created }, { status: 201 });
	} catch (error) {
		if (error instanceof z.ZodError) {
			const errors = error.flatten();
			const message = Object.values(errors.fieldErrors).flat().join(", ") || "Invalid input";
			return NextResponse.json({ error: message }, { status: 400 });
		}
		return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
	}
}
