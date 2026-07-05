import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Heart, Play, AlertTriangle, Eye, ArrowLeft, Pencil } from "lucide-react";
import { toast } from "sonner";
import type { Edge, OptimizerInput, TopResult } from "@/lib/optimizer";
import type { WorkerOutbound } from "@/workers/optimizer.worker";
import OptimizerWorker from "@/workers/optimizer.worker?worker";

export const Route = createFileRoute("/_authenticated/classes/$id/configs/$configId/runs/$runId/")({
  head: () => ({ meta: [{ title: "Run — Group Creator" }] }),
  validateSearch: z.object({ autostart: z.coerce.number().optional().catch(undefined) }),
  component: RunPage,
});

type RunStatus = "pending" | "running" | "completed" | "error";

function RunPage() {
  const { id, configId, runId } = Route.useParams();
  const { autostart } = Route.useSearch();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const [progress, setProgress] = useState<{ elapsedMs: number; iterations: number; bestScore: number } | null>(null);
  const [running, setRunning] = useState(false);
  const [editingRunName, setEditingRunName] = useState(false);
  const [newRunName, setNewRunName] = useState("");
  const startedRef = useRef(false);
  const workerRef = useRef<Worker | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["run", runId],
    queryFn: async () => {
      const [run, absent, students, project, subs, dists] = await Promise.all([
        supabase.from("runs").select("id, name, status, time_limit_seconds, is_favorite, completed_at, error_message").eq("id", runId).single(),
        supabase.from("run_absent").select("student_id").eq("run_id", runId),
        supabase.from("students").select("id, name").eq("class_id", id).order("sort_order"),
        supabase.from("group_configs").select("id, name, group_size, size_policy").eq("id", configId).single(),
        supabase.from("submissions").select("id, student_id").eq("class_id", id),
        supabase.from("run_distributions").select("id, rank, score, is_favorite").eq("run_id", runId).order("rank"),
      ]);

      if (run.error) throw run.error;
      if (absent.error) throw absent.error;
      if (students.error) throw students.error;
      if (project.error) throw project.error;
      if (subs.error) throw subs.error;
      if (dists.error) throw dists.error;

      const submissionIds = (subs.data ?? []).map((s) => s.id);
      const prefsResult = submissionIds.length
        ? await supabase.from("preferences").select("submission_id, target_student_id, kind").in("submission_id", submissionIds)
        : null;
      if (prefsResult?.error) throw prefsResult.error;
      const prefs = prefsResult?.data ?? [];
      const subById = new Map((subs.data ?? []).map((s) => [s.id, s.student_id]));

      let distGroups: { distribution_id: string; group_index: number; student_id: string }[] = [];
      if ((dists.data ?? []).length) {
        const distIds = (dists.data ?? []).map((d) => d.id);
        const distGroupsResult = await supabase.from("run_distribution_groups").select("distribution_id, group_index, student_id").in("distribution_id", distIds);
        if (distGroupsResult.error) throw distGroupsResult.error;
        distGroups = distGroupsResult.data ?? [];
      }

      return {
        run: run.data!,
        absent: new Set((absent.data ?? []).map((r) => r.student_id)),
        students: students.data ?? [],
        project: project.data!,
        prefs: prefs
          .map((p) => ({ from: subById.get(p.submission_id), target: p.target_student_id, kind: p.kind as "with" | "avoid" }))
          .filter((p): p is { from: string; target: string; kind: "with" | "avoid" } => Boolean(p.from)),
        distributions: dists.data ?? [],
        distGroups,
      };
    },
  });

  useEffect(() => () => { workerRef.current?.terminate(); }, []);

  useEffect(() => {
    if (!data || startedRef.current) return;
    if (autostart === 1 && data.run.status === "pending") {
      startedRef.current = true;
      void startRun();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, autostart]);

  async function markRunError(message: string, detail?: string) {
    const errorMessage = detail ? `${message}: ${detail}` : message;
    const { error } = await supabase.from("runs").update({ status: "error", error_message: errorMessage }).eq("id", runId);
    if (error) toast.error(`${message}: ${error.message}`);
    await qc.invalidateQueries({ queryKey: ["run", runId] });
    refetch();
  }

  async function startRun() {
    if (!data) return;
    const activeIds = data.students.map((s) => s.id).filter((sid) => !data.absent.has(sid));
    if (activeIds.length === 0) {
      toast.error("No present students to group.");
      await markRunError("Run could not start", "No present students to group.");
      startedRef.current = false;
      return;
    }

    const activeSet = new Set(activeIds);
    const edges: Edge[] = data.prefs
      .filter((p) => activeSet.has(p.from) && activeSet.has(p.target))
      .map((p) => ({ a: p.from, b: p.target, kind: p.kind }));

    setRunning(true);
    setProgress({ elapsedMs: 0, iterations: 0, bestScore: 0 });
    const { error: statusError } = await supabase.from("runs").update({ status: "running", error_message: null, completed_at: null }).eq("id", runId);
    if (statusError) {
      toast.error(`Failed to start run: ${statusError.message}`);
      setRunning(false);
      startedRef.current = false;
      return;
    }
    await qc.invalidateQueries({ queryKey: ["run", runId] });

    let worker: Worker;
    try {
      worker = new OptimizerWorker();
    } catch (err) {
      toast.error("Failed to start optimizer: " + (err as Error).message);
      await markRunError("Optimizer failed to start", (err as Error).message);
      setRunning(false);
      startedRef.current = false;
      return;
    }
    workerRef.current = worker;

    const input: OptimizerInput = {
      studentIds: activeIds,
      groupSize: data.project.group_size,
      sizePolicy: data.project.size_policy as "plus" | "minus",
      edges,
      timeLimitMs: data.run.time_limit_seconds * 1000,
    };

    worker.onerror = async (e) => {
      toast.error("Optimizer crashed: " + (e.message || "unknown error"));
      await markRunError("Optimizer crashed", e.message || "unknown error");
      setRunning(false);
      worker.terminate();
      startedRef.current = false;
    };

    worker.onmessage = async (e: MessageEvent<WorkerOutbound>) => {
      const msg = e.data;
      if (msg.type === "progress") setProgress({ elapsedMs: msg.elapsedMs, iterations: msg.iterations, bestScore: msg.bestScore });
      else if (msg.type === "error") {
        toast.error(msg.error);
        await markRunError("Optimizer failed", msg.error);
        setRunning(false);
        worker.terminate();
        startedRef.current = false;
      } else if (msg.type === "done") {
        try {
          await persistResults(msg.result);
          toast.success("Run complete");
        } catch (err) {
          toast.error((err as Error).message);
          await markRunError("Results could not be saved", (err as Error).message);
        } finally {
          setRunning(false);
          worker.terminate();
          startedRef.current = false;
          await refetch();
        }
      }
    };
    worker.postMessage(input);
  }

  async function persistResults(results: TopResult[]) {
    const { error: deleteError } = await supabase.from("run_distributions").delete().eq("run_id", runId);
    if (deleteError) throw deleteError;

    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      const { data: dist, error } = await supabase.from("run_distributions").insert({ run_id: runId, rank: i + 1, score: r.score }).select("id").single();
      if (error || !dist) throw error ?? new Error("Insert failed");
      const rows: { distribution_id: string; group_index: number; student_id: string }[] = [];
      r.groups.forEach((g, gi) => g.forEach((sid) => rows.push({ distribution_id: dist.id, group_index: gi, student_id: sid })));
      if (rows.length) {
        const { error: rgErr } = await supabase.from("run_distribution_groups").insert(rows);
        if (rgErr) throw rgErr;
      }
    }

    const { error: completeError } = await supabase.from("runs").update({ status: "completed", completed_at: new Date().toISOString(), error_message: null }).eq("id", runId);
    if (completeError) throw completeError;
  }

  async function toggleRunFavorite() {
    if (!data) return;
    const next = !data.run.is_favorite;
    if (next) {
      const { error: clearError } = await supabase.from("runs").update({ is_favorite: false }).eq("config_id", configId);
      if (clearError) return toast.error(clearError.message);
    }
    const { error } = await supabase.from("runs").update({ is_favorite: next }).eq("id", runId);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["run", runId] });
    qc.invalidateQueries({ queryKey: ["project", configId] });
  }

  async function toggleDistFavorite(distId: string, current: boolean) {
    if (current) {
      const { error } = await supabase.from("run_distributions").update({ is_favorite: false }).eq("id", distId);
      if (error) return toast.error(error.message);
      qc.invalidateQueries({ queryKey: ["run", runId] });
      return;
    }

    const { error: clearError } = await supabase.from("run_distributions").update({ is_favorite: false }).eq("run_id", runId);
    if (clearError) return toast.error(clearError.message);

    const { error } = await supabase.from("run_distributions").update({ is_favorite: true }).eq("id", distId);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["run", runId] });
  }

  async function saveRunName() {
    if (!newRunName.trim() || !data?.run) return;
    try {
      const { error } = await supabase
        .from("runs")
        .update({ name: newRunName.trim() })
        .eq("id", runId);
      if (error) throw error;
      toast.success("Run name updated");
      setEditingRunName(false);
      await qc.invalidateQueries({ queryKey: ["run", runId] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  if (isLoading || !data) return <p className="text-sm text-muted-foreground">Loading…</p>;

  const nameById = new Map(data.students.map((s) => [s.id, s.name]));
  const groupsByDist = new Map<string, string[][]>();
  for (const row of data.distGroups) {
    if (!groupsByDist.has(row.distribution_id)) groupsByDist.set(row.distribution_id, []);
    const arr = groupsByDist.get(row.distribution_id)!;
    if (!arr[row.group_index]) arr[row.group_index] = [];
    arr[row.group_index].push(row.student_id);
  }

  const status = data.run.status as RunStatus;
  const timeSec = data.run.time_limit_seconds;
  const pct = progress ? Math.min(100, (progress.elapsedMs / (timeSec * 1000)) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <Link to="/classes/$id/configs/$configId" params={{ id, configId }} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to project
          </Link>
          {editingRunName ? (
            <div className="mt-2">
              <Input
                value={newRunName}
                onChange={(e) => setNewRunName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setEditingRunName(false);
                }}
                onBlur={saveRunName}
                autoFocus
                className="text-2xl font-semibold"
              />
            </div>
          ) : (
            <div
              className="mt-2 flex items-center gap-2 cursor-pointer group"
              onClick={() => {
                setEditingRunName(true);
                setNewRunName(data?.run.name || "Run");
              }}
              title="Click to edit run name"
            >
              <h1 className="text-2xl font-semibold group-hover:text-muted-foreground">
                {data?.run.name || "Run"}
              </h1>
              <Pencil className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          )}
          <p className="text-sm text-muted-foreground">
            {data.project.name} · {timeSec}s time limit · {data.absent.size} absent · status: {status}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={toggleRunFavorite}>
          <Heart className={`mr-1.5 h-4 w-4 ${data.run.is_favorite ? "fill-primary text-primary" : ""}`} />
          {data.run.is_favorite ? "Favorite run" : "Mark as favorite"}
        </Button>
      </div>

      {(status === "pending" || status === "running" || status === "error") && !running && (
        <Card>
          <CardContent className="flex flex-col items-start gap-3 py-6">
            <div className="flex items-start gap-2 text-amber-900 dark:text-amber-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p className="text-sm">
                {status === "running"
                  ? "This run was started earlier, but no browser is currently computing it here. Start it again to recompute the results."
                  : "Don't close this tab while the run is computing. The optimization runs in your browser."}
              </p>
            </div>
            {status === "error" && data.run.error_message && (
              <p className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
                {data.run.error_message}
              </p>
            )}
            <Button onClick={() => { startedRef.current = true; void startRun(); }}>
              <Play className="mr-1.5 h-4 w-4" /> {status === "running" || status === "error" ? "Restart run" : "Start run"}
            </Button>
          </CardContent>
        </Card>
      )}

      {running && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Optimizing…</CardTitle>
            <CardDescription>Keep this tab open. Closing it cancels the run.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Progress value={pct} />
            <div className="flex justify-between text-xs tabular-nums text-muted-foreground">
              <span>{Math.floor((progress?.elapsedMs ?? 0) / 1000)}s / {timeSec}s</span>
              <span>{progress?.iterations ?? 0} iterations</span>
              <span>Best score: {progress?.bestScore ?? 0}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {status === "completed" && data.distributions.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Top {data.distributions.length} distributions</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {data.distributions.map((d) => {
              const groups = groupsByDist.get(d.id) ?? [];
              return (
                <Card key={d.id}>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-base">#{d.rank} · Score {d.score}</CardTitle>
                      <CardDescription>{groups.length} groups</CardDescription>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" onClick={() => toggleDistFavorite(d.id, d.is_favorite)} aria-label="Favorite distribution">
                        <Heart className={`h-4 w-4 ${d.is_favorite ? "fill-primary text-primary" : ""}`} />
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => navigate({ to: "/classes/$id/configs/$configId/runs/$runId/distributions/$distId/present", params: { id, configId, runId, distId: d.id } })}>
                        <Eye className="mr-1.5 h-4 w-4" /> View
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {groups.map((g, gi) => (
                        <div key={gi} className="rounded-md border border-border p-2.5">
                          <div className="mb-1 text-xs font-medium text-muted-foreground">Group {gi + 1}</div>
                          <div className="flex flex-wrap gap-1.5">
                            {g.map((sid) => (
                              <span key={sid} className="rounded-full bg-muted px-2 py-0.5 text-xs">{nameById.get(sid) ?? sid}</span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}