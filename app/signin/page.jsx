"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import SiteFooter from "@/app/components/site-footer";
import SiteHeader from "@/app/components/site-header";
import { safeReturnPath, signInWithDemoCredentials } from "@/app/lib/session";
import { getUsers, initializeDemoData } from "@/app/lib/storage";

const demoEmails = {
  renter: ["renter1@sheggarwheels.com"],
  owner: ["owner1@sheggarwheels.com"],
  admin: ["admin@sheggarwheels.com"],
};

function SignInContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedNext = searchParams.get("next");

  const [users, setUsers] = useState([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState(searchParams.get("role") || "renter");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const result = initializeDemoData();
      if (!result.ok) setMessage(result.error);
      setUsers(getUsers().filter((user) => user.status === "active"));
      setLoading(false);
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  function handleSubmit(event) {
    event.preventDefault();
    setMessage("");

    if (!["renter", "owner", "admin"].includes(role)) {
      setMessage("Choose a valid account type.");
      return;
    }

    setSubmitting(true);
    const result = signInWithDemoCredentials({ email, password, role });

    if (!result.ok) {
      setMessage(result.error);
      setSubmitting(false);
      return;
    }

    const fallbackPath = role === "owner" ? "/owner" : role === "admin" ? "/admin" : "/dashboard";
    router.replace(requestedNext ? safeReturnPath(requestedNext) : fallbackPath);
  }

  return (
    <>
      <SiteHeader />
      <main className="catalogue-main">
        <section className="page-width catalogue-layout">
          <div className="catalogue-title">
            <div>
              <span className="eyebrow">WELCOME BACK</span>
              <h1>Sign in to your account.</h1>
              <p>Sign in with your account details to continue.</p>
            </div>
            <span className="catalogue-demo-tag"><span aria-hidden="true" /> ACCOUNT ACCESS</span>
          </div>

          <form className="catalogue-controls" onSubmit={handleSubmit} style={{ maxWidth: "620px", marginInline: "auto" }}>
            {message && <p role="alert" style={{ color: "#a13f3c", fontSize: "12px" }}>{message}</p>}
            {loading ? <p role="status">Loading accounts…</p> : (
              <div style={{ display: "grid", gap: "14px" }}>
                {role === "admin" ? (
                  <div style={{ padding: "12px", borderRadius: "6px", background: "#f4f1ec" }}>
                    <strong style={{ fontSize: "12px" }}>Administrator access</strong>
                    <p className="demo-note" style={{ marginTop: "6px" }}>
                      This sign-in is available from the direct <code>/admin</code> route.
                    </p>
                    <input type="hidden" name="role" value="admin" />
                  </div>
                ) : (
                  <label className="filter-control" htmlFor="account-role">
                    <span>Account type</span>
                    <select id="account-role" value={role} onChange={(event) => setRole(event.target.value)} style={inputStyle}>
                      <option value="renter">Renter</option>
                      <option value="owner">Car owner</option>
                    </select>
                  </label>
                )}

                <label className="filter-control" htmlFor="signin-email">
                  <span>Email address</span>
                  <input id="signin-email" type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder={demoEmails[role]?.[0] || "name@example.com"} style={inputStyle} />
                </label>

                <label className="filter-control" htmlFor="signin-password">
                  <span>Password</span>
                  <input id="signin-password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" style={inputStyle} />
                </label>

                <button className="button button-primary" type="submit" disabled={submitting} style={{ marginTop: "6px" }}>
                  {submitting ? "Signing in…" : "Sign in"} <span aria-hidden="true">↗</span>
                </button>
              </div>
            )}

            <div style={{ marginTop: "20px", padding: "14px", borderRadius: "6px", background: "#f4f1ec" }}>
              <strong style={{ fontSize: "12px" }}>{role === "admin" ? "Administrator account" : role === "owner" ? "Owner demo account" : "Renter demo account"}</strong>
              <p className="demo-note" style={{ marginTop: "6px" }}>Account access password: <strong>Wheels2026!</strong></p>
              <div style={{ display: "grid", gap: "4px", marginTop: "8px", color: "#77716a", fontSize: "11px" }}>
                {(demoEmails[role] || []).map((demoEmail) => <span key={demoEmail}>{demoEmail}</span>)}
              </div>
            </div>

            <p className="demo-note" style={{ marginTop: "18px" }}>
              Passwords are not stored in your account profile.
            </p>
            <p className="demo-note">
              New to Sheggar Wheels? <Link href="/signup">Create an account</Link>
            </p>
          </form>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

const inputStyle = {
  width: "100%",
  minHeight: "43px",
  padding: "9px 11px",
  border: "1px solid #e9e5df",
  borderRadius: "5px",
  color: "#38342f",
  background: "#fff",
  fontSize: "12px",
};

export default function SignInPage() {
  return (
    <Suspense fallback={<main className="catalogue-main"><div className="page-width catalogue-layout"><p role="status">Loading sign-in…</p></div></main>}>
      <SignInContent />
    </Suspense>
  );
}
