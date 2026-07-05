// FORCE REBUILD - R2 UPLOAD CODE - DO NOT USE FILESYSTEM
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const R2_ENDPOINT = process.env.R2_ENDPOINT!;
const R2_REGION = process.env.R2_REGION || "auto";
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID!;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY!;
const R2_BUCKET = process.env.R2_BUCKET!;
const R2_PUBLIC_BASE = process.env.R2_PUBLIC_BASE; // optional: https://<accountid>.r2.cloudflarestorage.com/<bucket>

const s3 = new S3Client({
	endpoint: R2_ENDPOINT,
	region: R2_REGION,
	credentials: {
		accessKeyId: R2_ACCESS_KEY_ID,
		secretAccessKey: R2_SECRET_ACCESS_KEY,
	},
	forcePathStyle: true, // important for R2
});

export async function POST_R2_UPLOAD(request: NextRequest) {
	const user = await getCurrentUser();
	if (!user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	try {
		const formData = await request.formData();
		const file = formData.get("file") as File;

		if (!file) {
			return NextResponse.json({ error: "No file provided" }, { status: 400 });
		}

		const timestamp = Date.now();
		const originalName = file.name;
		const safeName = originalName.replace(/\s+/g, "_");
		const key = `${timestamp}-${safeName}`;

		const bytes = await file.arrayBuffer();
		const buffer = Buffer.from(bytes);

		await s3.send(new PutObjectCommand({
			Bucket: R2_BUCKET,
			Key: key,
			Body: buffer,
			ContentType: file.type || "application/octet-stream",
			// CacheControl: "public, max-age=31536000, immutable", // uncomment if you want long cache
		}));

		// Return URL that points to our proxy endpoint
		const url = `/api/files/${encodeURIComponent(key)}`;

		return NextResponse.json({
			filename: key,
			originalName,
			url,
		});
	} catch (error) {
		console.error("R2 upload error:", error);
		return NextResponse.json({ error: "Failed to upload file" }, { status: 500 });
	}
}

// Alias for backward compatibility
export const POST = POST_R2_UPLOAD;