import { z } from "zod";
import { requireOwner } from "@/lib/auth";
import { generateGroupedKey, hashSecret, keyPrefix } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";
import { apiError, apiOk } from "@/lib/responses";

const createSchema = z.object({
  maxUses: z.coerce.number().int().min(1).max(100).default(1),
  expiresInDays: z.coerce.number().int().min(1).max(365).optional(),
  maxLicenseDays: z.coerce.number().int().min(1).max(3650).default(30),
  maxLicenseCount: z.coerce.number().int().min(1).max(100000).optional(),
  note: z.string().max(200).optional().or(z.literal("")),
});

export async function GET() {
  try {
    await requireOwner();
    const invites = await prisma.adminInvite.findMany({
      include: { createdBy: { select: { username: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return apiOk({
      invites: invites.map((invite) => ({
        id: invite.id,
        prefix: invite.inviteKeyPrefix,
        createdBy: invite.createdBy.username,
        role: invite.role,
        maxUses: invite.maxUses,
        uses: invite.uses,
        expiresAt: invite.expiresAt?.getTime() ?? null,
        disabled: invite.disabled,
        maxLicenseDays: invite.maxLicenseDays,
        maxLicenseCount: invite.maxLicenseCount,
        note: invite.note,
        createdAt: invite.createdAt.getTime(),
      })),
    });
  } catch {
    return apiError("forbidden", "Owner access required.", 403);
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireOwner();
    const input = createSchema.safeParse(await request.json().catch(() => null));
    if (!input.success) return apiError("bad_request", "Invalid referral settings.");

    const key = generateGroupedKey("REF");
    const invite = await prisma.adminInvite.create({
      data: {
        inviteKeyHash: hashSecret(key),
        inviteKeyPrefix: keyPrefix(key),
        createdById: admin.id,
        maxUses: input.data.maxUses,
        expiresAt: input.data.expiresInDays ? new Date(Date.now() + input.data.expiresInDays * 24 * 60 * 60 * 1000) : null,
        maxLicenseDays: input.data.maxLicenseDays,
        maxLicenseCount: input.data.maxLicenseCount ?? null,
        note: input.data.note || null,
      },
    });
    await prisma.auditLog.create({ data: { adminId: admin.id, action: "invite.create", targetType: "admin_invite", targetId: invite.id } });
    return apiOk({ key, inviteId: invite.id }, 201);
  } catch {
    return apiError("forbidden", "Owner access required.", 403);
  }
}
