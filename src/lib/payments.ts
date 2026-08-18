import { prisma } from "@/lib/db";
import { isAdmin, type SafeUser } from "@/lib/session";

// Payment data is sensitive financial info — restricted to admins/managers
// and members of the "Accounts" team, independent of task assignment (an
// Accounts-team member handles payments for jobs they aren't
// production-assigned to).
export async function canAccessPayments(user: SafeUser | null): Promise<boolean> {
	if (!user) return false;
	if (isAdmin(user)) return true;
	const membership = await prisma.teamMember.findFirst({
		where: { userId: user.id, team: { name: "Accounts" } },
	});
	return !!membership;
}
