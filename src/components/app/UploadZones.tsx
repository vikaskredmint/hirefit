import { useCallback, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileSpreadsheet, FileText, Upload, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { api, isBackendConfigured } from "@/lib/api";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

type Candidate = { id: string; name: string };

function DropZone({
  title,
  hint,
  Icon,
  accept,
  multiple,
  busy,
  onFiles,
}: {
  title: string;
  hint: string;
  Icon: typeof FileSpreadsheet;
  accept: string;
  multiple?: boolean;
  busy?: boolean;
  onFiles: (files: File[]) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);

  return (
    <Card
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        const files = Array.from(e.dataTransfer.files);
        if (files.length) onFiles(files);
      }}
      className={cn(
        "flex flex-col items-center justify-center gap-2 border-2 border-dashed p-6 text-center transition-colors",
        drag ? "border-primary bg-primary/5" : "border-border/70",
      )}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-primary">
        {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Icon className="h-5 w-5" />}
      </div>
      <div className="text-sm font-semibold">{title}</div>
      <div className="text-xs text-muted-foreground">{hint}</div>
      <input
        ref={input}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length) onFiles(files);
          e.target.value = "";
        }}
      />
      <Button size="sm" variant="outline" className="mt-2 gap-1.5" disabled={busy} onClick={() => input.current?.click()}>
        <Upload className="h-3.5 w-3.5" /> Choose {multiple ? "files" : "file"}
      </Button>
    </Card>
  );
}

export function UploadZones({ jobId }: { jobId: string }) {
  const qc = useQueryClient();
  const [importing, setImporting] = useState(false);
  const [uploadingResumes, setUploadingResumes] = useState(false);

  const onXlsx = useCallback(async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    if (!isBackendConfigured()) {
      toast.error("Scoring backend isn't connected yet — Excel import needs the Node service. Set VITE_API_BASE_URL and redeploy.");
      return;
    }
    setImporting(true);
    try {
      const r = await api.importCandidates(jobId, file);
      toast.success(`Imported ${r.imported} candidates (${r.skipped} skipped)`);
      qc.invalidateQueries({ queryKey: ["candidates", jobId] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setImporting(false);
    }
  }, [jobId, qc]);

  const onPdfs = useCallback(async (files: File[]) => {
    if (!isBackendConfigured()) {
      toast.error("Resume upload needs the Node backend (PDF text extraction). Set VITE_API_BASE_URL and redeploy.");
      return;
    }
    setUploadingResumes(true);
    try {
      const list = (await api.listCandidates(jobId)) as Candidate[];

      let matched = 0;
      let unmatched: string[] = [];
      for (const file of files) {
        const fname = file.name.toLowerCase().replace(/\.pdf$/i, "");
        const hit = list.find((c) => {
          const n = c.name.toLowerCase();
          return fname.includes(n) || n.split(/\s+/).every((p) => p.length > 2 && fname.includes(p));
        });
        if (!hit) { unmatched.push(file.name); continue; }
        try {
          await api.uploadResume(hit.id, file);
          matched++;
        } catch (e) {
          unmatched.push(file.name);
          console.error(e);
        }
      }
      toast.success(`Attached ${matched} resume${matched === 1 ? "" : "s"}` + (unmatched.length ? ` · ${unmatched.length} couldn't be matched` : ""));
      qc.invalidateQueries({ queryKey: ["candidates", jobId] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploadingResumes(false);
    }
  }, [jobId, qc]);

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <DropZone
        title="Upload Naukri Excel export"
        hint="Drop the .xlsx you downloaded from Naukri. We'll create the candidate rows."
        Icon={FileSpreadsheet}
        accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        busy={importing}
        onFiles={onXlsx}
      />
      <DropZone
        title="Upload resumes"
        hint="Drop multiple PDF, DOC or DOCX resumes at once. We'll auto-match by filename."
        Icon={FileText}
        accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        multiple
        busy={uploadingResumes}
        onFiles={onPdfs}
      />
    </div>
  );
}
