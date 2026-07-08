import { z } from "zod";
import { hashOptional, hashSecret, keyPrefix } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";
import { apiError, apiOk } from "@/lib/responses";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://store.rockstargames.com",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

const schema = z.object({
  key: z.string().min(8),
  deviceId: z.string().min(12).max(256),
});

function sessionHours() {
  return Math.max(1, Number(process.env.LICENSE_SESSION_HOURS || 24));
}

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
  if (!input.success) return licenseError("bad_request", "License key and device ID are required.");

  const ipHash = hashOptional(request.headers.get("x-forwarded-for")?.split(",")[0] || null);
  const deviceIdHash = hashSecret(input.data.deviceId);
  const prefix = keyPrefix(input.data.key);

  const recentFailures = await prisma.verifyAttempt.count({
    where: { ipHash, result: { not: "ok" }, createdAt: { gt: new Date(Date.now() - 10 * 60 * 1000) } },
  });
  if (recentFailures >= 20) return licenseError("rate_limited", "Too many attempts. Try again later.", 429);

  async function finish(result: string, response: Response) {
    await prisma.verifyAttempt.create({ data: { keyPrefix: prefix, deviceIdHash, ipHash, result } });
    return response;
  }

  const license = await prisma.license.findUnique({
    where: { licenseKeyHash: hashSecret(input.data.key) },
    include: { devices: true },
  });

  if (!license) return finish("invalid_key", licenseError("invalid_key", "License key not found.", 404));
  if (license.status === "BANNED") return finish("banned", licenseError("banned", "License key was disabled.", 403));
  if (license.expiresAt.getTime() < Date.now()) return finish("expired", licenseError("expired", "License key expired.", 403));

  const existingDevice = license.devices.find((device) => device.deviceIdHash === deviceIdHash);
  if (existingDevice) {
    await prisma.licenseDevice.update({ where: { id: existingDevice.id }, data: { lastSeenAt: new Date() } });
  } else {
    if (license.devices.length >= license.maxDevices) {
      return finish("device_limit", licenseError("device_limit", "License key is already bound to another device.", 403));
    }

    await prisma.licenseDevice.create({
      data: {
        licenseId: license.id,
        deviceIdHash,
        userAgentHash: hashOptional(request.headers.get("user-agent")),
      },
    });

    if (!license.firstActivatedAt) {
      await prisma.license.update({ where: { id: license.id }, data: { firstActivatedAt: new Date() } });
    }
  }

  const verifiedUntil = Math.min(Date.now() + sessionHours() * 60 * 60 * 1000, license.expiresAt.getTime());
  return finish("ok", licenseOk({ verifiedUntil, expiresAt: license.expiresAt.getTime(), licenseStatus: license.status }));
}
