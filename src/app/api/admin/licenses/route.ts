import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { generateGroupedKey, hashSecret, keyPrefix } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";
import { apiError, apiOk } from "@/lib/responses";

const createSchema = z.object({
  days: z.coerce.number().int().min(1).max(3650),
  note: z.string().max(200).optional().or(z.literal("")),
  maxDevices: z.coerce.number().int().min(1).max(10).default(1),
});

export async function GET() {
  try {
    const admin = await requireAdmin();
    const licenses = await prisma.license.findMany({
      where: admin.role === "OWNER" ? {} : { createdById: admin.id },
      include: { createdBy: { select: { username: true } }, devices: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    return apiOk({
      licenses: licenses.map((license) => ({
        id: license.id,
        prefix: license.licenseKeyPrefix,
        createdBy: license.createdBy.username,
        note: license.note,
        status: license.status,
        maxDevices: license.maxDevices,
        deviceCount: license.devices.length,
        durationDays: license.durationDays,
        expiresAt: license.expiresAt.getTime(),
        firstActivatedAt: license.firstActivatedAt?.getTime() ?? null,
        createdAt: license.createdAt.getTime(),
      })),
    });
  } catch {
    return apiError("unauthorized", "Login required.", 401);
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    const input = createSchema.safeParse(await request.json().catch(() => null));
    if (!input.success) return apiError("bad_request", "Invalid license settings.");

    if (admin.role !== "OWNER") {
      const creator = await prisma.admin.findUnique({ where: { id: admin.id }, include: { usedInvite: true } });
      const invite = creator?.usedInvite;
      if (invite?.maxLicenseDays && input.data.days > invite.maxLicenseDays) {
        return apiError("limit_exceeded", `Your max license duration is ${invite.maxLicenseDays} days.`, 403);
      }
      if (invite?.maxLicenseCount != null) {
        const createdCount = await prisma.license.count({ where: { createdById: admin.id } });
        if (createdCount >= invite.maxLicenseCount) return apiError("limit_exceeded", "Your license generation limit has been reached.", 403);
      }
    }

    const key = generateGroupedKey("LIC");
    const license = await prisma.license.create({
      data: {
        licenseKeyHash: hashSecret(key),
        licenseKeyPrefix: keyPrefix(key),
        createdById: admin.id,
        note: input.data.note || null,
        maxDevices: input.data.maxDevices,
        durationDays: input.data.days,
        expiresAt: new Date(Date.now() + input.data.days * 24 * 60 * 60 * 1000),
      },
    });

    await prisma.auditLog.create({ data: { adminId: admin.id, action: "license.create", targetType: "license", targetId: license.id } });
    return apiOk({
      key,
      license: {
        id: license.id,
        prefix: license.licenseKeyPrefix,
        createdBy: admin.username,
        note: license.note,
        status: license.status,
        maxDevices: license.maxDevices,
        deviceCount: 0,
        durationDays: license.durationDays,
        expiresAt: license.expiresAt.getTime(),
        createdAt: license.createdAt.getTime(),
      },
    }, 201);
  } catch {
    return apiError("unauthorized", "Login required.", 401);
  }
}
