import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiError, apiOk } from "@/lib/responses";

const schema = z.object({ banned: z.boolean().default(true) });

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    const { id } = await context.params;
    const input = schema.safeParse(await request.json().catch(() => ({})));
    if (!input.success) return apiError("bad_request", "Invalid ban setting.");

    const license = await prisma.license.findUnique({ where: { id } });
    if (!license) return apiError("not_found", "License not found.", 404);
    if (admin.role !== "OWNER" && license.createdById !== admin.id) return apiError("forbidden", "Not allowed.", 403);

    const updated = await prisma.license.update({
      where: { id },
      data: { status: input.data.banned ? "BANNED" : "ACTIVE" },
    });
    await prisma.auditLog.create({ data: { adminId: admin.id, action: input.data.banned ? "license.ban" : "license.unban", targetType: "license", targetId: id } });
    return apiOk({ status: updated.status });
  } catch {
    return apiError("unauthorized", "Login required.", 401);
  }
}
