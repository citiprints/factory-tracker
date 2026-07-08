import { NextResponse } from "next/server";
import { getCurrentUser, isAdmin } from "@/lib/session";

// Temporary diagnostic route — safe to delete once checked. Never echoes
// the actual DATABASE_URL, only reports characteristics of it.
export async function GET() {
	const user = await getCurrentUser();
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	if (!isAdmin(user)) return NextResponse.json({ error: "Admins only" }, { status: 403 });

	const url = process.env.DATABASE_URL || "";
	let host = null;
	try {
		host = new URL(url).hostname;
	} catch {
		// leave null if it doesn't parse as a URL
	}

	return NextResponse.json({
		isPooledConnection: url.includes("-pooler."),
		hostSuffix: host ? host.split(".").slice(-3).join(".") : null, // e.g. "us-east-2.aws.neon.tech" — identifies region, not the secret
		hasPgBouncerParam: url.includes("pgbouncer=true"),
		hasConnectionLimitParam: /connection_limit=\d+/.test(url),
	});
}
