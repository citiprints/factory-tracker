import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, isAdmin } from "@/lib/session";
import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";

const s3 = new S3Client({
	endpoint: process.env.R2_ENDPOINT!,
	region: process.env.R2_REGION || "auto",
	credentials: {
		accessKeyId: process.env.R2_ACCESS_KEY_ID!,
		secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
	},
	forcePathStyle: true,
});

// Neon and R2 free-tier caps as published today -- used only as a reference
// point for the progress bars, not fetched from either provider's billing
// API (neither is configured here). Callers are told to double check the
// exact figure in each dashboard.
const NEON_FREE_TIER_BYTES = 512 * 1024 * 1024; // 0.5 GB
const R2_FREE_TIER_BYTES = 10 * 1024 * 1024 * 1024; // 10 GB

async function getDatabaseSizeBytes(): Promise<number> {
	const rows = await prisma.$queryRaw<{ size: bigint }[]>`SELECT pg_database_size(current_database()) as size`;
	return Number(rows[0]?.size ?? 0);
}

async function getR2UsageBytes(): Promise<{ totalBytes: number; objectCount: number }> {
	const bucket = process.env.R2_BUCKET!;
	let totalBytes = 0;
	let objectCount = 0;
	let continuationToken: string | undefined;

	do {
		const res = await s3.send(
			new ListObjectsV2Command({ Bucket: bucket, ContinuationToken: continuationToken })
		);
		for (const obj of res.Contents ?? []) {
			totalBytes += obj.Size ?? 0;
			objectCount += 1;
		}
		continuationToken = res.IsTruncated ? res.NextContinuationToken : undefined;
	} while (continuationToken);

	return { totalBytes, objectCount };
}

export async function GET() {
	const user = await getCurrentUser();
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	if (!isAdmin(user)) {
		return NextResponse.json({ error: "Only admins/managers can view usage." }, { status: 403 });
	}

	try {
		const [databaseBytes, r2] = await Promise.all([getDatabaseSizeBytes(), getR2UsageBytes()]);

		return NextResponse.json({
			database: {
				usedBytes: databaseBytes,
				freeTierBytes: NEON_FREE_TIER_BYTES,
			},
			files: {
				usedBytes: r2.totalBytes,
				objectCount: r2.objectCount,
				freeTierBytes: R2_FREE_TIER_BYTES,
			},
		});
	} catch (error) {
		console.error("GET /api/usage error:", error);
		return NextResponse.json({ error: "Couldn't compute usage." }, { status: 500 });
	}
}
