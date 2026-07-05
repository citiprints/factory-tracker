import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/session";
import { sendEmail } from "@/lib/email";

const SendEmailSchema = z.object({
  to: z.union([z.string().email(), z.array(z.string().email()).nonempty()]),
  subject: z.string().min(1),
  text: z.string().optional(),
  html: z.string().optional(),
  categories: z.array(z.string()).optional(),
  sandboxOverride: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const json = await req.json();
    const parsed = SendEmailSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
    }

    const { to, subject, text, html, categories, sandboxOverride } = parsed.data;
    const result = await sendEmail({ to, subject, text, html, categories, sandboxOverride });

    return NextResponse.json({ ok: true, result });
  } catch (error) {
    console.error("/api/email/send error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}



