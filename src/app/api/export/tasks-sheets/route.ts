import { NextResponse } from "next/server";

export async function POST() {
	return NextResponse.json({
		message: "Google Sheets export not configured. Set GOOGLE_SHEETS_CREDENTIALS and SHEET_ID in .env, then implement using googleapis sheets.v4."
	}, { status: 501 });
}
