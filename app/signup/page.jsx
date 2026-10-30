"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import SiteFooter from "@/app/components/site-footer";
import SiteHeader from "@/app/components/site-header";
import { DEMO_PASSWORD, signInAsDemo } from "@/app/lib/session";
import {
  getUsers,
  initializeDemoData,
  STORAGE_KEYS,
  writeStorage,
} from "@/app/lib/storage";

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

function makeId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `renter-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export default function SignUpPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", confirmPassword: "" });
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const result = initializeDemoData();
      if (!result.ok) setMessage(result.error);
      setReady(true);
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  function updateField(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    setMessage("");

    const name = form.name.trim();
    const email = form.email.trim().toLowerCase();

    if (!name || !email || !form.password || !form.confirmPassword) {
      setMessage("Complete all fields to create your renter account.");
      return;
    }

    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setMessage("Enter a valid email address.");
      return;
    }

    if (form.password !== form.confirmPassword) {
      setMessage("The passwords do not match.");
      return;
    }

    if (form.password !== DEMO_PASSWORD) {
      setMessage("Enter the account access password shown on the sign-in page.");
      return;
    }

    setSubmitting(true);
    const users = getUsers();

    if (users.some((user) => user.email?.trim().toLowerCase() === email)) {
      setMessage("An account with this email already exists in this browser.");
      setSubmitting(false);
      return;
    }

    const user = {
      id: makeId(),
      name,
      email,
      roles: ["renter"],
      status: "active",
      createdAt: new Date().toISOString(),
    };

    // Save only the demo user record; never save the submitted password.
    const saveResult = writeStorage(STORAGE_KEYS.users, [...users, user]);
    if (!saveResult.ok) {
      setMessage(saveResult.error || "Could not save your account.");
      setSubmitting(false);
      return;
    }

    const signInResult = signInAsDemo(user.id);
    if (!signInResult.ok) {
      setMessage(signInResult.error);
      setSubmitting(false);
      return;
    }

    router.replace("/dashboard");
  }

  return (
    <>
      <SiteHeader />
      <main className="catalogue-main">
        <section className="page-width catalogue-layout">
          <div className="catalogue-title">
            <div>
              <span className="eyebrow">GET STARTED</span>
              <h1>Create an account.</h1>
              <p>Create your renter account and start exploring cars.</p>
            </div>
            <span className="catalogue-demo-tag"><span aria-hidden="true" /> CREATE ACCOUNT</span>
          </div>

          <form className="catalogue-controls" onSubmit={handleSubmit} style={{ maxWidth: "620px", marginInline: "auto" }}>
            {message && <p role="alert" style={{ color: "#a13f3c", fontSize: "12px" }}>{message}</p>}
            {!ready ? <p role="status">Preparing registration…</p> : (
              <div style={{ display: "grid", gap: "14px" }}>
                <label className="filter-control" htmlFor="signup-name"><span>Full name</span><input id="signup-name" name="name" autoComplete="name" value={form.name} onChange={updateField} style={inputStyle} required /></label>
                <label className="filter-control" htmlFor="signup-email"><span>Email address</span><input id="signup-email" name="email" type="email" autoComplete="email" value={form.email} onChange={updateField} style={inputStyle} required /></label>
                <label className="filter-control" htmlFor="signup-password"><span>Password</span><input id="signup-password" name="password" type="password" autoComplete="new-password" value={form.password} onChange={updateField} style={inputStyle} required /></label>
                <label className="filter-control" htmlFor="signup-confirm"><span>Confirm password</span><input id="signup-confirm" name="confirmPassword" type="password" autoComplete="new-password" value={form.confirmPassword} onChange={updateField} style={inputStyle} required /></label>
                <p className="demo-note">Use the account access password shown on the sign-in page. Passwords are not stored in your account profile.</p>
                <button className="button button-primary" type="submit" disabled={submitting}>
                  {submitting ? "Creating account…" : "Create renter account"} <span aria-hidden="true">↗</span>
                </button>
              </div>
            )}
            <p className="demo-note" style={{ marginTop: "18px" }}>
              Already registered in this browser? <Link href="/signin">Sign in</Link>
            </p>
          </form>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
