import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { z } from "zod";

const UpdateFieldSchema = z.object({
    label: z.string().min(1).optional(),
    type: z.enum(["TEXT","NUMBER","DATE","BOOLEAN"]).optional(),
    required: z.boolean().optional(),
    order: z.number().int().optional()
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    try {
        const json = await request.json();
        const data = UpdateFieldSchema.parse(json);
        const { id } = await params;
        const field = await prisma.customFieldDef.update({
            where: { id },
            data: {
                ...(data.label !== undefined ? { label: data.label } : {}),
                ...(data.type !== undefined ? { type: data.type } : {}),
                ...(data.required !== undefined ? { required: data.required } : {}),
                ...(data.order !== undefined ? { order: data.order } : {}),
            }
        });
        return NextResponse.json({ field });
    } catch (error) {
        if (error instanceof z.ZodError) return NextResponse.json({ error: error.flatten() }, { status: 400 });
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    try {
        const { id } = await params;
        await prisma.customFieldDef.delete({ where: { id } });
        return NextResponse.json({ ok: true });
    } catch (error) {
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}


