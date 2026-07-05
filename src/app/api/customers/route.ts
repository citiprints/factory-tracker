import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { z } from "zod";

const CreateCustomerSchema = z.object({
    name: z.string().min(1),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    company: z.string().optional(),
    address: z.string().optional(),
});

export async function GET() {
    try {
        const user = await getCurrentUser();
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const customers = await prisma.customer.findMany({ orderBy: { name: "asc" } });
        return NextResponse.json({ customers });
    } catch (error: any) {
        return NextResponse.json({ error: error?.message || "Internal Server Error" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const user = await getCurrentUser();
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const json = await request.json();
        const data = CreateCustomerSchema.parse(json);
        const customer = await prisma.customer.create({ data });
        return NextResponse.json({ customer }, { status: 201 });
    } catch (error: any) {
        if (error instanceof z.ZodError) return NextResponse.json({ error: error.flatten() }, { status: 400 });
        return NextResponse.json({ error: error?.message || "Internal Server Error" }, { status: 500 });
    }
}


