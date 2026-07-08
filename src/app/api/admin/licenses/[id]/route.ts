import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiError, apiOk } from "@/lib/responses";

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    const { id } = await context.params;
    const license = await prisma.license.findUnique({ where: { id } });

    if (!license) return apiError("not_found", "License not found.", 404);
    if (admin.role !== "OWNER" && license.createdById !== admin.id) return apiError("forbidden", "Not allowed.", 403);

    await prisma.license.delete({ where: { id } });
    await prisma.auditLog.create({
      data: { adminId: admin.id, action: "license.delete", targetType: "license", targetId: id },
    });

    return apiOk({});
  } catch {
    return apiError("unauthorized", "Login required.", 401);
  }
}
