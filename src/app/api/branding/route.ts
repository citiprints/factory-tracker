import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, isAdmin } from "@/lib/session";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";

const s3 = new S3Client({
	endpoint: process.env.R2_ENDPOINT!,
	region: process.env.R2_REGION || "auto",
	credentials: {
		accessKeyId: process.env.R2_ACCESS_KEY_ID!,
		secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
	},
	forcePathStyle: true,
});

const BUCKET = process.env.R2_BUCKET!;
const LOGO_KEY = "branding-logo"; // fixed key: uploading again replaces it

export async function GET() {
	try {
		const res = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: LOGO_KEY }));
		const bytes = await res.Body?.transformToByteArray();
		if (!bytes) return new NextResponse(null, { status: 404 });
		return new NextResponse(Buffer.from(bytes), {
			headers: {
				"Content-Type": res.ContentType || "image/png",
				// Short cache so a replaced logo shows up quickly.
				"Cache-Control": "public, max-age=300",
			},
		});
	} catch {
		return new NextResponse(null, { status: 404 });
	}
}

export async function POST(request: NextRequest) {
	const user = await getCurrentUser();
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	if (!isAdmin(user)) {
		return NextResponse.json({ error: "Only admins/managers can change the logo." }, { status: 403 });
	}

	try {
		const formData = await request.formData();
		const file = formData.get("file") as File;
		if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
		if (!file.type.startsWith("image/")) {
			return NextResponse.json({ error: "The logo must be an image (PNG, JPG, SVG, or WebP)." }, { status: 400 });
		}
		if (file.size > 2 * 1024 * 1024) {
			return NextResponse.json({ error: "Keep the logo under 2 MB." }, { status: 400 });
		}

		const buffer = Buffer.from(await file.arrayBuffer());
		await s3.send(
			new PutObjectCommand({
				Bucket: BUCKET,
				Key: LOGO_KEY,
				Body: buffer,
				ContentType: file.type,
			})
		);
		return NextResponse.json({ ok: true });
	} catch (error) {
		console.error("Branding upload error:", error);
		return NextResponse.json({ error: "Failed to upload logo" }, { status: 500 });
	}
}
