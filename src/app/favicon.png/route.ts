import { NextResponse } from "next/server";
import { fetchBrandingLogo } from "@/lib/r2";

const FALLBACK_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">
  <rect width="32" height="32" rx="6" fill="#0e7db8"/>
  <circle cx="16" cy="16" r="9" fill="none" stroke="#ffffff" stroke-width="2"/>
  <circle cx="16" cy="16" r="3" fill="#ffffff"/>
</svg>
`.trim();

export async function GET() {
	const logo = await fetchBrandingLogo();
	if (logo) {
		return new NextResponse(Buffer.from(logo.bytes), {
			headers: {
				"Content-Type": logo.contentType,
				"Cache-Control": "public, max-age=300",
			},
		});
	}
	return new NextResponse(FALLBACK_SVG, {
		headers: {
			"Content-Type": "image/svg+xml",
			"Cache-Control": "public, max-age=300",
		},
	});
}
