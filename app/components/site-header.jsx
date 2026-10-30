"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { getCurrentSession, hasRole, signOut } from "@/app/lib/session";

const navItems = [
  { href: "/cars", label: "Find a car" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#why-sheggar", label: "Our story" },
];

export default function SiteHeader() {
  const router = useRouter();
  const [user, setUser] = useState(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setUser(getCurrentSession());
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  function handleSignOut() {
    const result = signOut();
    if (!result.ok) console.error(result.error);
    setUser(null);
    router.replace("/");
  }

  const dashboardHref = hasRole(user, "admin")
    ? "/admin"
    : hasRole(user, "owner")
      ? "/owner"
      : "/dashboard";
  const dashboardLabel = hasRole(user, "admin")
    ? "Admin dashboard"
    : hasRole(user, "owner")
      ? "Owner dashboard"
      : "My trips";

  return (
    <header className="site-header">
      <div className="header-inner page-width">
        <Link className="brand" href="/" aria-label="Sheggar Wheels home">
          <span className="brand-mark" aria-hidden="true"><span /></span>
          <span>sheggar<span className="brand-wheels">wheels</span></span>
        </Link>
        <nav className="desktop-nav" aria-label="Main navigation">
          {navItems.map((item) => <Link key={item.href} href={item.href}>{item.label}</Link>)}
        </nav>
        <div className="header-actions">
          {user ? (
            <>
              <button className="sign-in-link" type="button" onClick={handleSignOut} style={{ border: 0, padding: 0, background: "transparent", cursor: "pointer" }}>Sign out</button>
              <Link className="button button-primary header-cta" href={dashboardHref}>{dashboardLabel} <span aria-hidden="true">↗</span></Link>
            </>
          ) : (
            <>
              <Link className="sign-in-link" href="/signin">Sign in</Link>
              <Link className="button button-primary header-cta" href="/signup">Get started <span aria-hidden="true">↗</span></Link>
            </>
          )}
        </div>
        <details className="mobile-menu">
          <summary aria-label="Open navigation menu"><span /><span /></summary>
          <nav aria-label="Mobile navigation">
            {navItems.map((item) => <Link key={item.href} href={item.href}>{item.label}</Link>)}
            {user ? (
              <>
                <Link href={dashboardHref}>{dashboardLabel}</Link>
                <button type="button" onClick={handleSignOut}>Sign out</button>
              </>
            ) : (
              <>
                <Link href="/signin">Sign in</Link>
                <Link href="/signup">Get started</Link>
              </>
            )}
          </nav>
        </details>
      </div>
    </header>
  );
}
