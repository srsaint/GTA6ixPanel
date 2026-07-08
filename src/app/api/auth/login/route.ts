import bcrypt from "bcryptjs";
import { z } from "zod";
import { createSession, setSessionCookie } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiError, apiOk } from "@/lib/responses";

const schema = z.object({
  username: z.string().min(3),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  const input = schema.safeParse(await request.json().catch(() => null));
  if (!input.success) return apiError("bad_request", "Invalid login details.");

  const admin = await prisma.admin.findFirst({
    where: { OR: [{ username: input.data.username }, { email: input.data.username }] },
    select: { id: true, username: true, role: true, passwordHash: true, disabled: true },
  });

  if (!admin || admin.disabled || !(await bcrypt.compare(input.data.password, admin.passwordHash))) {
    return apiError("invalid_login", "Username or password is incorrect.", 401);
  }

  await prisma.auditLog.create({ data: { adminId: admin.id, action: "auth.login", targetType: "admin", targetId: admin.id } });
  const session = await createSession({ id: admin.id, username: admin.username, role: admin.role });
  await setSessionCookie(session);
  return apiOk({ admin: { id: admin.id, username: admin.username, role: admin.role } });
}
