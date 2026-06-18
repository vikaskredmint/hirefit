import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Shield, Briefcase, Users, TrendingUp, UserCheck, Trash2, Power, PowerOff,
  UserPlus, Search, RefreshCw, AlertTriangle, CheckCircle, Building2, Loader2,
  Eye, X
} from "lucide-react";

export const Route = createFileRoute("/_app/admin")({
  head: () => ({
    meta: [
      { title: "Admin Panel — HireFit" },
      { name: "description", content: "Admin panel to manage jobs, candidates, and users." },
    ],
  }),
  component: AdminPanel,
});

// ── types ──────────────────────────────────────────────────────────────────
type AdminJob = { id: string; title: string; jd_text: string; created_at: string; is_active: boolean | null };
type AdminCandidate = {
  id: string; name: string; email: string | null; phone: string | null;
  current_company: string | null; current_designation: string | null;
  pipeline_stage: string; job_id: string; created_at: string;
  match_scores: { overall_score: number; tier: string } | null;
};

// ── component ──────────────────────────────────────────────────────────────
function AdminPanel() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"overview" | "jobs" | "candidates" | "users">("overview");
  const [jobSearch, setJobSearch] = useState("");
  const [candSearch, setCandSearch] = useState("");
  const [filterJobId, setFilterJobId] = useState("all");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Redirect non-admins
  if (session && session.user.role !== "super_admin") {
    navigate({ to: "/" });
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-md shadow-orange-500/20">
          <Shield className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Admin Panel</h1>
          <p className="text-sm text-muted-foreground">Manage jobs, candidates, and team members</p>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 rounded-xl bg-muted/50 p-1 w-fit">
        {(["overview", "jobs", "candidates", "users"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-lg px-4 py-1.5 text-sm font-medium capitalize transition-all ${
              tab === t ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Tabs */}
      {tab === "overview" && <OverviewTab />}
      {tab === "jobs" && (
        <JobsTab
          search={jobSearch}
          setSearch={setJobSearch}
          deleteConfirm={deleteConfirm}
          setDeleteConfirm={setDeleteConfirm}
        />
      )}
      {tab === "candidates" && (
        <CandidatesTab
          search={candSearch}
          setSearch={setCandSearch}
          filterJobId={filterJobId}
          setFilterJobId={setFilterJobId}
          deleteConfirm={deleteConfirm}
          setDeleteConfirm={setDeleteConfirm}
        />
      )}
      {tab === "users" && <UsersTab />}
    </div>
  );
}

// ── Overview Tab ──────────────────────────────────────────────────────────
function OverviewTab() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "stats"],
    queryFn: () => api.adminStats(),
  });

  const stats = [
    { label: "Total Jobs", value: data?.totalJobs ?? 0, icon: Briefcase, color: "from-violet-500 to-indigo-600", bg: "bg-violet-500/10" },
    { label: "Active Jobs", value: data?.activeJobs ?? 0, icon: CheckCircle, color: "from-emerald-500 to-teal-600", bg: "bg-emerald-500/10" },
    { label: "Total Candidates", value: data?.totalCandidates ?? 0, icon: Users, color: "from-sky-500 to-blue-600", bg: "bg-sky-500/10" },
    { label: "Hired", value: data?.hired ?? 0, icon: UserCheck, color: "from-amber-500 to-orange-600", bg: "bg-amber-500/10" },
    { label: "Interviewing", value: data?.interviewing ?? 0, icon: TrendingUp, color: "from-rose-500 to-pink-600", bg: "bg-rose-500/10" },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
      {stats.map((s) => (
        <Card key={s.label} className="p-5 space-y-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${s.bg}`}>
            <s.icon className={`h-5 w-5 bg-gradient-to-br ${s.color} bg-clip-text text-transparent`} style={{ color: "currentColor" }} />
          </div>
          {isLoading ? (
            <Skeleton className="h-7 w-12" />
          ) : (
            <div className="text-3xl font-bold tabular-nums">{s.value}</div>
          )}
          <div className="text-xs text-muted-foreground">{s.label}</div>
        </Card>
      ))}
    </div>
  );
}

// ── Jobs Tab ──────────────────────────────────────────────────────────────
function JobsTab({
  search, setSearch, deleteConfirm, setDeleteConfirm
}: {
  search: string; setSearch: (v: string) => void;
  deleteConfirm: string | null; setDeleteConfirm: (v: string | null) => void;
}) {
  const qc = useQueryClient();
  const { data: jobs = [], isLoading, refetch } = useQuery({
    queryKey: ["admin", "jobs"],
    queryFn: () => api.adminListJobs(),
  });

  const filtered = jobs.filter((j) =>
    j.title.toLowerCase().includes(search.toLowerCase())
  );

  const toggleJob = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      active ? api.adminDisableJob(id) : api.adminEnableJob(id),
    onSuccess: (data) => {
      toast.success(`Job ${data.is_active ? "enabled" : "disabled"}`);
      qc.invalidateQueries({ queryKey: ["admin"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const deleteJob = useMutation({
    mutationFn: (id: string) => api.adminDeleteJob(id),
    onSuccess: () => {
      toast.success("Job and all candidates deleted");
      setDeleteConfirm(null);
      qc.invalidateQueries({ queryKey: ["admin"] });
      qc.invalidateQueries({ queryKey: ["jobs"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search jobs…" className="pl-8" />
        </div>
        <Button variant="outline" size="icon" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {isLoading ? (
        <Card className="p-6"><Skeleton className="h-48 w-full" /></Card>
      ) : filtered.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground">No jobs found</Card>
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Job Title</th>
                <th className="px-4 py-3 text-left hidden sm:table-cell">Created</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((job) => {
                const active = job.is_active !== false;
                return (
                  <tr key={job.id} className="border-t border-border/60">
                    <td className="px-4 py-3">
                      <div className="font-medium">{job.title}</div>
                      <div className="text-xs text-muted-foreground line-clamp-1">{job.jd_text?.slice(0, 60) ?? ""}…</div>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground hidden sm:table-cell">
                      {new Date(job.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={active ? "default" : "secondary"} className={active ? "bg-emerald-500/20 text-emerald-700 border-emerald-500/30" : ""}>
                        {active ? "Active" : "Disabled"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1.5 text-xs"
                          onClick={() => toggleJob.mutate({ id: job.id, active })}
                          disabled={toggleJob.isPending}
                        >
                          {active ? <PowerOff className="h-3.5 w-3.5" /> : <Power className="h-3.5 w-3.5" />}
                          {active ? "Disable" : "Enable"}
                        </Button>
                        {deleteConfirm === job.id ? (
                          <div className="flex gap-1">
                            <Button
                              variant="destructive"
                              size="sm"
                              className="h-8 text-xs"
                              onClick={() => deleteJob.mutate(job.id)}
                              disabled={deleteJob.isPending}
                            >
                              {deleteJob.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Confirm"}
                            </Button>
                            <Button variant="ghost" size="sm" className="h-8" onClick={() => setDeleteConfirm(null)}>
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 text-destructive hover:bg-destructive/10"
                            onClick={() => setDeleteConfirm(job.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

// ── Candidates Tab ─────────────────────────────────────────────────────────
function CandidatesTab({
  search, setSearch, filterJobId, setFilterJobId, deleteConfirm, setDeleteConfirm
}: {
  search: string; setSearch: (v: string) => void;
  filterJobId: string; setFilterJobId: (v: string) => void;
  deleteConfirm: string | null; setDeleteConfirm: (v: string | null) => void;
}) {
  const qc = useQueryClient();
  const { data: jobs = [] } = useQuery({ queryKey: ["admin", "jobs"], queryFn: () => api.adminListJobs() });
  const { data: candidates = [], isLoading, refetch } = useQuery({
    queryKey: ["admin", "candidates", filterJobId],
    queryFn: () => api.adminListCandidates(filterJobId === "all" ? undefined : filterJobId),
  });

  const filtered = (candidates as AdminCandidate[]).filter((c) => {
    const term = search.toLowerCase();
    return (
      c.name?.toLowerCase().includes(term) ||
      c.email?.toLowerCase().includes(term) ||
      c.current_company?.toLowerCase().includes(term)
    );
  });

  const deleteCandidate = useMutation({
    mutationFn: (id: string) => api.adminDeleteCandidate(id),
    onSuccess: () => {
      toast.success("Candidate deleted");
      setDeleteConfirm(null);
      qc.invalidateQueries({ queryKey: ["admin", "candidates"] });
      qc.invalidateQueries({ queryKey: ["candidates"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const TIER_COLORS: Record<string, string> = {
    strong_fit: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
    good_fit: "bg-sky-500/15 text-sky-700 border-sky-500/30",
    possible_fit: "bg-amber-500/15 text-amber-700 border-amber-500/30",
    not_fit: "bg-rose-500/15 text-rose-700 border-rose-500/30",
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search candidates…" className="pl-8" />
        </div>
        <Select value={filterJobId} onValueChange={setFilterJobId}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by job" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All jobs</SelectItem>
            {jobs.map((j) => <SelectItem key={j.id} value={j.id}>{j.title}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      <div className="text-xs text-muted-foreground">{filtered.length} candidate{filtered.length !== 1 ? "s" : ""}</div>

      {isLoading ? (
        <Card className="p-6"><Skeleton className="h-64 w-full" /></Card>
      ) : filtered.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground">No candidates found</Card>
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left hidden md:table-cell">Company</th>
                <th className="px-4 py-3 text-left hidden sm:table-cell">Score</th>
                <th className="px-4 py-3 text-left">Stage</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => {
                const ms = Array.isArray((c as any).match_scores) ? (c as any).match_scores[0] : (c as any).match_scores;
                return (
                  <tr key={c.id} className="border-t border-border/60">
                    <td className="px-4 py-3">
                      <div className="font-medium">{c.name}</div>
                      <div className="text-xs text-muted-foreground">{c.email ?? "—"}</div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                      <div className="flex items-center gap-1.5">
                        <Building2 className="h-3.5 w-3.5 shrink-0" />
                        {c.current_company ?? "—"}
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      {ms ? (
                        <div className="flex items-center gap-2">
                          <span className="font-semibold tabular-nums">{ms.overall_score}</span>
                          <Badge variant="outline" className={`text-[10px] ${TIER_COLORS[ms.tier] ?? ""}`}>
                            {ms.tier?.replace("_", " ")}
                          </Badge>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">Unscored</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="text-xs capitalize">
                        {c.pipeline_stage?.replace("_", " ")}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        {deleteConfirm === c.id ? (
                          <div className="flex gap-1">
                            <Button
                              variant="destructive"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => deleteCandidate.mutate(c.id)}
                              disabled={deleteCandidate.isPending}
                            >
                              {deleteCandidate.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Delete?"}
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7" onClick={() => setDeleteConfirm(null)}>
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-destructive hover:bg-destructive/10"
                            onClick={() => setDeleteConfirm(c.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

// ── Users Tab ─────────────────────────────────────────────────────────────
function UsersTab() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("recruiter");
  const [createdToken, setCreatedToken] = useState<string | null>(null);

  const createUser = useMutation({
    mutationFn: () => api.adminCreateUser({ email, password, role }),
    onSuccess: (data) => {
      toast.success(`User ${data.email} created`);
      setCreatedToken(data.token);
      setEmail("");
      setPassword("");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Create user form */}
      <Card className="p-6 space-y-4">
        <div className="flex items-center gap-2.5">
          <UserPlus className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">Create New User</h2>
        </div>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Email</label>
            <Input
              id="admin-new-user-email"
              type="email"
              placeholder="user@kredmint.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Password</label>
            <Input
              id="admin-new-user-password"
              type="password"
              placeholder="Min 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Role</label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recruiter">Recruiter</SelectItem>
                <SelectItem value="hiring_manager">Hiring Manager</SelectItem>
                <SelectItem value="super_admin">Super Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button
          id="admin-create-user-btn"
          className="w-full gap-2"
          onClick={() => createUser.mutate()}
          disabled={!email || !password || createUser.isPending}
        >
          {createUser.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
          Create User
        </Button>

        {createdToken && (
          <div className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 space-y-2">
            <div className="flex items-center gap-1.5 text-sm font-medium text-emerald-700">
              <CheckCircle className="h-4 w-4" />
              User created — share token below
            </div>
            <code className="block break-all text-xs bg-background rounded p-2 border border-border">
              {createdToken}
            </code>
            <Button
              size="sm"
              variant="outline"
              className="text-xs"
              onClick={() => { navigator.clipboard.writeText(createdToken); toast.success("Copied!"); }}
            >
              Copy token
            </Button>
          </div>
        )}
      </Card>

      {/* Info card */}
      <Card className="p-6 space-y-4">
        <div className="flex items-center gap-2.5">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          <h2 className="font-semibold">Current Users</h2>
        </div>
        <div className="rounded-lg border border-border/60 divide-y divide-border/60">
          <div className="flex items-center justify-between p-3">
            <div>
              <div className="text-sm font-medium">vikas.raiexp@gmail.com</div>
              <div className="text-xs text-muted-foreground">Super Admin</div>
            </div>
            <Badge className="bg-violet-500/15 text-violet-700 border-violet-500/30">Super Admin</Badge>
          </div>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Additional users created here receive a JWT token for API access. Full multi-user auth can be enabled by connecting Supabase Auth.
        </p>
      </Card>
    </div>
  );
}
