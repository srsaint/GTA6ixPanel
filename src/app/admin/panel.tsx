"use client";

import { useState } from "react";

type License = {
  id: string;
  prefix: string;
  createdBy: string;
  note: string | null;
  status: string;
  maxDevices: number;
  deviceCount: number;
  durationDays: number;
  expiresAt: number;
  firstActivatedAt: number | null;
  createdAt: number;
};

type Invite = {
  id: string;
  prefix: string;
  uses: number;
  maxUses: number;
  maxLicenseDays: number;
  maxLicenseCount: number | null;
  disabled: boolean;
  expiresAt: number | null;
  note: string | null;
};

function formatTimeLeft(timestamp: number) {
  const diff = timestamp - Date.now();
  if (diff <= 0) return "Expired";

  const totalMinutes = Math.floor(diff / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `${days}d ${hours}h left`;
  if (hours > 0) return `${hours}h ${minutes}m left`;
  return `${Math.max(1, minutes)}m left`;
}

function formatUsedStatus(license: License) {
  if (license.firstActivatedAt) return `Used ${new Date(license.firstActivatedAt).toLocaleString()}`;
  if (license.deviceCount > 0) return "Used";
  return "Unused";
}

export default function AdminPanel({
  adminRole,
  initialLicenses,
  initialInvites,
}: {
  adminRole: "OWNER" | "RESELLER";
  initialLicenses: License[];
  initialInvites: Invite[];
}) {
  const [licenses, setLicenses] = useState<License[]>(initialLicenses);
  const [invites, setInvites] = useState<Invite[]>(initialInvites);
  const [generated, setGenerated] = useState("");
  const [generatedInvite, setGeneratedInvite] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyAction, setBusyAction] = useState<string | null>(null);

  async function load() {
    setError("");
    const licenseResponse = await fetch("/api/admin/licenses", { cache: "no-store" });
    const licenseData = await licenseResponse.json();
    if (licenseResponse.ok) setLicenses(licenseData.licenses);
    else setError(licenseData.message || "Failed to refresh licenses.");

    if (adminRole === "OWNER") {
      const inviteResponse = await fetch("/api/admin/invites", { cache: "no-store" });
      const inviteData = await inviteResponse.json();
      if (inviteResponse.ok) setInvites(inviteData.invites);
      else setError(inviteData.message || "Failed to refresh referral keys.");
    }
  }

  async function createLicense(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    setGenerated("");
    const body = Object.fromEntries(new FormData(event.currentTarget).entries());
    const response = await fetch("/api/admin/licenses", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await response.json();
    if (!response.ok) return setError(data.message || "Failed to create license.");
    setGenerated(data.key);
    if (data.license) setLicenses((current) => [data.license, ...current]);
    event.currentTarget.reset();
    await load();
  }

  async function createInvite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    setGeneratedInvite("");
    const body = Object.fromEntries(new FormData(event.currentTarget).entries());
    const response = await fetch("/api/admin/invites", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await response.json();
    if (!response.ok) return setError(data.message || "Failed to create referral.");
    setGeneratedInvite(data.key);
    event.currentTarget.reset();
    await load();
  }

  async function postAction(actionKey: string, method: "POST" | "DELETE", url: string, successMessage: string, body?: unknown) {
    setError("");
    setNotice("");
    setBusyAction(actionKey);

    try {
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: method === "DELETE" ? undefined : JSON.stringify(body ?? {}),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(data.message || "Action failed.");
        return;
      }

      setNotice(successMessage);
      await load();
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <div className="admin-stack">
      {error && <p className="error">{error}</p>}
      {notice && <p className="success action-notice">{notice}</p>}
      <section className="card">
        <h2>Create license</h2>
        <form className="form inline" onSubmit={createLicense}>
          <input name="days" type="number" min="1" max="3650" placeholder="Days" required />
          <input name="maxDevices" type="number" min="1" max="10" placeholder="Max devices" defaultValue="1" required />
          <input name="note" placeholder="Note / customer" />
          <button className="button">Generate</button>
        </form>
        {generated && <p className="success">New license, copy now: <code>{generated}</code></p>}
      </section>

      {adminRole === "OWNER" && (
        <section className="card">
          <h2>Create referral key</h2>
          <form className="form inline" onSubmit={createInvite}>
            <input name="maxUses" type="number" min="1" max="100" placeholder="Uses" defaultValue="1" required />
            <input name="expiresInDays" type="number" min="1" max="365" placeholder="Expires in days" />
            <input name="maxLicenseDays" type="number" min="1" max="3650" placeholder="Max license days" defaultValue="30" required />
            <input name="maxLicenseCount" type="number" min="1" placeholder="Max licenses" />
            <input name="note" placeholder="Note" />
            <button className="button">Generate referral</button>
          </form>
          {generatedInvite && <p className="success">New referral, copy now: <code>{generatedInvite}</code></p>}
        </section>
      )}

      <section className="card">
        <div className="section-heading-row">
          <h2>Licenses</h2>
          <button className="button secondary compact" onClick={load} disabled={busyAction !== null}>Refresh</button>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Prefix</th><th>Status</th><th>Used</th><th>Devices</th><th>Time left</th><th>Expires</th><th>Creator</th><th>Note</th><th>Actions</th></tr></thead>
            <tbody>
              {licenses.map((license) => (
                <tr key={license.id} className={busyAction?.endsWith(license.id) ? "row-busy" : ""}>
                  <td>{license.prefix}</td>
                  <td>{license.status}</td>
                  <td><span className={license.firstActivatedAt || license.deviceCount > 0 ? "pill used" : "pill unused"}>{formatUsedStatus(license)}</span></td>
                  <td>{license.deviceCount}/{license.maxDevices}</td>
                  <td>{formatTimeLeft(license.expiresAt)}</td>
                  <td>{new Date(license.expiresAt).toLocaleDateString()}</td>
                  <td>{license.createdBy}</td>
                  <td>{license.note || "-"}</td>
                  <td className="actions">
                    <button
                      disabled={busyAction !== null}
                      onClick={() => postAction(
                        `ban:${license.id}`,
                        "POST",
                        `/api/admin/licenses/${license.id}/ban`,
                        license.status === "BANNED" ? `License ${license.prefix} unbanned.` : `License ${license.prefix} banned.`,
                        { banned: license.status !== "BANNED" }
                      )}
                    >
                      {busyAction === `ban:${license.id}` ? "Saving..." : license.status === "BANNED" ? "Unban" : "Ban"}
                    </button>
                    <button
                      disabled={busyAction !== null}
                      onClick={() => postAction(
                        `reset:${license.id}`,
                        "POST",
                        `/api/admin/licenses/${license.id}/reset-device`,
                        `Device binding reset for ${license.prefix}.`
                      )}
                    >
                      {busyAction === `reset:${license.id}` ? "Resetting..." : "Reset device"}
                    </button>
                    <button
                      disabled={busyAction !== null}
                      onClick={() => {
                        if (confirm(`Remove license ${license.prefix}? This cannot be undone.`)) {
                          postAction(
                            `delete:${license.id}`,
                            "DELETE",
                            `/api/admin/licenses/${license.id}`,
                            `License ${license.prefix} removed.`
                          );
                        }
                      }}
                    >
                      {busyAction === `delete:${license.id}` ? "Removing..." : "Remove"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {adminRole === "OWNER" && (
        <section className="card">
          <h2>Referral keys</h2>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Prefix</th><th>Uses</th><th>Max days</th><th>Max licenses</th><th>Expires</th><th>Note</th></tr></thead>
              <tbody>
                {invites.map((invite) => (
                  <tr key={invite.id}>
                    <td>{invite.prefix}</td>
                    <td>{invite.uses}/{invite.maxUses}</td>
                    <td>{invite.maxLicenseDays}</td>
                    <td>{invite.maxLicenseCount ?? "Unlimited"}</td>
                    <td>{invite.expiresAt ? new Date(invite.expiresAt).toLocaleDateString() : "Never"}</td>
                    <td>{invite.note || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
