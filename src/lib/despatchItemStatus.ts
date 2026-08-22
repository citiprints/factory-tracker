export const DESPATCH_ITEM_STATUS_LABELS: Record<string, string> = {
	PENDING_CLIENT_APPROVAL: "Pending Client Approval",
	PRE_PRODUCTION: "Pre Production",
	PRODUCTION: "Production",
	PACKED: "Packed",
	DESPATCHED: "Despatched",
};

export function despatchItemStatusChipClass(status: string): string {
	if (status === "DESPATCHED") return "chip chip-ok";
	if (status === "PACKED") return "chip chip-warn";
	if (status === "PRODUCTION") return "chip chip-info";
	return "chip chip-plain";
}
