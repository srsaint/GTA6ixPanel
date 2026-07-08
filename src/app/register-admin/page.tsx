import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionAdmin } from "@/lib/auth";
import AuthForm from "../shared/auth-form";

export const dynamic = "force-dynamic";

export default async function RegisterAdminPage() {
  if (await getSessionAdmin()) redirect("/admin");

  return (
    <main className="shell narrow">
      <section className="card">
        <p className="eyebrow">Referral Signup</p>
        <h1>Create reseller account</h1>
        <AuthForm mode="register" />
        <p className="muted small">Already have an account? <Link href="/login">Login</Link>.</p>
      </section>
    </main>
  );
}
