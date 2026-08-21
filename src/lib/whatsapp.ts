type SendWhatsAppParams = {
	to: string; // phone number, any format -- normalized to digits-only + country code below
	templateName: string; // must match an approved template in Meta Business Manager
	languageCode?: string;
	params: string[]; // positional template variables, in order
};

// Meta's WhatsApp Cloud API requires pre-approved message *templates* for
// any business-initiated message -- no freeform text. Same no-op-when-
// unconfigured shape as src/lib/email.ts (SENDGRID_API_KEY) and
// src/lib/firebase-admin.ts (firebaseAdminApp()): until WHATSAPP_PHONE_NUMBER_ID
// and WHATSAPP_ACCESS_TOKEN are set, every call below is a harmless no-op.
export async function sendWhatsAppMessage({ to, templateName, languageCode = "en", params }: SendWhatsAppParams): Promise<{ skipped: boolean }> {
	const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
	const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

	if (!phoneNumberId || !accessToken) {
		console.warn("WhatsApp not configured (WHATSAPP_PHONE_NUMBER_ID/WHATSAPP_ACCESS_TOKEN unset), skipping message");
		return { skipped: true };
	}

	// Digits only, dropping any leading 0 -- Meta expects E.164 without a
	// leading "+". This does not guess a missing country code.
	const normalizedTo = to.replace(/[^\d]/g, "");
	if (!normalizedTo) return { skipped: true };

	try {
		const res = await fetch(`https://graph.facebook.com/v20.0/${phoneNumberId}/messages`, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${accessToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				messaging_product: "whatsapp",
				to: normalizedTo,
				type: "template",
				template: {
					name: templateName,
					language: { code: languageCode },
					components: [
						{
							type: "body",
							parameters: params.map((text) => ({ type: "text", text })),
						},
					],
				},
			}),
		});
		if (!res.ok) {
			console.error("WhatsApp send failed (non-fatal):", res.status, await res.text().catch(() => ""));
		}
	} catch (err) {
		console.error("WhatsApp send failed (non-fatal):", err);
	}

	return { skipped: false };
}
