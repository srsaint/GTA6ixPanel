"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Mode = "login" | "register" | "bootstrap";

export default function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const body = Object.fromEntries(form.entries());
    const endpoint = mode === "login" ? "/api/auth/login" : mode === "register" ? "/api/auth/register" : "/api/auth/bootstrap";

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    setLoading(false);

    if (!response.ok) {
      setError(data.message || "Request failed.");
      return;
    }
    router.push("/admin");
    router.refresh();
  }

  return (
    <form className="form" onSubmit={submit}>
      {mode === "bootstrap" && <input name="token" placeholder="Bootstrap token" required />}
      {mode === "register" && <input name="inviteKey" placeholder="Referral key" required />}
      <input name="username" placeholder={mode === "login" ? "Username or email" : "Username"} required />
      {mode !== "login" && <input name="email" type="email" placeholder="Email (optional)" />}
      <input name="password" type="password" placeholder="Password" minLength={mode === "login" ? 1 : 8} required />
      {error && <p className="error">{error}</p>}
      <button className="button" type="submit" disabled={loading}>{loading ? "Working..." : mode === "login" ? "Login" : "Create account"}</button>
    </form>
  );
}
