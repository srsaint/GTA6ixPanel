import { z } from "zod";
import { hashSecret } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";
import { apiError, apiOk } from "@/lib/responses";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://store.rockstargames.com",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

const schema = z.object({
  sessionToken: z.string().min(24),
  deviceId: z.string().min(12).max(256),
});

function withCors(response: Response) {
  Object.entries(corsHeaders).forEach(([key, value]) => response.headers.set(key, value));
  return response;
}

function licenseError(code: string, message: string, status = 400) {
  return withCors(apiError(code, message, status));
}

function licenseOk<T>(data: T, status = 200) {
  return withCors(apiOk(data, status));
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function POST(request: Request) {
  const input = schema.safeParse(await request.json().catch(() => null));
  if (!input.success) return licenseError("bad_request", "Session token and device ID are required.");

  const session = await prisma.licenseSession.findUnique({
    where: { tokenHash: hashSecret(input.data.sessionToken) },
    include: { license: { include: { devices: true } } },
  });

  if (!session) return licenseError("session_invalid", "License session is no longer valid.", 401);
  if (session.expiresAt.getTime() < Date.now()) return licenseError("session_expired", "License session expired.", 401);

  const deviceIdHash = hashSecret(input.data.deviceId);
  if (session.deviceIdHash !== deviceIdHash) return licenseError("device_mismatch", "License session belongs to another device.", 403);
  if (session.license.status === "BANNED") return licenseError("banned", "License key was disabled.", 403);
  if (session.license.expiresAt.getTime() < Date.now()) return licenseError("expired", "License key expired.", 403);
  if (!session.license.devices.some((device) => device.deviceIdHash === deviceIdHash)) {
    return licenseError("device_reset", "Device binding was reset. Enter your key again.", 401);
  }

  await prisma.licenseSession.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } });

  return licenseOk({
    verifiedUntil: session.expiresAt.getTime(),
    expiresAt: session.license.expiresAt.getTime(),
    licenseStatus: session.license.status,
  });
}
