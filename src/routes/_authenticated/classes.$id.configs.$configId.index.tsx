import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Plus, Play, Heart, AlertTriangle, Trash2, Eye } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/classes/$id/configs/$configId/")({
  head: () => ({ meta: [{ title: "Project — Group Creator" }] }),
  component: ProjectPage,
});

type RunCard = {
  id: string;
  name: string;
  created_at: string;
  time_limit_seconds: number;
  status: string;
  is_favorite: boolean;
  error_message: string | null;
  favorite_distribution_id: string | null;
};

function ProjectPage() {
  const { id, configId } = Route.useParams();
  const qc = useQueryClient();
  const [runOpen, setRunOpen] = useState(false);
  const [runToDelete, setRunToDelete] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [favoriteLoading, setFavoriteLoading] = useState<string | null>(null);

  async function toggleRunFavorite(runId: string, nextFavorite: boolean) {
    setFavoriteLoading(runId);
    try {
      const { error } = await supabase.from("runs").update({ is_favorite: nextFavorite }).eq("id", runId);
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["project", configId] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setFavoriteLoading(null);
    }
  }

  const { data, isLoading } = useQuery({
    queryKey: ["project", configId],
    queryFn: async () => {
      const [proj, students, runs, favoriteDists] = await Promise.all([
        supabase.from("group_configs").select("id, name, group_size, size_policy").eq("id", configId).single(),
        supabase.from("students").select("id, name").eq("class_id", id).order("sort_order"),
        supabase
          .from("runs")
          .select("id, name, created_at, time_limit_seconds, status, is_favorite, error_message")
          .eq("config_id", configId)
          .order("created_at", { ascending: false }),
        supabase.from("run_distributions").select("run_id, id").eq("is_favorite", true),
      ]);

      if (proj.error) throw proj.error;
      if (students.error) throw students.error;
      if (runs.error) throw runs.error;
      if (favoriteDists.error) throw favoriteDists.error;

      const favoriteByRunId = new Map((favoriteDists.data ?? []).map((d) => [d.run_id, d.id]));

      return {
        project: proj.data,
        students: students.data ?? [],
        runs: (runs.data ?? []).map((run, idx, arr) => ({
          ...run,
          favorite_distribution_id: favoriteByRunId.get(run.id) ?? null,
        })) as RunCard[],
      };
    },
  });

  if (isLoading || !data || !data.project) return <div className="text-sm text-muted-foreground">Loading…</div>;
  const project = data.project;

  return (
    <div className="space-y-6">
      <div>
        <Link to="/classes/$id" params={{ id }} className="text-sm text-muted-foreground hover:underline">← Back to class</Link>
        <h1 className="mt-2 text-2xl font-semibold">{project.name}</h1>
        <p className="text-sm text-muted-foreground">
          Groups of {project.group_size} · {project.size_policy === "plus" ? "some groups with 1 additional person" : "some groups with 1 fewer person"}
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Runs</CardTitle>
            <CardDescription>Each run computes 5 group distributions.</CardDescription>
          </div>
          <Button size="sm" onClick={() => setRunOpen(true)}><Plus className="mr-1.5 h-4 w-4" /> New run</Button>
        </CardHeader>
        <CardContent>
          {data.runs.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No runs yet. Create one to compute groups.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {data.runs.map((r) => (
                <RunCardLink
                  key={r.id}
                  run={r}
                  classId={id}
                  configId={configId}
                  favoriteLoading={favoriteLoading === r.id}
                  onToggleFavorite={() => toggleRunFavorite(r.id, !r.is_favorite)}
                  onDelete={() => { setRunToDelete(r.id); setConfirmOpen(true); }}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={confirmOpen} onOpenChange={(o) => { if (!o) { setConfirmOpen(false); setRunToDelete(null); } else setConfirmOpen(true); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Delete run</DialogTitle>
            <DialogDescription>Are you sure you want to delete this run? The results will no longer be available.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <div className="flex gap-2">
              <Button variant="outline" disabled={deleting} onClick={() => { setConfirmOpen(false); setRunToDelete(null); }}>Cancel</Button>
              <Button variant="destructive" disabled={deleting} onClick={async () => {
                if (!runToDelete) return;
                setDeleting(true);
                try {
                  const { error } = await supabase.from("runs").delete().eq("id", runToDelete);
                  if (error) throw error;
                  toast.success("Run deleted");
                  await qc.invalidateQueries({ queryKey: ["project", configId] });
                } catch (e) {
                  toast.error((e as Error).message);
                } finally {
                  setDeleting(false);
                  setConfirmOpen(false);
                  setRunToDelete(null);
                }
              }}>{deleting ? "Deleting…" : "Delete"}</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <NewRunDialog
        open={runOpen}
        onOpenChange={setRunOpen}
        classId={id}
        configId={configId}
        students={data.students}
        defaultName={`Run ${data.runs.length + 1}`}
        onCreated={() => qc.invalidateQueries({ queryKey: ["project", configId] })}
      />
    </div>
  );
}

function RunCardLink({
  run, classId, configId, favoriteLoading, onToggleFavorite, onDelete,
}: {
  run: RunCard;
  classId: string;
  configId: string;
  favoriteLoading: boolean;
  onToggleFavorite: () => void;
  onDelete: () => void;
}) {
  const navigate = useNavigate();
  const statusClass =
    run.status === "completed" ? "text-green-600 dark:text-green-400" :
    run.status === "running" ? "text-amber-600" :
    run.status === "error" ? "text-destructive" : "text-muted-foreground";

  const statusLabel = 
    run.status === "completed" ? "Succeeded. Click to view distributions." :
    run.status === "running" ? "In progress" :
    run.status;

  return (
    <div className="relative group rounded-xl border border-border bg-card p-4 shadow-sm transition-colors hover:border-slate-400 hover:bg-muted/30">
      <Link
        to="/classes/$id/configs/$configId/runs/$runId"
        params={{ id: classId, configId, runId: run.id }}
        className="block pr-12"
      >
        <div className="space-y-1">
          {run.name && <div className="pr-6 text-sm font-medium">{run.name}</div>}
          <div className="text-xs text-muted-foreground">
            {new Date(run.created_at).toLocaleString()}
          </div>
          <div className="text-xs text-muted-foreground">
            {run.time_limit_seconds}s time limit
          </div>
          <div className="text-xs">
            <span className={statusClass}>{statusLabel}</span>
          </div>
          {run.status === "error" && run.error_message && (
            <p className="line-clamp-2 pt-1 text-xs text-destructive">{run.error_message}</p>
          )}
        </div>
      
      <button
        type="button"
        aria-label={run.is_favorite ? "Remove from favorites" : "Add to favorites"}
        title={run.is_favorite ? "Remove from favorites" : "Add to favorites"}
        disabled={favoriteLoading}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onToggleFavorite();
        }}
        className="absolute right-3 top-3 z-10 rounded-md p-1 transition-colors hover:bg-primary/10 disabled:opacity-50"
      >
        <Heart
          className={`h-4 w-4 ${run.is_favorite ? "fill-primary text-primary" : "text-muted-foreground"}`}
          fill={run.is_favorite ? "currentColor" : "none"}
        />
      </button>
      <button
        type="button"
        aria-label="Delete run"
        title="Delete run"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onDelete();
        }}
        className="absolute right-3 top-10 z-10 rounded-md p-1 text-destructive transition-opacity hover:bg-destructive/10 focus:opacity-100"
      >
        <Trash2 className="h-4 w-4" />
      </button>
      </Link>
      {run.status === "completed" && run.favorite_distribution_id && (
        <button
          type="button"
          aria-label="View favorite distribution"
          title="View favorite distribution"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            navigate({
              to: "/classes/$id/configs/$configId/runs/$runId/distributions/$distId/present",
              params: { id: classId, configId, runId: run.id, distId: run.favorite_distribution_id! },
            });
          }}
          className="absolute right-3 top-18 z-10 rounded-md p-1 transition-colors hover:bg-primary/10 focus:opacity-100"
        >
          <Eye className="h-4 w-4 text-muted-foreground" />
        </button>
      )}
    </div>
  );
}

function NewRunDialog({
  open, onOpenChange, classId, configId, students, defaultName, onCreated,
}: {
  open: boolean; onOpenChange: (o: boolean) => void;
  classId: string; configId: string;
  students: { id: string; name: string }[];
  defaultName: string;
  onCreated: () => void;
}) {
  const [absent, setAbsent] = useState<Set<string>>(new Set());
  const [seconds, setSeconds] = useState(10);
  const [name, setName] = useState(defaultName);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (open) setName(defaultName);
  }, [open, defaultName]);

  function toggle(id: string) {
    const next = new Set(absent);
    if (next.has(id)) next.delete(id); else next.add(id);
    setAbsent(next);
  }

  async function createAndStart() {
    setLoading(true);
    try {
      const { data: run, error } = await supabase
        .from("runs")
        .insert({ config_id: configId, name: name.trim() || defaultName, time_limit_seconds: seconds, status: "pending", error_message: null })
        .select("id")
        .single();
      if (error || !run) throw error ?? new Error("Failed to create run");

      if (absent.size > 0) {
        const { error: absentError } = await supabase.from("run_absent").insert(
          Array.from(absent).map((sid) => ({ run_id: run.id, student_id: sid })),
        );
        if (absentError) throw absentError;
      }

      await onCreated();
      onOpenChange(false);
      navigate({ to: "/classes/$id/configs/$configId/runs/$runId", params: { id: classId, configId, runId: run.id }, search: { autostart: 1 } });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New run</DialogTitle>
          <DialogDescription>
            The optimization runs in your browser. Keep this tab open — closing it cancels the computation. Your settings are saved, so you can re-run with one click.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          <div>
            <Label htmlFor="run-name">Run name</Label>
            <Input id="run-name" value={name} onChange={(e) => setName(e.target.value)} className="mt-2" />
          </div>
          <div>
            <Label>Absent students (excluded from this run)</Label>
            <div className="mt-2 max-h-56 space-y-1.5 overflow-auto rounded-md border border-border p-3">
              {students.length === 0 && <p className="text-sm text-muted-foreground">No students in this class.</p>}
              {students.map((s) => (
                <label key={s.id} className="flex cursor-pointer items-center gap-2">
                  <Checkbox checked={absent.has(s.id)} onCheckedChange={() => toggle(s.id)} />
                  <span className="text-sm">{s.name}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between">
              <Label>Time to run</Label>
              <span className="text-sm tabular-nums text-muted-foreground">
                {seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60 ? `${seconds % 60}s` : ""}`.trim()}
              </span>
            </div>
            <Slider min={5} max={180} step={5} value={[seconds]} onValueChange={(v) => setSeconds(v[0])} className="mt-3" />
            <p className="mt-1 text-xs text-muted-foreground">Longer runs explore more solutions, increasing the chance of finding the optimal distribution.</p>
          </div>
          <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p className="text-xs">Don't close this browser tab while a run is computing — you'll have to start it again. Your settings will be saved so you can re-run instantly.</p>
          </div>
        </div>
        <DialogFooter>
          <Button disabled={loading} onClick={createAndStart}>
            <Play className="mr-1.5 h-4 w-4" /> {loading ? "Starting…" : "Run"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}