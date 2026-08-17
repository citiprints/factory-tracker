import { prisma } from "@/lib/db";

export type OnboardingSubmission = {
	billingName?: string;
	billingEmail?: string;
	billingPhone?: string;
	billingAddress?: string;
	gstin?: string;
	deliveryContactName?: string;
	deliveryPhone?: string;
	deliveryAddress?: string;
	deliveryNotes?: string;
};

// Patches the task's linked Customer with whatever contact details were
// actually submitted, without ever blanking out data that's already there
// (a customer only filling delivery details shouldn't erase a billing email
// someone else already put on file).
export async function applyOnboardingSubmission(taskId: string, data: OnboardingSubmission) {
	const task = await prisma.task.findUnique({ where: { id: taskId }, select: { customerId: true } });
	if (!task?.customerId) return;

	const email = data.billingEmail?.trim();
	const phone = data.deliveryPhone?.trim() || data.billingPhone?.trim();
	const address = data.deliveryAddress?.trim() || data.billingAddress?.trim();

	const patch: { email?: string; phone?: string; address?: string } = {};
	if (email) patch.email = email;
	if (phone) patch.phone = phone;
	if (address) patch.address = address;

	if (Object.keys(patch).length === 0) return;

	await prisma.customer.update({ where: { id: task.customerId }, data: patch }).catch(() => {});
}
