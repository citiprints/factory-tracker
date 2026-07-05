import sgMail, { MailDataRequired } from "@sendgrid/mail";

type SendEmailParams = {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  categories?: string[];
  sandboxOverride?: boolean;
};

let isInitialized = false;

function ensureInitialized() {
  if (isInitialized) return;
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) {
    console.warn("SENDGRID_API_KEY is not set. Emails will be skipped.");
    isInitialized = true;
    return;
  }
  sgMail.setApiKey(apiKey);
  isInitialized = true;
}

export async function sendEmail(params: SendEmailParams) {
  ensureInitialized();

  const fromEmail = process.env.SENDGRID_FROM_EMAIL;
  const fromName = process.env.SENDGRID_FROM_NAME || "Rigid Box Tracker";
  const defaultSandbox = (process.env.SENDGRID_SANDBOX || "true").toLowerCase() === "true";
  const sandboxEnabled = params.sandboxOverride ?? defaultSandbox;

  if (!fromEmail) {
    console.warn("SENDGRID_FROM_EMAIL is not set. Skipping email send.");
    return { skipped: true };
  }

  if (!params.html && !params.text) {
    throw new Error("Either html or text must be provided for email content");
  }

  const content: { type: string; value: string }[] = [];
  if (params.text) {
    content.push({ type: "text/plain", value: params.text });
  }
  if (params.html) {
    content.push({ type: "text/html", value: params.html });
  }

  const message: any = {
    to: params.to,
    from: { email: fromEmail, name: fromName },
    subject: params.subject,
    content,
    categories: params.categories,
    mailSettings: {
      sandboxMode: { enable: sandboxEnabled },
    },
  } as MailDataRequired;

  // If API key missing, sgMail won't be configured — skip safely
  if (!process.env.SENDGRID_API_KEY) {
    return { skipped: true };
  }

  const [response] = await sgMail.send(message as MailDataRequired);
  return { statusCode: response.statusCode };
}


