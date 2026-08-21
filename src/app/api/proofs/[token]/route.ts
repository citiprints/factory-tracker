import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { notifyUser } from "@/lib/notify";
import { z } from "zod";

// Public, unauthenticated routes reached via a customer's proof-approval
// link. Never require/read the auth_session cookie, and never return
// anything beyond this task's title and this proof request's own fields.

async function loadProof(token: string) {
	return prisma.proofRequest.findUnique({
		where: { token },
		include: { task: { select: { id: true, title: true } } },
	});
}

function invalidResponse(status: number, message: string) {
	return NextResponse.json({ error: message }, { status });
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ token: string }> }) {
	const { token } = await params;
	const proof = await loadProof(token);
	if (!proof) return invalidResponse(404, "This link isn't valid.");

	if (proof.status !== "PENDING") {
		return NextResponse.json({ status: proof.status, taskTitle: proof.task.title });
	}

	return NextResponse.json({
		status: "PENDING",
		taskTitle: proof.task.title,
		files: JSON.parse(proof.files),
	});
}

const RespondSchema = z.object({
	decision: z.enum(["APPROVED", "REJECTED"]),
	note: z.string().optional(),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
	const { token } = await params;
	const proof = await loadProof(token);
	if (!proof) return invalidResponse(404, "This link isn't valid.");
	if (proof.status !== "PENDING") return invalidResponse(409, "This proof has already been responded to.");

	try {
		const json = await request.json();
		const data = RespondSchema.parse(json);

		await prisma.proofRequest.update({
			where: { id: proof.id },
			data: {
				status: data.decision,
				customerNote: data.note || null,
				respondedAt: new Date(),
			},
		});

		const task = await prisma.task.findUnique({
			where: { id: proof.taskId },
			include: { createdBy: { select: { id: true } }, assignments: { select: { userId: true } } },
		});
		if (task) {
			const recipientIds = Array.from(new Set([task.createdBy.id, ...task.assignments.map((a) => a.userId)]));
			for (const userId of recipientIds) {
				await notifyUser({
					userId,
					title: data.decision === "APPROVED" ? "Proof approved by customer" : "Proof rejected by customer",
					body: task.title,
					type: "GENERAL",
					linkPath: `/tasks?open=${task.id}`,
				}).catch(() => {});
			}
		}

		return NextResponse.json({ status: data.decision });
	} catch (error) {
		if (error instanceof z.ZodError) {
			return NextResponse.json({ error: error.flatten() }, { status: 400 });
		}
		console.error("POST /api/proofs/[token] error:", error);
		return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
	}
}
