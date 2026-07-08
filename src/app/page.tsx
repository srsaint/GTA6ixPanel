import Link from "next/link";
import { getSessionAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  const admin = await getSessionAdmin();

  return (
    <main className="shell hero">
      <section className="card hero-card">
        <p className="eyebrow">License Admin</p>
        <h1>Public license backend with reseller referral keys.</h1>
        <p className="muted">
          Generate license keys, bind activations to browser install IDs, invite resellers, and verify extension access from a hosted API.
        </p>
        <div className="row">
          {admin ? <Link className="button" href="/admin">Open dashboard</Link> : <Link className="button" href="/login">Login</Link>}
          <Link className="button secondary" href="/register-admin">Register with referral</Link>
        </div>
      </section>
    </main>
  );
}
