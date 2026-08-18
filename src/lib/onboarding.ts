import { prisma } from "@/lib/db";

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
// already put on file).
export async function applyOnboardingSubmission(taskId: string, data: OnboardingSubmission) {
	const task = await prisma.task.findUnique({ where: { id: taskId }, select: { customerId: true } });
	if (!task?.customerId) return;

	const patch: Record<string, string> = {};
	for (const [formKey, customerField] of Object.entries(FIELD_MAP) as [keyof OnboardingSubmission, string][]) {
		const value = data[formKey]?.trim();
		if (value) patch[customerField] = value;
	}

	if (Object.keys(patch).length === 0) return;

	await prisma.customer.update({ where: { id: task.customerId }, data: patch }).catch(() => {});
}
