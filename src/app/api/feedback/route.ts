// POST /api/feedback — submit user feedback / bug report.

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { recordAudit } from "@/lib/osint/audit";
import { safeErrorResponse } from "@/lib/osint/safe-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: {
    kind?: string;
    subject?: string;
    body?: string;
    contact?: string;
    severity?: string;
    routeName?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const subject = (body.subject || "").trim();
  const text = (body.body || "").trim();

  if (!subject) {
    return NextResponse.json({ error: "subject is required" }, { status: 400 });
  }
  if (subject.length > 500) {
    return NextResponse.json({ error: "subject too long (max 500)" }, { status: 400 });
  }
  if (!text) {
    return NextResponse.json({ error: "body is required" }, { status: 400 });
  }
  if (text.length > 5000) {
    return NextResponse.json({ error: "body too long (max 5000)" }, { status: 400 });
  }

  const kind = (body.kind || "feedback").trim().slice(0, 32);
  const contact = (body.contact || "").trim().slice(0, 256);
  const severity = (body.severity || "normal").trim().slice(0, 32);
  const routeName = (body.routeName || "").trim().slice(0, 128);

  // Optional userAgent (for diagnostics) — read from headers if present
  const userAgent = req.headers.get("user-agent") || "";

  try {
    const id = crypto.randomUUID();
    await db.feedback.create({
      data: {
        id,
        kind,
        subject,
        body: text,
        contact,
        severity,
        routeName,
        userAgent,
      },
    });

    await recordAudit({
      action: "feedback.submit",
      category: "system",
      resourceType: "feedback",
      resourceId: id,
      detail: `Feedback submitted: "${subject}"`,
      actorType: "user",
      metadata: { kind, severity, routeName },
    });

    return NextResponse.json({ success: true, id }, { status: 201 });
  } catch (e) {
    return safeErrorResponse(e, "Failed to submit feedback");
  }
}
