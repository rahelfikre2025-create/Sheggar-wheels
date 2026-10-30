import { getUsers, SESSION_KEYS } from "@/app/lib/storage";

// Shared account access credential. It is never stored in browser storage.
export const DEMO_PASSWORD = "Wheels2026!";

export function getCurrentSession() {
  if (typeof window === "undefined") return null;

  try {
    const userId = window.sessionStorage.getItem(SESSION_KEYS.session);
    if (!userId) return null;

    const user = getUsers().find((item) => item.id === userId);
    if (!user || user.status !== "active") {
      window.sessionStorage.removeItem(SESSION_KEYS.session);
      return null;
    }

    return user;
  } catch (error) {
    console.error("Could not read the account session.", error);
    return null;
  }
}

export function signInAsDemo(userId) {
  if (typeof window === "undefined") {
    return { ok: false, error: "Sign-in is only available in the browser." };
  }

  try {
    const user = getUsers().find((item) => item.id === userId);
    if (!user) return { ok: false, error: "That account could not be found." };
    if (user.status !== "active") return { ok: false, error: "This account is suspended." };

    // Store only the user ID for this browser tab session.
    window.sessionStorage.setItem(SESSION_KEYS.session, user.id);
    return { ok: true, user };
  } catch (error) {
    console.error("Could not start the account session.", error);
    return { ok: false, error: "Could not sign in using this browser." };
  }
}

export function signInWithDemoCredentials({ email, password, role } = {}) {
  if (typeof window === "undefined") {
    return { ok: false, error: "Sign-in is only available in the browser." };
  }

  if (password !== DEMO_PASSWORD) {
    return { ok: false, error: "Incorrect password. Use the account access password shown on this page." };
  }

  const normalizedEmail = String(email ?? "").trim().toLowerCase();
  const user = getUsers().find(
    (item) => item.email?.trim().toLowerCase() === normalizedEmail
  );

  if (!user) return { ok: false, error: "No account was found with that email." };
  if (user.status !== "active") return { ok: false, error: "This account is suspended." };
  if (!hasRole(user, role)) return { ok: false, error: `This account does not have the ${role} role.` };

  return signInAsDemo(user.id);
}

export function signOut() {
  if (typeof window === "undefined") {
    return { ok: false, error: "Sign-out is only available in the browser." };
  }

  try {
    window.sessionStorage.removeItem(SESSION_KEYS.session);
    window.sessionStorage.removeItem(SESSION_KEYS.checkoutDraft);
    return { ok: true };
  } catch (error) {
    console.error("Could not clear the account session.", error);
    return { ok: false, error: "Could not clear the account session in this browser." };
  }
}

export function hasRole(user, role) {
  return Boolean(user && Array.isArray(user.roles) && user.roles.includes(role));
}

export function safeReturnPath(value) {
  if (typeof value !== "string" || value.length === 0) return "/";

  const path = value.trim();
  if (!path.startsWith("/") || path.startsWith("//")) return "/";
  if (path.includes("\\") || /[\u0000-\u001F\u007F]/.test(path) || /%(2f|5c)/i.test(path)) {
    return "/";
  }

  try {
    if (typeof window !== "undefined") {
      const destination = new URL(path, window.location.origin);
      if (destination.origin !== window.location.origin) return "/";
      return `${destination.pathname}${destination.search}${destination.hash}`;
    }
    return path;
  } catch {
    return "/";
  }
}
