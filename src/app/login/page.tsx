import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionAdmin } from "@/lib/auth";
import AuthForm from "../shared/auth-form";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await getSessionAdmin()) redirect("/admin");

  return (
    <main className="shell narrow">
      <section className="card">
        <p className="eyebrow">Admin Login</p>
        <h1>Sign in</h1>
        <AuthForm mode="login" />
        <p className="muted small">Need reseller access? <Link href="/register-admin">Register with a referral key</Link>.</p>
        <p className="muted small">First owner setup? <Link href="/setup-owner">Bootstrap owner</Link>.</p>
      </section>
    </main>
  );
}
