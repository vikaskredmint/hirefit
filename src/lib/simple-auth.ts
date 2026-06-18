const KEY = "hf:simple-auth";

export type SimpleUser = {
  email: string;
  role: string;
};

export type SimpleSession = {
  token: string;
  user: SimpleUser;
};

export function getSimpleSession(): SimpleSession | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    const session = JSON.parse(raw) as SimpleSession;
    return session?.token && session?.user?.email ? session : null;
  } catch {
    return null;
  }
}

export function setSimpleSession(session: SimpleSession) {
  localStorage.setItem(KEY, JSON.stringify(session));
  window.dispatchEvent(new Event("hf:auth"));
}

export function clearSimpleSession() {
  localStorage.removeItem(KEY);
  window.dispatchEvent(new Event("hf:auth"));
}

export async function loginSimple(userId: string, password: string): Promise<SimpleSession> {
  const base = (import.meta.env.VITE_API_BASE_URL ?? "").toString().replace(/\/+$/, "");
  if (!base) throw new Error("Backend URL missing. Set VITE_API_BASE_URL.");

  const res = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ userId, password }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error || "Invalid user id or password");
  }
  return res.json();
}
