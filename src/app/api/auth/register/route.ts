import bcrypt from "bcryptjs";
import { z } from "zod";
import { createSession, setSessionCookie } from "@/lib/auth";
import { hashSecret, keyPrefix } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";
import { apiError, apiOk } from "@/lib/responses";

const schema = z.object({
  inviteKey: z.string().min(8),
  username: z.string().min(3).max(32),
  email: z.string().email().optional().or(z.literal("")),
  password: z.string().min(8).max(128),
});

export async function POST(request: Request) {
  const input = schema.safeParse(await request.json().catch(() => null));
  if (!input.success) return apiError("bad_request", "Invalid registration details.");

  const invite = await prisma.adminInvite.findUnique({ where: { inviteKeyHash: hashSecret(input.data.inviteKey) } });
  if (!invite || invite.disabled) return apiError("invalid_invite", "Referral key is invalid.");
  if (invite.expiresAt && invite.expiresAt.getTime() < Date.now()) return apiError("expired_invite", "Referral key expired.");
  if (invite.uses >= invite.maxUses) return apiError("invite_used", "Referral key has no uses left.");

  const admin = await prisma.$transaction(async (tx) => {
    const created = await tx.admin.create({
      data: {
        username: input.data.username,
        email: input.data.email || null,
        passwordHash: await bcrypt.hash(input.data.password, 12),
        role: invite.role,
        createdById: invite.createdById,
        usedInviteId: invite.id,
      },
      select: { id: true, username: true, role: true },
    });
    await tx.adminInvite.update({ where: { id: invite.id }, data: { uses: { increment: 1 } } });
    await tx.auditLog.create({
      data: {
        adminId: created.id,
        action: "admin.register_with_invite",
        targetType: "admin_invite",
        targetId: invite.id,
        metadata: { invitePrefix: keyPrefix(input.data.inviteKey) },
      },
    });
    return created;
  });

  const session = await createSession(admin);
  await setSessionCookie(session);
  return apiOk({ admin });
}
