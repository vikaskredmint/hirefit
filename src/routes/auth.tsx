import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { LockKeyhole, Sparkles } from "lucide-react";
import { getSimpleSession, loginSimple, setSimpleSession } from "@/lib/simple-auth";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — HireFit" },
      { name: "description", content: "Sign in to HireFit candidate triage." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState("vikas.raiexp@gmail.com");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (getSimpleSession()) navigate({ to: "/" });
  }, [navigate]);

  const signIn = async () => {
    if (!userId.trim() || !password) return;
    setBusy(true);
    try {
      const session = await loginSimple(userId.trim(), password);
      setSimpleSession(session);
      toast.success("Signed in");
      navigate({ to: "/" });
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary/40 p-4">
      <Card className="w-full max-w-md p-8">
        <div className="mb-6 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="text-lg font-semibold tracking-tight">HireFit</div>
        </div>
        <h1 className="text-xl font-semibold">Sign in</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter your user id and password.
        </p>
        <form
          onSubmit={(e) => { e.preventDefault(); signIn(); }}
          className="mt-6 space-y-3"
        >
          <div className="space-y-1.5">
            <Label htmlFor="userId">User ID</Label>
            <Input
              id="userId"
              type="text"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="vikas.raiexp@gmail.com"
              autoFocus
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              required
            />
          </div>
          <Button type="submit" className="w-full gap-2" disabled={busy}>
            <LockKeyhole className="h-4 w-4" />
            {busy ? "Signing in..." : "Sign in"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
