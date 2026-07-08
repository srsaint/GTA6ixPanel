import { requireOwner } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiError, apiOk } from "@/lib/responses";

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireOwner();
    const { id } = await context.params;
    const invite = await prisma.adminInvite.findUnique({ where: { id } });

    if (!invite) return apiError("not_found", "Referral key not found.", 404);

    const [, disabledAdmins] = await prisma.$transaction([
      prisma.adminInvite.update({ where: { id }, data: { disabled: true } }),
      prisma.admin.updateMany({ where: { usedInviteId: id, role: "RESELLER" }, data: { disabled: true } }),
      prisma.auditLog.create({
        data: {
          adminId: admin.id,
          action: "invite.remove_and_disable_admins",
          targetType: "admin_invite",
          targetId: id,
        },
      }),
    ]);

    return apiOk({ disabledAdmins: disabledAdmins.count });
  } catch {
    return apiError("forbidden", "Owner access required.", 403);
  }
}
