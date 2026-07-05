import { NextRequest, NextResponse } from "next/server";
import { S3Client, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
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

export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ filename: string }> }
) {
	try {
		const { filename } = await params;
		const decodedFilename = decodeURIComponent(filename);

		// Check authentication
		const user = await getCurrentUser();
		if (!user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		// Get the file from R2
		const getCommand = new GetObjectCommand({
			Bucket: R2_BUCKET,
			Key: decodedFilename,
		});

		const response = await s3Client.send(getCommand);
		const stream = response.Body;

		if (!stream) {
			return NextResponse.json({ error: "File not found" }, { status: 404 });
		}

		// Convert stream to buffer
		const chunks: Uint8Array[] = [];
		for await (const chunk of stream as any) {
			chunks.push(chunk);
		}
		const buffer = Buffer.concat(chunks);

		// Return the file with appropriate headers
		return new NextResponse(buffer, {
			headers: {
				"Content-Type": response.ContentType || "application/octet-stream",
				"Content-Length": response.ContentLength?.toString() || buffer.length.toString(),
				"Cache-Control": "no-cache",
			},
		});
	} catch (error) {
		console.error("Error serving file:", error);
		return NextResponse.json({ error: "File not found" }, { status: 404 });
	}
}

export async function DELETE(
	request: NextRequest,
	{ params }: { params: Promise<{ filename: string }> }
) {
	try {
		const { filename } = await params;
		const decodedFilename = decodeURIComponent(filename);

		// Check authentication
		const user = await getCurrentUser();
		if (!user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		// Delete the file from R2
		const deleteCommand = new DeleteObjectCommand({
			Bucket: R2_BUCKET,
			Key: decodedFilename,
		});

		await s3Client.send(deleteCommand);

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("Error deleting file:", error);
		return NextResponse.json({ error: "Failed to delete file" }, { status: 500 });
	}
}
