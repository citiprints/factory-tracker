import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { applyOnboardingSubmission } from "@/lib/onboarding";
import { z } from "zod";

const FillOnboardingFormSchema = z.object({
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

// Staff-side equivalent of a customer submission — used when a customer
// calls/emails their details in instead of using the link themselves.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const user = await getCurrentUser();
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	try {
		const { id } = await params;
		const json = await request.json();
		const data = FillOnboardingFormSchema.parse(json);

		const task = await prisma.task.findUnique({ where: { id } });
		if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

		let form = await prisma.onboardingForm.findFirst({
			where: { taskId: id, status: "PENDING" },
			orderBy: { createdAt: "desc" },
		});

		const fields = {
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
			status: "SUBMITTED" as const,
			submittedAt: new Date(),
			filledByStaffId: user.id,
		};

		if (form) {
			form = await prisma.onboardingForm.update({ where: { id: form.id }, data: fields });
		} else {
			form = await prisma.onboardingForm.create({
				data: {
					taskId: id,
					token: randomBytes(32).toString("base64url"),
					expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
					createdById: user.id,
					...fields,
				},
			});
		}

		await applyOnboardingSubmission(id, data);

		return NextResponse.json({ form });
	} catch (error) {
		if (error instanceof z.ZodError) {
			return NextResponse.json({ error: error.flatten() }, { status: 400 });
		}
		console.error("PATCH /api/tasks/[id]/onboarding-form/fill error:", error);
		return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
	}
}
