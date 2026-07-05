import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, isAdmin } from "@/lib/session";
import { z } from "zod";

const UpdateCustomerSchema = z.object({
    name: z.string().min(1).optional(),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    company: z.string().optional(),
    address: z.string().optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!isAdmin(user)) return NextResponse.json({ error: "Only admins/managers can edit customers." }, { status: 403 });
    try {
        const json = await request.json();
        const data = UpdateCustomerSchema.parse(json);
        const { id } = await params;
        const customer = await prisma.customer.update({ where: { id }, data });
        return NextResponse.json({ customer });
    } catch (error) {
        if (error instanceof z.ZodError) return NextResponse.json({ error: error.flatten() }, { status: 400 });
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!isAdmin(user)) return NextResponse.json({ error: "Only admins/managers can delete customers." }, { status: 403 });
    const { id } = await params;
    try {
        await prisma.customer.delete({ where: { id } });
        return NextResponse.json({ ok: true });
    } catch (error) {
        // Fails if the customer still has tasks referencing it (FK constraint).
        return NextResponse.json(
            { error: "Can't delete a customer that still has tasks. Reassign or delete those tasks first." },
            { status: 409 }
        );
    }
}


