import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";

const LoginSchema = z.object({
	email: z.string().email(),
	password: z.string().min(8)
});

export async function POST(request: Request) {
	try {
		const json = await request.json();
		const { email, password } = LoginSchema.parse(json);

		// Case-insensitive: whatever casing someone types must resolve to the
		// same account they signed up with. Prefers an active match if a
		// legacy duplicate ever exists under two different casings.
		const user = await prisma.user.findFirst({
			where: { email: { equals: email.trim(), mode: "insensitive" } },
			orderBy: { active: "desc" },
		});
		if (!user) return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });

		const ok = await bcrypt.compare(password, user.password);
		if (!ok) return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });

		// Checked after the password so a wrong-password guess on a deactivated
		// account still just says "Invalid credentials" -- only someone who
		// actually knows the password learns the account is disabled.
		if (!user.active) {
			return NextResponse.json(
				{ error: "This account has been deactivated. Ask an admin to reactivate it." },
				{ status: 403 }
			);
		}

		const session = await prisma.session.create({
			data: {
				userId: user.id,
				expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7) // 7 days
			}
		});

		const cookieStore = await cookies();
		cookieStore.set("auth_session", session.id, {
			httpOnly: true,
			path: "/",
			maxAge: 60 * 60 * 24 * 7,
			secure: process.env.NODE_ENV === "production"
		});

		return NextResponse.json({ ok: true });
	} catch (error) {
		if (error instanceof z.ZodError) {
			return NextResponse.json({ error: error.flatten() }, { status: 400 });
		}
		return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
	}
}
