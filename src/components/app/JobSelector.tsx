import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Briefcase } from "lucide-react";
import { toast } from "sonner";

export type Job = { id: string; title: string; jd_text: string; created_at: string };

export function JobSelector({
  selectedId,
  onSelect,
}: {
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [jd, setJd] = useState("");

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ["jobs"],
    queryFn: async (): Promise<Job[]> => {
      const { data, error } = await supabase
        .from("jobs")
        .select("id, title, jd_text, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!title.trim()) throw new Error("Title is required");
      const { data, error } = await supabase
        .from("jobs")
        .insert({ title: title.trim(), jd_text: jd.trim() })
        .select("id, title, jd_text, created_at")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (job) => {
      qc.invalidateQueries({ queryKey: ["jobs"] });
      onSelect(job.id);
      setOpen(false);
      setTitle("");
      setJd("");
      toast.success("Job created");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="flex items-center gap-2">
      <Select value={selectedId ?? undefined} onValueChange={onSelect} disabled={isLoading || jobs.length === 0}>
        <SelectTrigger className="h-10 min-w-[16rem] gap-2">
          <Briefcase className="h-4 w-4 text-muted-foreground" />
          <SelectValue placeholder={isLoading ? "Loading…" : jobs.length === 0 ? "No jobs yet" : "Select job"} />
        </SelectTrigger>
        <SelectContent>
          {jobs.map((j) => (
            <SelectItem key={j.id} value={j.id}>
              {j.title}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="h-10 gap-1.5">
            <Plus className="h-4 w-4" /> New job
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create a job</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enterprise Sales Senior Manager / DGM"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="jd">Job description</Label>
              <Textarea
                id="jd"
                rows={9}
                value={jd}
                onChange={(e) => setJd(e.target.value)}
                placeholder="Paste the full JD. Candidates are scored against this text."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => create.mutate()} disabled={create.isPending}>
              {create.isPending ? "Creating…" : "Create job"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
