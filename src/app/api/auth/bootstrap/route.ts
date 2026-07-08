import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiError, apiOk } from "@/lib/responses";
import { createSession, setSessionCookie } from "@/lib/auth";

const schema = z.object({
  token: z.string().min(12),
  username: z.string().min(3).max(32),
  email: z.string().email().optional().or(z.literal("")),
  password: z.string().min(8).max(128),
});

export async function POST(request: Request) {
  const configuredToken = process.env.ADMIN_BOOTSTRAP_TOKEN;
  if (!configuredToken) return apiError("server_misconfigured", "ADMIN_BOOTSTRAP_TOKEN is not set.", 500);

  const input = schema.safeParse(await request.json().catch(() => null));
  if (!input.success) return apiError("bad_request", "Invalid bootstrap details.");
  if (input.data.token !== configuredToken) return apiError("invalid_token", "Bootstrap token is invalid.", 401);

  const ownerCount = await prisma.admin.count({ where: { role: "OWNER" } });
  if (ownerCount > 0) return apiError("owner_exists", "Owner account already exists.", 409);

  const admin = await prisma.admin.create({
    data: {
      username: input.data.username,
      email: input.data.email || null,
      passwordHash: await bcrypt.hash(input.data.password, 12),
      role: "OWNER",
    },
    select: { id: true, username: true, role: true },
  });

  await prisma.auditLog.create({ data: { adminId: admin.id, action: "owner.bootstrap", targetType: "admin", targetId: admin.id } });
  const session = await createSession(admin);
  await setSessionCookie(session);
  return apiOk({ admin });
}
