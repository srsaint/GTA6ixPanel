import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import AuthForm from "../shared/auth-form";

export const dynamic = "force-dynamic";

export default async function SetupOwnerPage() {
  const ownerCount = await prisma.admin.count({ where: { role: "OWNER" } });
  if (ownerCount > 0) redirect("/login");

  return (
    <main className="shell narrow">
      <section className="card">
        <p className="eyebrow">One-Time Setup</p>
        <h1>Create owner account</h1>
        <p className="muted">Use your `ADMIN_BOOTSTRAP_TOKEN` from Vercel env. This route stops working after the first owner exists.</p>
        <AuthForm mode="bootstrap" />
      </section>
    </main>
  );
}
