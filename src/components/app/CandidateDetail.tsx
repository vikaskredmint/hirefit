import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ScoreRing } from "./ScoreRing";
import { TierBadge } from "./TierBadge";
import { STAGES, STAGE_LABEL, formatInr, type PipelineStage, type Tier } from "@/lib/tiers";
import {
  Phone, MessageSquare, Mail, ExternalLink, FileText, MapPin,
  Briefcase, GraduationCap, Wallet, Clock, CheckCircle2, AlertTriangle, Flag, Send,
  Sparkles, Loader2, CalendarCheck, Calendar,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { getSimpleSession } from "@/lib/simple-auth";

type Detail = {
  id: string;
  job_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  current_location: string | null;
  preferred_locations: string | null;
  total_experience_years: number | null;
  current_company: string | null;
  current_designation: string | null;
  annual_salary_inr: number | null;
  notice_period: string | null;
  resume_headline: string | null;
  education_summary: string | null;
  naukri_profile_url: string | null;
  screening_answers: Record<string, unknown> | null;
  pipeline_stage: PipelineStage;
  resume_url: string | null;
  job: { title: string } | null;
  match_scores: {
    overall_score: number; tier: Tier;
    domain_match_score: number | null;
    experience_match_score: number | null;
    seniority_match_score: number | null;
    strengths: string[]; gaps: string[]; red_flags: string[];
    ai_summary: string | null;
  } | null;
};

type Activity = {
  id: string; action: "called" | "sms_sent" | "email_sent" | "stage_changed" | "note";
  notes: string | null; actor: string | null; created_at: string;
};

const ACTION_LABEL: Record<Activity["action"], string> = {
  called: "Called", sms_sent: "SMS sent", email_sent: "Email sent", stage_changed: "Stage changed", note: "Note",
};

// ── Meeting form helpers ────────────────────────────────────────────────────

/** Format a local datetime for Google Calendar: YYYYMMDDTHHmmss */
function toGCalDt(dateStr: string, timeStr: string): string {
  const [y, m, d] = dateStr.split("-");
  const [hh, mm] = timeStr.split(":");
  return `${y}${m}${d}T${hh}${mm}00`;
}

function buildGCalUrl(opts: {
  title: string;
  startDate: string;
  startTime: string;
  durationMins: number;
  description: string;
  guests: string[];
  location: string;
}) {
  const startDt = toGCalDt(opts.startDate, opts.startTime);

  // Add durationMins to get end time
  const startMs = new Date(`${opts.startDate}T${opts.startTime}:00`).getTime();
  const endMs = startMs + opts.durationMins * 60 * 1000;
  const endDate = new Date(endMs);
  const endDt =
    String(endDate.getFullYear()) +
    String(endDate.getMonth() + 1).padStart(2, "0") +
    String(endDate.getDate()).padStart(2, "0") +
    "T" +
    String(endDate.getHours()).padStart(2, "0") +
    String(endDate.getMinutes()).padStart(2, "0") +
    "00";

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: opts.title,
    dates: `${startDt}/${endDt}`,
    details: opts.description,
    location: opts.location,
    add: opts.guests.filter(Boolean).join(","),
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

// ── Meeting Tab ─────────────────────────────────────────────────────────────

function MeetingTab({ candidate }: { candidate: Detail }) {
  const session = getSimpleSession();
  const recruiterEmail = session?.user?.email ?? "";
  const recruiterName = recruiterEmail.split("@")[0].replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  // Tomorrow at 10:00 as default
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const defaultDate = tomorrow.toISOString().slice(0, 10);

  const [title, setTitle] = useState(`${candidate.name} <> ${recruiterName}`);
  const [meetDate, setMeetDate] = useState(defaultDate);
  const [meetTime, setMeetTime] = useState("10:00");
  const [duration, setDuration] = useState("30");
  const [recruiterMail, setRecruiterMail] = useState(recruiterEmail);
  const [candidateMail, setCandidateMail] = useState(candidate.email ?? "");
  const [location, setLocation] = useState("Google Meet");
  const [notes, setNotes] = useState(
    `Interview for ${candidate.job?.title ?? "open role"} at Kredmint.\n\nCandidate: ${candidate.name}\nRecruiter: ${recruiterName}`
  );
  const [saved, setSaved] = useState(false);

  const handleSchedule = () => {
    if (!meetDate || !meetTime) { toast.error("Please select date and time"); return; }
    if (!recruiterMail) { toast.error("Recruiter email is required"); return; }

    const url = buildGCalUrl({
      title,
      startDate: meetDate,
      startTime: meetTime,
      durationMins: parseInt(duration, 10),
      description: notes,
      guests: [recruiterMail, candidateMail].filter(Boolean),
      location,
    });

    window.open(url, "_blank", "noopener");
    setSaved(true);
    toast.success("Google Calendar opened — review and save the event!");
  };

  return (
    <div className="space-y-5 p-6">
      <div className="flex items-center gap-2">
        <CalendarCheck className="h-5 w-5 text-primary" />
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Schedule Interview</h3>
      </div>

      {/* Meeting title */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">Meeting Title</label>
        <Input
          id="meeting-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Candidate <> Recruiter"
        />
      </div>

      {/* Date + Time */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Date</label>
          <Input
            id="meeting-date"
            type="date"
            value={meetDate}
            min={new Date().toISOString().slice(0, 10)}
            onChange={(e) => setMeetDate(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Time</label>
          <Input
            id="meeting-time"
            type="time"
            value={meetTime}
            onChange={(e) => setMeetTime(e.target.value)}
          />
        </div>
      </div>

      {/* Duration */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">Duration</label>
        <Select value={duration} onValueChange={setDuration}>
          <SelectTrigger id="meeting-duration" className="h-10">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="15">15 minutes</SelectItem>
            <SelectItem value="30">30 minutes</SelectItem>
            <SelectItem value="45">45 minutes</SelectItem>
            <SelectItem value="60">1 hour</SelectItem>
            <SelectItem value="90">1.5 hours</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Location */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">Location / Link</label>
        <Select value={location} onValueChange={setLocation}>
          <SelectTrigger id="meeting-location" className="h-10">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Google Meet">Google Meet</SelectItem>
            <SelectItem value="Zoom">Zoom</SelectItem>
            <SelectItem value="Microsoft Teams">Microsoft Teams</SelectItem>
            <SelectItem value="Phone Call">Phone Call</SelectItem>
            <SelectItem value="In-Person">In-Person</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Recruiter email */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">Recruiter Email (you)</label>
        <Input
          id="meeting-recruiter-email"
          type="email"
          value={recruiterMail}
          onChange={(e) => setRecruiterMail(e.target.value)}
          placeholder="recruiter@kredmint.com"
        />
      </div>

      {/* Candidate email */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">Candidate Email</label>
        <Input
          id="meeting-candidate-email"
          type="email"
          value={candidateMail}
          onChange={(e) => setCandidateMail(e.target.value)}
          placeholder="candidate@email.com"
        />
        {!candidateMail && (
          <p className="text-xs text-amber-500">⚠ No candidate email on file — add it above to send invite.</p>
        )}
      </div>

      {/* Notes / Agenda */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">Agenda / Notes</label>
        <Textarea
          id="meeting-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          placeholder="Interview agenda, topics to cover…"
        />
      </div>

      {/* CTA */}
      <div className="space-y-2 pt-1">
        <Button
          id="meeting-schedule-btn"
          onClick={handleSchedule}
          className="w-full gap-2 h-11"
          size="lg"
        >
          <Calendar className="h-4 w-4" />
          Save &amp; Schedule on Google Calendar
        </Button>
        {saved && (
          <p className="text-center text-xs text-emerald-600 dark:text-emerald-400">
            ✓ Calendar opened — confirm and save the invite to notify both parties.
          </p>
        )}
      </div>

      {/* Info card */}
      <div className="rounded-md border border-border/60 bg-secondary/30 p-3 text-xs text-muted-foreground leading-relaxed">
        <strong className="text-foreground">How it works:</strong> Clicking "Save &amp; Schedule" opens Google Calendar
        with the event pre-filled. Review the details, then click <em>Save</em> in Google Calendar to send invites
        to both the recruiter and candidate via email.
      </div>
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────

export function CandidateDetail({
  candidateId, onClose,
}: {
  candidateId: string | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const open = candidateId != null;
  const [activeTab, setActiveTab] = useState<"overview" | "meeting">("overview");

  // Reset tab when a new candidate opens
  useEffect(() => { setActiveTab("overview"); }, [candidateId]);

  const { data, isLoading } = useQuery({
    queryKey: ["candidate", candidateId],
    queryFn: async (): Promise<Detail | null> => {
      if (!candidateId) return null;
      const data = await api.getCandidate(candidateId);
      if (!data) return null;
      return {
        ...data,
        match_scores: Array.isArray(data.match_scores) ? (data.match_scores[0] ?? null) : (data.match_scores ?? null),
      } as Detail;
    },
    enabled: !!candidateId,
  });

  const { data: activity = [] } = useQuery({
    queryKey: ["activity", candidateId],
    queryFn: async (): Promise<Activity[]> => {
      if (!candidateId) return [];
      return (await api.listActivity(candidateId)) as Activity[];
    },
    enabled: !!candidateId,
  });

  const [note, setNote] = useState("");
  useEffect(() => { setNote(""); }, [candidateId]);

  const logAction = async (action: Activity["action"], notes?: string) => {
    if (!candidateId) return;
    await api.addActivity(candidateId, { action, notes: notes ?? null });
    qc.invalidateQueries({ queryKey: ["activity", candidateId] });
  };

  const updateStage = useMutation({
    mutationFn: async (stage: PipelineStage) => {
      if (!candidateId) return;
      await api.updateCandidate(candidateId, { pipeline_stage: stage });
      await logAction("stage_changed", `→ ${STAGE_LABEL[stage]}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["candidate", candidateId] });
      qc.invalidateQueries({ queryKey: ["candidates"] });
      toast.success("Stage updated");
    },
  });

  const addNote = useMutation({
    mutationFn: async () => {
      if (!note.trim()) return;
      await logAction("note", note.trim());
      setNote("");
    },
  });

  const [isScoring, setIsScoring] = useState(false);
  const runScoring = async () => {
    if (!candidateId) return;
    setIsScoring(true);
    try {
      await api.scoreCandidate(candidateId);
      toast.success("Candidate scored successfully");
      qc.invalidateQueries({ queryKey: ["candidate", candidateId] });
      qc.invalidateQueries({ queryKey: ["candidates"] });
      if (data?.job_id) {
        qc.invalidateQueries({ queryKey: ["stats", data.job_id] });
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setIsScoring(false);
    }
  };

  const openResume = async () => {
    if (!data?.resume_url) { toast.error("No resume on file"); return; }
    if (/^https?:\/\//.test(data.resume_url)) {
      window.open(data.resume_url, "_blank", "noopener");
      return;
    }
    toast.error("Could not open resume");
  };

  const onCall = () => {
    if (!data?.phone) { toast.error("No phone number"); return; }
    logAction("called");
    window.location.href = `tel:${data.phone}`;
  };
  const onSms = () => {
    if (!data?.phone) { toast.error("No phone number"); return; }
    const body = `Hi ${data.name?.split(" ")[0] ?? ""}, I'm reaching out about the ${data.job?.title ?? "open"} role at Kredmint. Open to a quick chat?`;
    logAction("sms_sent");
    window.location.href = `sms:${data.phone}?body=${encodeURIComponent(body)}`;
  };
  const onEmail = () => {
    if (!data?.email) { toast.error("No email"); return; }
    const subject = `${data.job?.title ?? "Role"} at Kredmint — quick chat?`;
    const body = `Hi ${data.name?.split(" ")[0] ?? ""},\n\nWe came across your profile for the ${data.job?.title ?? "open"} role at Kredmint and would love to set up a quick call.\n\nBest,\nKredmint Talent`;
    logAction("email_sent");
    window.location.href = `mailto:${data.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto p-0 sm:max-w-xl">
        {isLoading || !data ? (
          <div className="space-y-4 p-6">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        ) : (
          <>
            <SheetHeader className="space-y-4 border-b border-border/60 bg-secondary/40 p-6">
              <SheetTitle className="sr-only">{data.name}</SheetTitle>
              <div className="flex items-start gap-4">
                <ScoreRing score={data.match_scores?.overall_score ?? null} tier={data.match_scores?.tier} />
                <div className="min-w-0 flex-1">
                  <div className="text-xl font-semibold leading-tight">{data.name}</div>
                  <div className="mt-0.5 text-sm text-muted-foreground">
                    {data.current_designation ?? "—"}{data.current_company ? ` @ ${data.current_company}` : ""}
                  </div>
                  {data.match_scores && <div className="mt-2"><TierBadge tier={data.match_scores.tier} /></div>}
                </div>
              </div>

              {/* Action bar */}
              <div className="grid grid-cols-3 gap-2">
                <Button onClick={onCall} className="h-12 gap-1.5"><Phone className="h-4 w-4" /> Call</Button>
                <Button onClick={onSms} variant="secondary" className="h-12 gap-1.5"><MessageSquare className="h-4 w-4" /> SMS</Button>
                <Button onClick={onEmail} variant="secondary" className="h-12 gap-1.5"><Mail className="h-4 w-4" /> Email</Button>
              </div>

              <div className="flex flex-wrap gap-2 text-xs">
                {data.naukri_profile_url && (
                  <a href={data.naukri_profile_url} target="_blank" rel="noreferrer"
                     className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 hover:bg-accent">
                    <ExternalLink className="h-3 w-3" /> Naukri
                  </a>
                )}
                {data.resume_url && (
                  <button onClick={openResume}
                          className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 hover:bg-accent">
                    <FileText className="h-3 w-3" /> Resume
                  </button>
                )}
              </div>
            </SheetHeader>

            {/* ── Tabs ──────────────────────────────────────────────── */}
            <div className="flex border-b border-border/60">
              <button
                id="tab-overview"
                onClick={() => setActiveTab("overview")}
                className={`flex-1 py-3 text-sm font-medium transition-colors ${
                  activeTab === "overview"
                    ? "border-b-2 border-primary text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Overview
              </button>
              <button
                id="tab-meeting"
                onClick={() => setActiveTab("meeting")}
                className={`flex-1 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-1.5 ${
                  activeTab === "meeting"
                    ? "border-b-2 border-primary text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <CalendarCheck className="h-3.5 w-3.5" />
                Meeting
              </button>
            </div>

            {/* ── Tab Content ───────────────────────────────────────── */}
            {activeTab === "meeting" ? (
              <MeetingTab candidate={data} />
            ) : (
              <div className="space-y-6 p-6">
                {/* Why this score */}
                {data.match_scores ? (
                  <section className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Why this score</h3>
                      <Button
                        onClick={runScoring}
                        disabled={isScoring}
                        variant="ghost"
                        size="sm"
                        className="h-8 gap-1 text-xs text-muted-foreground hover:text-foreground"
                      >
                        {isScoring ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                        Re-score
                      </Button>
                    </div>
                    {data.match_scores.ai_summary && (
                      <p className="text-sm leading-relaxed text-foreground">{data.match_scores.ai_summary}</p>
                    )}
                    <ReasonList items={data.match_scores.strengths} Icon={CheckCircle2} tone="text-tier-strong" label="Strengths" />
                    <ReasonList items={data.match_scores.gaps} Icon={AlertTriangle} tone="text-tier-possible" label="Gaps" />
                    <ReasonList items={data.match_scores.red_flags} Icon={Flag} tone="text-destructive" label="Red flags" />
                  </section>
                ) : (
                  <section className="rounded-md border border-dashed p-4 text-center">
                    <p className="text-sm text-muted-foreground mb-3">Not scored yet. You can run scoring specifically for this candidate now.</p>
                    <Button onClick={runScoring} disabled={isScoring} className="w-full gap-2" variant="outline">
                      {isScoring ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                      {isScoring ? "Scoring Candidate..." : "Score Candidate Now"}
                    </Button>
                  </section>
                )}

                {/* Facts */}
                <section className="space-y-2">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Candidate facts</h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <Fact Icon={Briefcase} label="Experience" value={data.total_experience_years != null ? `${data.total_experience_years} yrs` : "—"} />
                    <Fact Icon={Wallet} label="Salary" value={formatInr(data.annual_salary_inr)} />
                    <Fact Icon={Clock} label="Notice" value={data.notice_period ?? "—"} />
                    <Fact Icon={MapPin} label="Location" value={data.current_location ?? "—"} />
                    {data.preferred_locations && <Fact Icon={MapPin} label="Prefers" value={data.preferred_locations} />}
                    {data.education_summary && <Fact Icon={GraduationCap} label="Education" value={data.education_summary} />}
                  </div>
                </section>

                {/* Screening Q&A */}
                {data.screening_answers && Object.keys(data.screening_answers).length > 0 && (
                  <section className="space-y-2">
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Screening answers</h3>
                    <dl className="divide-y divide-border/60 rounded-md border border-border/60">
                      {Object.entries(data.screening_answers).map(([k, v]) => (
                        <div key={k} className="grid grid-cols-3 gap-3 p-3 text-sm">
                          <dt className="col-span-1 text-muted-foreground">{k}</dt>
                          <dd className="col-span-2 break-words">{String(v ?? "—")}</dd>
                        </div>
                      ))}
                    </dl>
                  </section>
                )}

                {/* Stage */}
                <section className="space-y-2">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Pipeline stage</h3>
                  <Select value={data.pipeline_stage} onValueChange={(v) => updateStage.mutate(v as PipelineStage)}>
                    <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                    <SelectContent>{STAGES.map((s) => <SelectItem key={s} value={s}>{STAGE_LABEL[s]}</SelectItem>)}</SelectContent>
                  </Select>
                </section>

                {/* Notes & activity */}
                <section className="space-y-3">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Notes &amp; activity</h3>
                  <div className="flex items-start gap-2">
                    <Textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Add a note…"
                      rows={2}
                      className="flex-1"
                    />
                    <Button onClick={() => addNote.mutate()} disabled={!note.trim()} size="icon" className="h-10 w-10">
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                  <ol className="space-y-2">
                    {activity.length === 0 && (
                      <li className="text-xs text-muted-foreground">No activity yet.</li>
                    )}
                    {activity.map((a) => (
                      <li key={a.id} className="rounded-md border border-border/60 p-3 text-sm">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span className="font-medium text-foreground">{ACTION_LABEL[a.action]}</span>
                          <span>{new Date(a.created_at).toLocaleString()}</span>
                        </div>
                        {a.notes && <div className="mt-1 whitespace-pre-wrap">{a.notes}</div>}
                        {a.actor && <div className="mt-1 text-xs text-muted-foreground">{a.actor}</div>}
                      </li>
                    ))}
                  </ol>
                </section>
              </div>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Fact({ Icon, label, value }: { Icon: typeof MapPin; label: string; value: string }) {
  return (
    <div className="rounded-md border border-border/60 p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />{label}
      </div>
      <div className="mt-1 text-sm font-medium">{value}</div>
    </div>
  );
}

function ReasonList({ items, Icon, tone, label }: { items: string[]; Icon: typeof CheckCircle2; tone: string; label: string }) {
  if (!items?.length) return null;
  return (
    <div className="space-y-1.5">
      <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
      <ul className="space-y-1.5">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2 text-sm">
            <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${tone}`} />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
