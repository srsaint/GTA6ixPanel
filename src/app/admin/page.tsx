import { redirect } from "next/navigation";
import { getSessionAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import AdminPanel from "./panel";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const admin = await getSessionAdmin();
  if (!admin) redirect("/login");

  const licenseWhere = admin.role === "OWNER" ? {} : { createdById: admin.id };
  const [totalLicenses, activeLicenses, expiredLicenses, bannedLicenses, inviteCount, licenses, invites] = await Promise.all([
    prisma.license.count({ where: licenseWhere }),
    prisma.license.count({ where: { ...licenseWhere, status: "ACTIVE", expiresAt: { gt: new Date() } } }),
    prisma.license.count({ where: { ...licenseWhere, expiresAt: { lte: new Date() } } }),
    prisma.license.count({ where: { ...licenseWhere, status: "BANNED" } }),
    admin.role === "OWNER" ? prisma.adminInvite.count() : Promise.resolve(0),
    prisma.license.findMany({
      where: licenseWhere,
      include: { createdBy: { select: { username: true } }, devices: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    admin.role === "OWNER"
      ? prisma.adminInvite.findMany({ orderBy: { createdAt: "desc" }, take: 200 })
      : Promise.resolve([]),
  ]);

  const initialLicenses = licenses.map((license) => ({
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
  }));

  const initialInvites = invites.map((invite) => ({
    id: invite.id,
    prefix: invite.inviteKeyPrefix,
    uses: invite.uses,
    maxUses: invite.maxUses,
    maxLicenseDays: invite.maxLicenseDays,
    maxLicenseCount: invite.maxLicenseCount,
    disabled: invite.disabled,
    expiresAt: invite.expiresAt?.getTime() ?? null,
    note: invite.note,
  }));

  return (
    <main className="shell">
      <section className="topbar">
        <div>
          <p className="eyebrow">{admin.role}</p>
          <h1>Dashboard</h1>
          <p className="muted">Signed in as {admin.username}</p>
        </div>
        <form action="/api/auth/logout" method="post"><button className="button secondary">Logout</button></form>
      </section>
      <section className="grid stats">
        <div className="card"><p className="muted">Total licenses</p><strong>{totalLicenses}</strong></div>
        <div className="card"><p className="muted">Active</p><strong>{activeLicenses}</strong></div>
        <div className="card"><p className="muted">Expired</p><strong>{expiredLicenses}</strong></div>
        <div className="card"><p className="muted">Banned</p><strong>{bannedLicenses}</strong></div>
        {admin.role === "OWNER" && <div className="card"><p className="muted">Referral keys</p><strong>{inviteCount}</strong></div>}
      </section>
      <AdminPanel adminRole={admin.role} initialLicenses={initialLicenses} initialInvites={initialInvites} />
    </main>
  );
}
