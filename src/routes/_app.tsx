import { createFileRoute, Outlet, useNavigate, Link, useRouterState } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, LogOut, LayoutDashboard, Shield, Upload, ChevronRight } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { clearSimpleSession } from "@/lib/simple-auth";

export const Route = createFileRoute("/_app")({
  component: AppShell,
});

function AppShell() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/auth" });
  }, [loading, session, navigate]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 to-slate-900">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 shadow-lg shadow-violet-500/30">
            <Sparkles className="h-6 w-6 text-white animate-pulse" />
          </div>
          <div className="text-sm text-slate-400 animate-pulse">Loading HireFit…</div>
        </div>
      </div>
    );
  }
  if (!session) return null;

  const isAdmin = pathname.startsWith("/admin");
  const isSuper = session.user.role === "super_admin";

  return (
    <div className="min-h-screen bg-background">
      {/* ── Top navbar ── */}
      <header className="sticky top-0 z-40 border-b border-border/50 bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-2.5 sm:px-6">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 shrink-0">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 shadow-md shadow-violet-500/30">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <div className="hidden sm:block">
              <div className="text-sm font-bold leading-tight tracking-tight bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">HireFit</div>
              <div className="text-[9px] uppercase tracking-widest text-muted-foreground">Kredmint Talent</div>
            </div>
          </Link>

          {/* Nav links */}
          <nav className="flex items-center gap-1 flex-1">
            <NavLink to="/" active={!isAdmin} icon={<LayoutDashboard className="h-3.5 w-3.5" />} label="Dashboard" />
            {isSuper && (
              <NavLink to="/admin" active={isAdmin} icon={<Shield className="h-3.5 w-3.5" />} label="Admin" />
            )}
          </nav>

          {/* Breadcrumb hint on admin */}
          {isAdmin && (
            <div className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground">
              <ChevronRight className="h-3 w-3" />
              <span className="font-medium text-foreground">Admin Panel</span>
            </div>
          )}

          {/* Right side */}
          <div className="flex items-center gap-2 ml-auto">
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-xs font-medium text-foreground">{session.user.email.split("@")[0]}</span>
              <span className="text-[10px] text-muted-foreground capitalize">{session.user.role?.replace("_", " ")}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { clearSimpleSession(); navigate({ to: "/auth" }); }}
              className="gap-1.5 text-muted-foreground hover:text-foreground"
              id="logout-btn"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <Outlet />
      </main>
      <Toaster richColors position="top-right" />
    </div>
  );
}

function NavLink({
  to,
  active,
  icon,
  label,
}: {
  to: string;
  active: boolean;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link
      to={to}
      className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-150 ${
        active
          ? "bg-primary text-primary-foreground shadow-sm"
          : "text-muted-foreground hover:bg-accent hover:text-foreground"
      }`}
    >
      {icon}
      {label}
    </Link>
  );
}
