import { cookies } from "next/headers";
import { jwtVerify, SignJWT } from "jose";
import { prisma } from "./prisma";

const COOKIE_NAME = "license_admin_session";

function jwtSecret() {
  const value = process.env.JWT_SECRET;
  if (!value) throw new Error("JWT_SECRET is required");
  return new TextEncoder().encode(value);
}

export type SessionAdmin = {
  id: string;
  username: string;
  role: "OWNER" | "RESELLER";
};

export async function createSession(admin: SessionAdmin) {
  return new SignJWT(admin)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(jwtSecret());
}

export async function setSessionCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function getSessionAdmin(): Promise<SessionAdmin | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, jwtSecret());
    const id = String(payload.id || "");
    if (!id) return null;

    const admin = await prisma.admin.findUnique({
      where: { id },
      select: { id: true, username: true, role: true, disabled: true },
    });

    if (!admin || admin.disabled) return null;
    return { id: admin.id, username: admin.username, role: admin.role };
  } catch {
    return null;
  }
}

export async function requireAdmin() {
  const admin = await getSessionAdmin();
  if (!admin) throw new Error("UNAUTHORIZED");
  return admin;
}

export async function requireOwner() {
  const admin = await requireAdmin();
  if (admin.role !== "OWNER") throw new Error("FORBIDDEN");
  return admin;
}
