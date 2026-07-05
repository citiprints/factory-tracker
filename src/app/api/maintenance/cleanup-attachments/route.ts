import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";

const R2_ENDPOINT = process.env.R2_ENDPOINT!;
const R2_REGION = process.env.R2_REGION || "auto";
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID!;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY!;
const R2_BUCKET = process.env.R2_BUCKET!;
const CRON_SECRET = process.env.CRON_SECRET;

const s3 = new S3Client({
	endpoint: R2_ENDPOINT,
	region: R2_REGION,
	credentials: {
		accessKeyId: R2_ACCESS_KEY_ID,
		secretAccessKey: R2_SECRET_ACCESS_KEY,
	},
	forcePathStyle: true,
});

function extractKeyFromUrl(url: string): string | null {
	// Expecting '/api/files/<encoded key>' or possibly full URL containing that path
	try {
		const idx = url.indexOf("/api/files/");
		if (idx >= 0) {
			const part = url.slice(idx + "/api/files/".length);
			return decodeURIComponent(part);
		}
		// Fallback: if it's a bare key
		if (!url.includes("://") && !url.startsWith("/")) {
			return url;
		}
		return null;
	} catch {
		return null;
	}
}

export async function POST(request: NextRequest) {
	// Auth: allow either admin user, valid cron secret header, or Vercel Cron invocations
	const secretHeader = request.headers.get("x-cron-secret");
	const vercelCronHeader = request.headers.get("x-vercel-cron");
	let isAuthorized = false;
	if (vercelCronHeader) {
		isAuthorized = true;
	} else if (CRON_SECRET && secretHeader && secretHeader === CRON_SECRET) {
		isAuthorized = true;
	} else {
		const user = await getCurrentUser();
		if (user && (user as any).role === "ADMIN") {
			isAuthorized = true;
		}
	}
	if (!isAuthorized) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const { searchParams } = new URL(request.url);
	const daysParam = Number(searchParams.get("days") || "10");
	const days = Number.isFinite(daysParam) && daysParam > 0 ? daysParam : 10;
	const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

	const processedKeys = new Set<string>();
	let deletedCount = 0;
	let clearedRefs = 0;

	// 1) Handle attachments referenced in customFields.attachments
	const archivedTasks = await prisma.task.findMany({
		where: {
			status: "ARCHIVED",
			updatedAt: { lt: cutoff },
		},
		select: { id: true, customFields: true },
	});

	for (const t of archivedTasks) {
		let cf: any = {};
		if (typeof t.customFields === "string") {
			try { cf = JSON.parse(t.customFields); } catch { cf = {}; }
		} else if (t.customFields && typeof t.customFields === "object") {
			cf = t.customFields as any;
		}

		if (Array.isArray(cf.attachments) && cf.attachments.length > 0) {
			const remaining: string[] = [];
			for (const url of cf.attachments as string[]) {
				const key = extractKeyFromUrl(url);
				if (key && !processedKeys.has(key)) {
					try {
						await s3.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key }));
						processedKeys.add(key);
						deletedCount++;
						continue; // skip adding to remaining
					} catch (err) {
						// If delete fails, keep the reference
						remaining.push(url);
					}
				} else {
					remaining.push(url);
				}
			}
			if (remaining.length !== cf.attachments.length) {
				cf.attachments = remaining;
				await prisma.task.update({
					where: { id: t.id },
					data: { customFields: JSON.stringify(cf) },
				});
				clearedRefs++;
			}
		}
	}

	// 2) Handle Attachment rows (if any) tied to archived tasks
	const dbAttachments = await prisma.attachment.findMany({
		where: {
			task: { status: "ARCHIVED", updatedAt: { lt: cutoff } },
		},
		select: { id: true, url: true },
	});
	if (dbAttachments.length > 0) {
		for (const att of dbAttachments) {
			const key = extractKeyFromUrl(att.url);
			if (key && !processedKeys.has(key)) {
				try {
					await s3.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key }));
					processedKeys.add(key);
					deletedCount++;
				} catch {}
			}
		}
		// Clean DB rows regardless of R2 outcome to avoid dangling refs
		await prisma.attachment.deleteMany({
			where: { id: { in: dbAttachments.map(a => a.id) } },
		});
	}

	return NextResponse.json({ ok: true, deletedObjects: deletedCount, tasksUpdated: clearedRefs, cutoff: cutoff.toISOString() });
}

export const GET = POST;
