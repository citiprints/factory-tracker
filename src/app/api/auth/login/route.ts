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

		const user = await prisma.user.findUnique({ where: { email } });
		if (!user) return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });

		const ok = await bcrypt.compare(password, user.password);
		if (!ok) return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });

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
