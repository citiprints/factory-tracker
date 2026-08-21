import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, isAdmin } from "@/lib/session";
import { S3Client, ListObjectsV2Command, GetObjectCommand } from "@aws-sdk/client-s3";
import { ZipArchive } from "archiver";
import { PassThrough } from "stream";

export const maxDuration = 300;

const s3 = new S3Client({
	endpoint: process.env.R2_ENDPOINT!,
	region: process.env.R2_REGION || "auto",
	credentials: {
		accessKeyId: process.env.R2_ACCESS_KEY_ID!,
		secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
	},
	forcePathStyle: true,
});

async function streamToBuffer(stream: any): Promise<Buffer> {
	const chunks: Buffer[] = [];
	for await (const chunk of stream) chunks.push(chunk);
	return Buffer.concat(chunks);
}

// Tables backed up as flat JSON, one file per table under data/. Deliberately
// excludes Session (bearer credentials, meaningless outside this deployment),
// PushSubscription (device tokens, no backup value), and Notification
// (transient UI state, not business data). User rows never include the
// password hash -- see the `select` below -- a backup file that leaves this
// machine shouldn't carry credential material.
async function collectTables() {
	const [
		users, customers, tasks, subtasks, despatchItems, payments,
		onboardingForms, teams, teamMembers, taskTeamAssignments, comments,
		attachments, activityLog, categories, categoryFields, shifts,
		attendanceLogs, locations,
	] = await Promise.all([
		prisma.user.findMany({ select: { id: true, name: true, email: true, role: true, active: true, phone: true, createdAt: true } }),
		prisma.customer.findMany(),
		prisma.task.findMany(),
		prisma.subtask.findMany(),
		prisma.despatchItem.findMany(),
		prisma.payment.findMany(),
		prisma.onboardingForm.findMany(),
		prisma.team.findMany(),
		prisma.teamMember.findMany(),
		prisma.taskTeamAssignment.findMany(),
		prisma.comment.findMany(),
		prisma.attachment.findMany(),
		prisma.activityLog.findMany(),
		prisma.taskCategory.findMany(),
		prisma.taskCategoryField.findMany(),
		prisma.shift.findMany(),
		prisma.attendanceLog.findMany(),
		prisma.location.findMany(),
	]);

	return {
		users, customers, tasks, subtasks, despatchItems, payments,
		onboardingForms, teams, teamMembers, taskTeamAssignments, comments,
		attachments, activityLog, categories, categoryFields, shifts,
		attendanceLogs, locations,
	};
}

async function listAllR2Objects() {
	const bucket = process.env.R2_BUCKET!;
	const objects: { key: string; size: number }[] = [];
	let continuationToken: string | undefined;
	do {
		const res = await s3.send(new ListObjectsV2Command({ Bucket: bucket, ContinuationToken: continuationToken }));
		for (const obj of res.Contents ?? []) {
			if (obj.Key) objects.push({ key: obj.Key, size: obj.Size ?? 0 });
		}
		continuationToken = res.IsTruncated ? res.NextContinuationToken : undefined;
	} while (continuationToken);
	return objects;
}

export async function GET() {
	const user = await getCurrentUser();
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	if (!isAdmin(user)) return NextResponse.json({ error: "Admins only." }, { status: 403 });

	try {
		const bucket = process.env.R2_BUCKET!;
		const [tables, objects] = await Promise.all([collectTables(), listAllR2Objects()]);

		const archive = new ZipArchive({ zlib: { level: 9 } });
		const passthrough = new PassThrough();
		const chunks: Buffer[] = [];
		passthrough.on("data", (chunk: Buffer) => chunks.push(chunk));
		const done = new Promise<void>((resolve, reject) => {
			passthrough.on("end", resolve);
			archive.on("error", reject);
		});
		archive.pipe(passthrough);

		archive.append(
			JSON.stringify(
				{
					app: "Factory Tracker (Wrapzone / Citiprints)",
					generatedAt: new Date().toISOString(),
					generatedBy: { id: user.id, name: user.name, email: user.email },
					tables: Object.keys(tables),
					fileCount: objects.length,
					excludes: [
						"User.password (credential hash, never leaves the server)",
						"Session (bearer tokens, meaningless outside this deployment)",
						"PushSubscription (device push tokens)",
						"Notification (transient UI state)",
					],
				},
				null,
				2
			),
			{ name: "manifest.json" }
		);

		for (const [name, rows] of Object.entries(tables)) {
			archive.append(JSON.stringify(rows, null, 2), { name: `data/${name}.json` });
		}

		for (const obj of objects) {
			try {
				const res = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: obj.key }));
				if (!res.Body) continue;
				const buffer = await streamToBuffer(res.Body);
				archive.append(buffer, { name: `files/${obj.key}` });
			} catch (err) {
				console.error(`Backup: failed to fetch R2 object ${obj.key}, skipping:`, err);
			}
		}

		await archive.finalize();
		await done;
		const zipBuffer = Buffer.concat(chunks);

		const dateStamp = new Date().toISOString().slice(0, 10);
		return new NextResponse(zipBuffer, {
			headers: {
				"Content-Type": "application/zip",
				"Content-Disposition": `attachment; filename="factory-tracker-backup-${dateStamp}.zip"`,
				"Content-Length": String(zipBuffer.length),
			},
		});
	} catch (error) {
		console.error("GET /api/backup error:", error);
		return NextResponse.json({ error: "Couldn't generate the backup." }, { status: 500 });
	}
}
