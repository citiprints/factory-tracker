import { NextResponse } from "next/server";
import { fetchBrandingLogo } from "@/lib/r2";

// Registration-mark SVG matching the sidebar's fallback BrandMark, used
// until an admin uploads a real logo via Files → Set brand logo.
const FALLBACK_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192" width="192" height="192">
  <rect width="192" height="192" rx="28" fill="#0e7db8"/>
  <circle cx="96" cy="96" r="52" fill="none" stroke="#ffffff" stroke-width="10"/>
  <circle cx="96" cy="96" r="18" fill="#ffffff"/>
  <path d="M96 20v36M96 136v36M20 96h36M136 96h36" stroke="#ffffff" stroke-width="10" stroke-linecap="round"/>
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
