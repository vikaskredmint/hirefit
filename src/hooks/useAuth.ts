import { useEffect, useState } from "react";
import { getSimpleSession, type SimpleSession } from "@/lib/simple-auth";

export function useAuth() {
  const [session, setSession] = useState<SimpleSession | null>(() => getSimpleSession());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const sync = () => setSession(getSimpleSession());
    window.addEventListener("storage", sync);
    window.addEventListener("hf:auth", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("hf:auth", sync);
    };
  }, []);

  return { session, user: session?.user ?? null, loading };
}
