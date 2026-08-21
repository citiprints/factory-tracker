import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { sendEmail } from "@/lib/email";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { logActivity } from "@/lib/audit";
import { z } from "zod";

const CreateProofRequestSchema = z.object({
	files: z.array(z.object({ url: z.string().min(1), name: z.string().min(1) })).min(1),
});

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const user = await getCurrentUser();
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const { id } = await params;
	const rows = await prisma.proofRequest.findMany({
		where: { taskId: id },
		orderBy: { createdAt: "desc" },
		include: { createdBy: { select: { id: true, name: true } } },
	});
	const proofRequests = rows.map((r) => ({ ...r, files: JSON.parse(r.files) }));

	return NextResponse.json({ proofRequests });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const user = await getCurrentUser();
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	try {
		const { id } = await params;
		const json = await request.json();
		const data = CreateProofRequestSchema.parse(json);

		const task = await prisma.task.findUnique({
			where: { id },
			include: { customerRef: true },
		});
		if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

		const token = randomBytes(32).toString("base64url");
		const proofRequest = await prisma.proofRequest.create({
			data: {
				taskId: id,
				token,
				files: JSON.stringify(data.files),
				createdById: user.id,
			},
		});

		await logActivity({
			entityType: "proof_request",
			entityId: proofRequest.id,
			action: "CREATED",
			actorId: user.id,
			taskId: id,
			after: { fileCount: data.files.length },
		});

		const link = `${request.nextUrl.origin}/proofs/${token}`;
		const customer = task.customerRef;

		if (customer?.email) {
			await sendEmail({
				to: customer.email,
				subject: `Please review the design proof for "${task.title}"`,
				html: `<p>Hi ${customer.name ?? "there"},</p><p>Please review and approve the design proof for <strong>${task.title}</strong> using the secure link below:</p><p><a href="${link}">${link}</a></p>`,
				text: `Please review the design proof for "${task.title}": ${link}`,
			}).catch(() => {});
		}
		if (customer?.phone) {
			await sendWhatsAppMessage({
				to: customer.phone,
				templateName: "proof_ready",
				params: [customer.name ?? "there", task.title, link],
			}).catch(() => {});
		}

		return NextResponse.json({ proofRequest, link }, { status: 201 });
	} catch (error) {
		if (error instanceof z.ZodError) {
			return NextResponse.json({ error: error.flatten() }, { status: 400 });
		}
		console.error("POST /api/tasks/[id]/proof-requests error:", error);
		return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
	}
}
