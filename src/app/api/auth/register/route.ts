import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";
import bcrypt from "bcryptjs";

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const { email: rawEmail, password, name } = RegisterSchema.parse(json);
    // Case-insensitive everywhere: "Name@x.com" and "name@x.com" must never
    // become two accounts, or sign-in silently fails depending on which
    // casing someone happens to type.
    const email = rawEmail.trim().toLowerCase();

    const existing = await prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } } });
    if (existing) {
      const message = existing.active
        ? "Email already in use"
        : "An account with this email already exists but has been deactivated. Ask an admin to reactivate it instead of signing up again.";
      return NextResponse.json({ error: message }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { email, password: passwordHash, name },
      select: { id: true, email: true, name: true, role: true },
    });

    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.flatten();
      const errorMessage = Object.values(errors.fieldErrors).flat().join(", ") || "Invalid input";
      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}


