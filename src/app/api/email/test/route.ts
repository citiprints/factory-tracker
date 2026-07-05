import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { sendEmail } from "@/lib/email";

export async function POST(_req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const to = process.env.SENDGRID_TEST_TO || user.email || "";
    if (!to) {
      return NextResponse.json({ error: "No test recipient available" }, { status: 400 });
    }

    const html = `
      <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;">
        <h2>Rigid Box Tracker · Test Email</h2>
        <p>This is a test email from your development environment.</p>
        <p>Time: ${new Date().toISOString()}</p>
      </div>
    `;

    const result = await sendEmail({
      to,
      subject: "Test Email · Rigid Box Tracker",
      html,
      text: "This is a test email from Rigid Box Tracker.",
      categories: ["test"],
    });

    return NextResponse.json({ ok: true, to, result });
  } catch (error) {
    console.error("/api/email/test error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}



