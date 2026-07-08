import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";

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
export const BRANDING_LOGO_KEY = "branding-logo";

/** Fetches the uploaded brand logo from R2. Returns null if none exists yet. */
export async function fetchBrandingLogo(): Promise<{ bytes: Uint8Array; contentType: string } | null> {
	try {
		const res = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: BRANDING_LOGO_KEY }));
		const bytes = await res.Body?.transformToByteArray();
		if (!bytes) return null;
		return { bytes, contentType: res.ContentType || "image/png" };
	} catch {
		return null;
	}
}
