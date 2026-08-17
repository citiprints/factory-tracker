import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { applyOnboardingSubmission } from "@/lib/onboarding";
import { notifyUser } from "@/lib/notify";
import { z } from "zod";

// Public, unauthenticated routes reached via a customer's onboarding link.
// Never require/read the auth_session cookie, and never return anything
// beyond the task title and this form's own fields.

async function loadForm(token: string) {
	return prisma.onboardingForm.findUnique({
		where: { token },
		include: { task: { select: { id: true, title: true } } },
	});
}

// Same generic message regardless of *why* the token doesn't work — don't
// give a stranger holding a dead/guessed link any signal about which case it is.
function invalidResponse(status: number, message: string) {
	return NextResponse.json({ error: message }, { status });
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ token: string }> }) {
	const { token } = await params;
	const form = await loadForm(token);
	if (!form) return invalidResponse(404, "This link isn't valid.");
	if (form.status === "REVOKED") return invalidResponse(410, "This link is no longer valid.");
	if (form.expiresAt.getTime() < Date.now()) return invalidResponse(410, "This link has expired.");

	if (form.status === "SUBMITTED") {
		return NextResponse.json({ status: "SUBMITTED", taskTitle: form.task.title });
	}

	return NextResponse.json({
		status: "PENDING",
		taskTitle: form.task.title,
		values: {
			billingName: form.billingName,
			billingEmail: form.billingEmail,
			billingPhone: form.billingPhone,
			billingSecondaryPhone: form.billingSecondaryPhone,
			billingAddress: form.billingAddress,
			gstin: form.gstin,
			deliveryContactName: form.deliveryContactName,
			deliveryPhone: form.deliveryPhone,
			deliverySecondaryPhone: form.deliverySecondaryPhone,
			deliveryAddress: form.deliveryAddress,
			deliveryNotes: form.deliveryNotes,
		},
	});
}

const SubmitOnboardingFormSchema = z.object({
	billingName: z.string().min(1),
	billingEmail: z.string().email().optional().or(z.literal("")),
	billingPhone: z.string().min(1, "Phone number is required"),
	billingSecondaryPhone: z.string().optional(),
	billingAddress: z.string().min(1),
	gstin: z.string().optional(),
	deliveryContactName: z.string().optional(),
	deliveryPhone: z.string().optional(),
	deliverySecondaryPhone: z.string().optional(),
	deliveryAddress: z.string().min(1),
	deliveryNotes: z.string().optional(),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
	const { token } = await params;
	const form = await loadForm(token);
	if (!form) return invalidResponse(404, "This link isn't valid.");
	if (form.status === "REVOKED") return invalidResponse(410, "This link is no longer valid.");
	if (form.expiresAt.getTime() < Date.now()) return invalidResponse(410, "This link has expired.");
	if (form.status === "SUBMITTED") return invalidResponse(409, "This form has already been submitted.");

	try {
		const json = await request.json();
		const data = SubmitOnboardingFormSchema.parse(json);

		await prisma.onboardingForm.update({
			where: { id: form.id },
			data: {
				billingName: data.billingName,
				billingEmail: data.billingEmail || null,
				billingPhone: data.billingPhone || null,
				billingSecondaryPhone: data.billingSecondaryPhone || null,
				billingAddress: data.billingAddress,
				gstin: data.gstin || null,
				deliveryContactName: data.deliveryContactName || null,
				deliveryPhone: data.deliveryPhone || null,
				deliverySecondaryPhone: data.deliverySecondaryPhone || null,
				deliveryAddress: data.deliveryAddress,
				deliveryNotes: data.deliveryNotes || null,
				status: "SUBMITTED",
				submittedAt: new Date(),
			},
		});

		await applyOnboardingSubmission(form.taskId, data);

		const task = await prisma.task.findUnique({
			where: { id: form.taskId },
			include: { createdBy: { select: { id: true } }, assignments: { select: { userId: true } } },
		});
		if (task) {
			const recipientIds = Array.from(
				new Set([task.createdBy.id, ...task.assignments.map((a) => a.userId)])
			);
			for (const userId of recipientIds) {
				await notifyUser({
					userId,
					title: "Customer submitted onboarding details",
					body: task.title,
					type: "GENERAL",
					linkPath: `/tasks?open=${task.id}`,
				}).catch(() => {});
			}
		}

		return NextResponse.json({ status: "SUBMITTED" });
	} catch (error) {
		if (error instanceof z.ZodError) {
			return NextResponse.json({ error: error.flatten() }, { status: 400 });
		}
		console.error("POST /api/forms/[token] error:", error);
		return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
	}
}
