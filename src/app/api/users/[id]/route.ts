import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import bcrypt from "bcryptjs";
import { logActivity } from "@/lib/audit";
import { z } from "zod";

const UpdateUserSchema = z.object({
	name: z.string().min(1).optional(),
	email: z.string().email().optional(),
	role: z.enum(["WORKER", "MANAGER", "ADMIN"]).optional(),
	active: z.boolean().optional(),
	password: z.string().min(8).optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
	const user = await getCurrentUser();
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	// Only admins can update users
	if (user.role !== "ADMIN") {
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}

	try {
		const json = await request.json();
		const { password, ...data } = UpdateUserSchema.parse(json);
		const { id } = await params;

		if (data.email) {
			data.email = data.email.trim().toLowerCase();
			// The DB unique index on email is plain case-sensitive collation,
			// so without this check "Name@x.com" and "name@x.com" could both
			// exist -- re-check case-insensitively before every email change.
			const collision = await prisma.user.findFirst({
				where: { email: { equals: data.email, mode: "insensitive" }, id: { not: id } },
			});
			if (collision) {
				return NextResponse.json({ error: "Another account already uses that email." }, { status: 409 });
			}
		}

		const previous = await prisma.user.findUnique({ where: { id }, select: { role: true, active: true } });

		const updatedUser = await prisma.user.update({
			where: { id },
			data: password ? { ...data, password: await bcrypt.hash(password, 12) } : data,
			select: {
				id: true,
				name: true,
				email: true,
				role: true,
				active: true,
				createdAt: true
			}
		});

		// A reset password should force a fresh sign-in everywhere, same as
		// deactivating does -- otherwise an already-open session on another
		// device keeps working with the password nobody else knows anymore.
		if (password) {
			await prisma.session.deleteMany({ where: { userId: id } });
		}

		// Role/active changes are the sensitive part of this route -- logged
		// with before/after. Password resets are logged too, but never with
		// the password itself, before or after.
		if (("role" in data && data.role !== previous?.role) || ("active" in data && data.active !== previous?.active)) {
			await logActivity({
				entityType: "user",
				entityId: id,
				action: "UPDATED",
				actorId: user.id,
				before: previous ?? undefined,
				after: { role: updatedUser.role, active: updatedUser.active },
			});
		}
		if (password) {
			await logActivity({
				entityType: "user",
				entityId: id,
				action: "PASSWORD_RESET",
				actorId: user.id,
			});
		}

		return NextResponse.json({ user: updatedUser });
	} catch (error) {
		if (error instanceof z.ZodError) {
			const errors = error.flatten();
			const errorMessage = Object.values(errors.fieldErrors).flat().join(", ") || "Invalid input";
			return NextResponse.json({ error: errorMessage }, { status: 400 });
		}
		return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
	}
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
	const user = await getCurrentUser();
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	// Only admins can remove users
	if (user.role !== "ADMIN") {
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}

	try {
		const { id } = await params;

		// Don't allow users to delete themselves
		if (id === user.id) {
			return NextResponse.json({ error: "Cannot delete your own account" }, { status: 400 });
		}

		const permanent = new URL(request.url).searchParams.get("permanent") === "true";

		if (permanent) {
			// Only ever succeeds for an account with zero history -- every
			// relation below is a required (non-nullable) foreign key to
			// User with no cascade, so Postgres itself refuses the delete the
			// moment any task/comment/attendance/etc. references this person.
			// That's the real guardrail; this check just lets us give a clear
			// reason instead of a raw 500. Postgres reports this as a RESTRICT
			// violation (SQLSTATE 23001), which Prisma doesn't map to its usual
			// P2003 foreign-key code, so match on the raw SQLSTATE instead.
			try {
				await prisma.$transaction([
					prisma.session.deleteMany({ where: { userId: id } }),
					prisma.pushSubscription.deleteMany({ where: { userId: id } }),
					prisma.notification.deleteMany({ where: { userId: id } }),
					prisma.teamMember.deleteMany({ where: { userId: id } }),
					prisma.user.delete({ where: { id } }),
				]);
				await logActivity({
					entityType: "user",
					entityId: id,
					action: "DELETED_PERMANENTLY",
					actorId: user.id,
				});
				return NextResponse.json({ success: true, permanent: true });
			} catch (err: any) {
				const blockedByHistory =
					err?.code === "P2003" ||
					err?.code === "P2025" ||
					String(err?.message ?? "").includes("23001") ||
					String(err?.message ?? "").includes("RESTRICT") ||
					String(err?.message ?? "").includes("foreign key");
				if (blockedByHistory) {
					return NextResponse.json(
						{ error: "This account has tasks, comments, or attendance history on record and can't be permanently deleted. Deactivate it instead." },
						{ status: 409 }
					);
				}
				throw err;
			}
		}

		// Soft-delete (deactivate) is the default: a real employee will almost
		// always have tasks, sessions, attendance logs, or shifts referencing
		// them, and none of those relations cascade -- a hard delete throws
		// a foreign-key error and this would just 500. Deactivating matches
		// the `active: true` filter already used everywhere else (task
		// assignee lists, /api/users, etc.), so a deactivated user quietly
		// stops appearing as assignable without deleting their history.
		await prisma.user.update({ where: { id }, data: { active: false } });
		// Also kill any active sessions so a deactivated account can't keep using the app.
		await prisma.session.deleteMany({ where: { userId: id } });
		await logActivity({
			entityType: "user",
			entityId: id,
			action: "DEACTIVATED",
			actorId: user.id,
		});
		return NextResponse.json({ success: true });
	} catch (error) {
		return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
	}
}
