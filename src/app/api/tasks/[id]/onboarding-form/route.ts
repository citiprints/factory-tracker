import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { sendEmail } from "@/lib/email";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { z } from "zod";

const ONBOARDING_FORM_TTL_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

const CreateOnboardingFormSchema = z.object({
	sendEmail: z.boolean().optional(),
});

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const user = await getCurrentUser();
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const { id } = await params;
	const form = await prisma.onboardingForm.findFirst({
		where: { taskId: id, status: { not: "REVOKED" } },
		orderBy: { createdAt: "desc" },
		include: { filledByStaff: { select: { id: true, name: true } } },
	});

	return NextResponse.json({ form });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const user = await getCurrentUser();
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	try {
		const { id } = await params;
		const json = await request.json().catch(() => ({}));
		const data = CreateOnboardingFormSchema.parse(json);

		const task = await prisma.task.findUnique({
			where: { id },
			include: { customerRef: true },
		});
		if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

		// A resend is a revoke-and-reissue: the old link must stop working
		// the moment a new one exists, in case it was already shared/leaked.
		await prisma.onboardingForm.updateMany({
			where: { taskId: id, status: "PENDING" },
			data: { status: "REVOKED" },
		});

		// The Customer record is the one source of truth for these fields —
		// prefill from whatever's already on file so the customer only has to
		// confirm/edit rather than retype everything from scratch.
		const customer = task.customerRef;
		const token = randomBytes(32).toString("base64url");
		const form = await prisma.onboardingForm.create({
			data: {
				taskId: id,
				token,
				expiresAt: new Date(Date.now() + ONBOARDING_FORM_TTL_MS),
				createdById: user.id,
				billingName: customer?.name,
				billingEmail: customer?.email,
				billingPhone: customer?.phone,
				billingSecondaryPhone: customer?.secondaryPhone,
				billingAddress: customer?.address,
				gstin: customer?.gstin,
				deliveryContactName: customer?.deliveryContactName,
				deliveryPhone: customer?.deliveryPhone,
				deliverySecondaryPhone: customer?.deliverySecondaryPhone,
				deliveryAddress: customer?.deliveryAddress,
				deliveryNotes: customer?.deliveryNotes,
			},
		});

		const link = `${request.nextUrl.origin}/forms/${token}`;

		if (data.sendEmail) {
			const customerEmail = task.customerRef?.email;
			if (!customerEmail) {
				return NextResponse.json(
					{ error: "This task's customer has no email on file", form, link },
					{ status: 200 }
				);
			}
			await sendEmail({
				to: customerEmail,
				subject: `Please complete your details for "${task.title}"`,
				html: `<p>Hi ${task.customerRef?.name ?? "there"},</p><p>Please fill in your billing and delivery details for <strong>${task.title}</strong> using the secure link below:</p><p><a href="${link}">${link}</a></p><p>This link expires in 14 days.</p>`,
				text: `Please fill in your billing and delivery details for "${task.title}": ${link} (expires in 14 days)`,
			});
		}

		if (task.customerRef?.phone) {
			await sendWhatsAppMessage({
				to: task.customerRef.phone,
				templateName: "onboarding_link",
				params: [task.customerRef.name ?? "there", task.title, link],
			}).catch(() => {});
		}

		return NextResponse.json({ form, link }, { status: 201 });
	} catch (error) {
		if (error instanceof z.ZodError) {
			return NextResponse.json({ error: error.flatten() }, { status: 400 });
		}
		console.error("POST /api/tasks/[id]/onboarding-form error:", error);
		return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
	}
}
