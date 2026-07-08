import { NextResponse } from "next/server";
import { fetchBrandingLogo } from "@/lib/r2";

const FALLBACK_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" rx="74" fill="#0e7db8"/>
  <circle cx="256" cy="256" r="138" fill="none" stroke="#ffffff" stroke-width="26"/>
  <circle cx="256" cy="256" r="48" fill="#ffffff"/>
  <path d="M256 54v96M256 362v96M54 256h96M362 256h96" stroke="#ffffff" stroke-width="26" stroke-linecap="round"/>
</svg>
`.trim();

export async function GET() {
	const logo = await fetchBrandingLogo();
	if (logo) {
		return new NextResponse(Buffer.from(logo.bytes), {
			headers: {
				"Content-Type": logo.contentType,
				"Cache-Control": "public, max-age=30, must-revalidate",
			},
		});
	}
	return new NextResponse(FALLBACK_SVG, {
		headers: {
			"Content-Type": "image/svg+xml",
			"Cache-Control": "public, max-age=30, must-revalidate",
		},
	});
}
