import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { z } from "zod";

const UpdateUserSchema = z.object({
	name: z.string().min(1).optional(),
	email: z.string().email().optional(),
	role: z.enum(["WORKER", "MANAGER", "ADMIN"]).optional(),
	active: z.boolean().optional(),
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
		const data = UpdateUserSchema.parse(json);
		const { id } = await params;
		
		const updatedUser = await prisma.user.update({
			where: { id },
			data,
			select: {
				id: true,
				name: true,
				email: true,
				role: true,
				active: true,
				createdAt: true
			}
		});
		
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

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
	const user = await getCurrentUser();
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	
	// Only admins can delete users
	if (user.role !== "ADMIN") {
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}
	
	try {
		const { id } = await params;
		
		// Don't allow users to delete themselves
		if (id === user.id) {
			return NextResponse.json({ error: "Cannot delete your own account" }, { status: 400 });
		}
		
		await prisma.user.delete({ where: { id } });
		return NextResponse.json({ success: true });
	} catch (error) {
		return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
	}
}
