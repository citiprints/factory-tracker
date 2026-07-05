import { NextRequest, NextResponse } from "next/server";
import { S3Client, ListObjectsV2Command, HeadObjectCommand } from "@aws-sdk/client-s3";
import { getCurrentUser } from "@/lib/session";

const R2_ENDPOINT = process.env.R2_ENDPOINT!;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID!;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY!;
const R2_BUCKET = process.env.R2_BUCKET!;

const s3Client = new S3Client({
	region: "auto",
	endpoint: R2_ENDPOINT,
	credentials: {
		accessKeyId: R2_ACCESS_KEY_ID,
		secretAccessKey: R2_SECRET_ACCESS_KEY,
	},
});

export async function GET() {
	try {
		// Check authentication
		const user = await getCurrentUser();
		if (!user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		// List all objects in the bucket
		const listCommand = new ListObjectsV2Command({
			Bucket: R2_BUCKET,
		});

		const listResponse = await s3Client.send(listCommand);
		const files = listResponse.Contents || [];

		// Get additional metadata for each file
		const fileInfos = await Promise.all(
			files.map(async (file) => {
				if (!file.Key) return null;

				try {
					// Get file metadata
					const headCommand = new HeadObjectCommand({
						Bucket: R2_BUCKET,
						Key: file.Key,
					});
					const headResponse = await s3Client.send(headCommand);

					return {
						key: file.Key,
						size: file.Size || 0,
						lastModified: file.LastModified || new Date(),
						url: `/api/files/${encodeURIComponent(file.Key)}`,
						contentType: headResponse.ContentType,
					};
				} catch (error) {
					console.error(`Error getting metadata for ${file.Key}:`, error);
					return {
						key: file.Key,
						size: file.Size || 0,
						lastModified: file.LastModified || new Date(),
						url: `/api/files/${encodeURIComponent(file.Key)}`,
						contentType: "application/octet-stream",
					};
				}
			})
		);

		// Filter out null values and sort by last modified (newest first)
		const validFiles = fileInfos
			.filter((file): file is NonNullable<typeof file> => file !== null)
			.sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime());

		return NextResponse.json({ files: validFiles });
	} catch (error) {
		console.error("Error listing files:", error);
		return NextResponse.json({ error: "Failed to list files" }, { status: 500 });
	}
}
