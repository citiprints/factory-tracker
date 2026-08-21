import { prisma } from "@/lib/db";
import { logActivity } from "@/lib/audit";

export type OnboardingSubmission = {
	billingName?: string;
	billingEmail?: string;
	billingPhone?: string;
	billingSecondaryPhone?: string;
	billingAddress?: string;
	gstin?: string;
	deliveryContactName?: string;
	deliveryPhone?: string;
	deliverySecondaryPhone?: string;
	deliveryAddress?: string;
	deliveryNotes?: string;
};

// Onboarding fields map straight onto their Customer counterparts — the
// Customer record is the one source of truth these forms read from
// (pre-fill, see the onboarding-form POST route) and write back to.
const FIELD_MAP: Record<keyof OnboardingSubmission, string> = {
	billingName: "name",
	billingEmail: "email",
	billingPhone: "phone",
	billingSecondaryPhone: "secondaryPhone",
	billingAddress: "address",
	gstin: "gstin",
	deliveryContactName: "deliveryContactName",
	deliveryPhone: "deliveryPhone",
	deliverySecondaryPhone: "deliverySecondaryPhone",
	deliveryAddress: "deliveryAddress",
	deliveryNotes: "deliveryNotes",
};

// Patches the task's linked Customer with whatever details were actually
// submitted, without ever blanking out data that's already there (filling
// in only the delivery section shouldn't erase a billing email someone else
// already put on file). If the task has no linked Customer yet -- created
// without one, then onboarded afterward -- creates one from the submission
// instead of silently discarding the details (previously this just
// returned early, so a task created without an upfront customer never got
// one even after the form was filled in and submitted).
//
// actorId is only available for the staff "fill in manually" path, not the
// customer's own public form submission -- passed through to the audit log
// when present, omitted (no log entry) otherwise, same as every other
// no-authenticated-actor case in the audit trail.
export async function applyOnboardingSubmission(taskId: string, data: OnboardingSubmission, actorId?: string) {
	const task = await prisma.task.findUnique({ where: { id: taskId }, select: { customerId: true } });
	if (!task) return;

	if (!task.customerId) {
		const name = data.billingName?.trim();
		const email = data.billingEmail?.trim();
		const phone = data.billingPhone?.trim();
		// Same minimum the Customer creation API enforces: a name, and at
		// least one way to reach them.
		if (!name || (!email && !phone)) return;

		const customer = await prisma.customer.create({
			data: {
				name,
				email: email || undefined,
				phone: phone || undefined,
				secondaryPhone: data.billingSecondaryPhone?.trim() || undefined,
				address: data.billingAddress?.trim() || undefined,
				gstin: data.gstin?.trim() || undefined,
				deliveryContactName: data.deliveryContactName?.trim() || undefined,
				deliveryPhone: data.deliveryPhone?.trim() || undefined,
				deliverySecondaryPhone: data.deliverySecondaryPhone?.trim() || undefined,
				deliveryAddress: data.deliveryAddress?.trim() || undefined,
				deliveryNotes: data.deliveryNotes?.trim() || undefined,
			},
		});
		await prisma.task.update({ where: { id: taskId }, data: { customerId: customer.id } });
		if (actorId) {
			await logActivity({
				entityType: "customer",
				entityId: customer.id,
				action: "CREATED",
				actorId,
				taskId,
				after: { name: customer.name, email: customer.email, phone: customer.phone },
			});
		}
		return;
	}

	const patch: Record<string, string> = {};
	for (const [formKey, customerField] of Object.entries(FIELD_MAP) as [keyof OnboardingSubmission, string][]) {
		const value = data[formKey]?.trim();
		if (value) patch[customerField] = value;
	}

	if (Object.keys(patch).length === 0) return;

	await prisma.customer.update({ where: { id: task.customerId }, data: patch }).catch(() => {});
}
