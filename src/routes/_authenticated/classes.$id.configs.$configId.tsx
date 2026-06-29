import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Sparkles, RefreshCw, UserPlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { generateGroups, addStudentToBestGroup, type Edge } from "@/lib/grouping";

export const Route = createFileRoute("/_authenticated/classes/$id/configs/$configId")({
  head: () => ({ meta: [{ title: "Configuration — Group Creator" }] }),
  component: ConfigDetail,
});

function ConfigDetail() {
  const { id, configId } = Route.useParams();
  const qc = useQueryClient();
  const [pendingAbsent, setPendingAbsent] = useState<Set<string> | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["config", configId],
    queryFn: async () => {
      const [cfg, students, absent, subs, generated] = await Promise.all([
        supabase.from("group_configs").select("id, name, group_size, size_policy, generated_at, class_id").eq("id", configId).single(),
        supabase.from("students").select("id, name").eq("class_id", id).order("sort_order"),
        supabase.from("group_config_absent").select("student_id").eq("config_id", configId),
        supabase.from("submissions").select("id, student_id").eq("class_id", id),
        supabase.from("generated_groups").select("group_index, student_id").eq("config_id", configId),
      ]);
      // Fetch all preferences for the class submissions
      const subIds = (subs.data ?? []).map((s) => s.id);
      let prefs: { submission_id: string; target_student_id: string; kind: "with" | "avoid" }[] = [];
      if (subIds.length > 0) {
        const { data: prefData } = await supabase
          .from("preferences")
          .select("submission_id, target_student_id, kind")
          .in("submission_id", subIds);
        prefs = (prefData ?? []) as typeof prefs;
      }
      return {
        cfg: cfg.data,
        students: students.data ?? [],
        absent: new Set((absent.data ?? []).map((a) => a.student_id)),
        submissions: subs.data ?? [],
        prefs,
        generated: generated.data ?? [],
      };
    },
  });

  const studentName = useMemo(() => {
    const m = new Map<string, string>();
    data?.students.forEach((s) => m.set(s.id, s.name));
    return m;
  }, [data]);

  // Build edges from prefs (mapped from submission_id back to student_id)
  const edges: Edge[] = useMemo(() => {
    if (!data) return [];
    const subToStudent = new Map(data.submissions.map((s) => [s.id, s.student_id]));
    return data.prefs
      .map((p) => {
        const a = subToStudent.get(p.submission_id);
        if (!a) return null;
        return { a, b: p.target_student_id, kind: p.kind } as Edge;
      })
      .filter((x): x is Edge => x !== null);
  }, [data]);

  const generatedGroups: string[][] = useMemo(() => {
    if (!data) return [];
    const map = new Map<number, string[]>();
    for (const g of data.generated) {
      if (!map.has(g.group_index)) map.set(g.group_index, []);
      map.get(g.group_index)!.push(g.student_id);
    }
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]).map(([, v]) => v);
  }, [data]);

  const inAnyGroup = useMemo(() => new Set(generatedGroups.flat()), [generatedGroups]);

  if (isLoading || !data?.cfg) return <p className="text-sm text-muted-foreground">Loading…</p>;

  const currentAbsent = pendingAbsent ?? data.absent;
  const hasPendingChanges = pendingAbsent !== null;

  async function persistGroups(groups: string[][]) {
    await supabase.from("generated_groups").delete().eq("config_id", configId);
    const rows = groups.flatMap((g, i) => g.map((sid) => ({ config_id: configId, group_index: i, student_id: sid })));
    if (rows.length > 0) {
      const { error } = await supabase.from("generated_groups").insert(rows);
      if (error) throw error;
    }
    await supabase.from("group_configs").update({ generated_at: new Date().toISOString() }).eq("id", configId);
  }

  async function regenerate() {
    if (!data || !data.cfg) return;
    const cfg = data.cfg;
    try {
      // Persist absent changes
      if (pendingAbsent) {
        await supabase.from("group_config_absent").delete().eq("config_id", configId);
        if (pendingAbsent.size > 0) {
          await supabase.from("group_config_absent").insert(
            Array.from(pendingAbsent).map((sid) => ({ config_id: configId, student_id: sid })),
          );
        }
      }
      const presentIds = data.students.map((s) => s.id).filter((sid) => !currentAbsent.has(sid));
      const result = generateGroups({
        studentIds: presentIds,
        groupSize: cfg.group_size,
        sizePolicy: cfg.size_policy as "flex" | "strict",
        edges,
      });
      await persistGroups(result.groups);
      setPendingAbsent(null);
      qc.invalidateQueries({ queryKey: ["config", configId] });
      toast.success(`Generated ${result.groups.length} groups`);
      if (result.unsatisfiedWith > 0) {
        toast.message(`${result.unsatisfiedWith} "with" preference${result.unsatisfiedWith === 1 ? "" : "s"} couldn't be satisfied.`);
      }
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function addAbsent(studentId: string) {
    if (!data || !data.cfg) return;
    const cfg = data.cfg;
    try {
      const { groups: next, createdNewGroup } = addStudentToBestGroup(
        generatedGroups, studentId, edges, cfg.group_size, cfg.size_policy as "flex" | "strict",
      );
      await persistGroups(next);
      // remove from absent
      await supabase.from("group_config_absent").delete().eq("config_id", configId).eq("student_id", studentId);
      qc.invalidateQueries({ queryKey: ["config", configId] });
      toast.success(createNewMessage(createdNewGroup, studentName.get(studentId)!));
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  function createNewMessage(createdNew: boolean, name: string) {
    return createdNew ? `Added ${name} to a new group` : `Added ${name} to the best-fit group`;
  }

  async function deleteConfig() {
    if (!confirm("Delete this configuration?")) return;
    await supabase.from("group_configs").delete().eq("id", configId);
    toast.success("Configuration deleted");
    window.history.back();
  }

  const absenteesNotInGroup = data.students.filter((s) => currentAbsent.has(s.id) && !inAnyGroup.has(s.id));

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between">
        <div>
          <Link to="/classes/$id" params={{ id }} className="text-sm text-muted-foreground hover:text-foreground">← Back to class</Link>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">{data.cfg.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Groups of {data.cfg.group_size} · {data.cfg.size_policy === "strict" ? "strict size" : "±1 allowed"}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={deleteConfig} className="text-destructive hover:text-destructive">
          <Trash2 className="mr-1.5 h-4 w-4" /> Delete
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Absent / excluded students</CardTitle>
          <CardDescription>Toggle students off; click {data.cfg.generated_at ? '"Generate new groups"' : '"Generate groups"'} to apply.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {data.students.map((s) => (
              <label key={s.id} className="flex cursor-pointer items-center gap-2 rounded-md border border-border bg-card px-2 py-1.5">
                <Checkbox
                  checked={currentAbsent.has(s.id)}
                  onCheckedChange={() => {
                    const next = new Set(currentAbsent);
                    if (next.has(s.id)) next.delete(s.id); else next.add(s.id);
                    setPendingAbsent(next);
                  }}
                />
                <span className="text-sm">{s.name}</span>
              </label>
            ))}
          </div>
          {hasPendingChanges && (
            <p className="text-xs text-primary">Unsaved changes — click below to apply.</p>
          )}
          <div className="flex gap-2">
            <Button onClick={regenerate}>
              {data.cfg.generated_at ? <RefreshCw className="mr-1.5 h-4 w-4" /> : <Sparkles className="mr-1.5 h-4 w-4" />}
              {data.cfg.generated_at ? "Generate new groups" : "Generate groups"}
            </Button>
            {hasPendingChanges && (
              <Button variant="ghost" onClick={() => setPendingAbsent(null)}>Discard</Button>
            )}
          </div>
        </CardContent>
      </Card>

      {absenteesNotInGroup.length > 0 && generatedGroups.length > 0 && (
        <Card className="border-primary/30 bg-accent">
          <CardHeader>
            <CardTitle className="text-base text-accent-foreground">Add a previously absent student</CardTitle>
            <CardDescription className="text-accent-foreground/70">Slots the student into the best-fit existing group without disturbing the others.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {absenteesNotInGroup.map((s) => (
              <Button key={s.id} variant="outline" size="sm" onClick={() => addAbsent(s.id)}>
                <UserPlus className="mr-1.5 h-4 w-4" /> Add {s.name}
              </Button>
            ))}
          </CardContent>
        </Card>
      )}

      <div>
        <h2 className="mb-3 text-lg font-semibold">Groups</h2>
        {generatedGroups.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              No groups generated yet. Click "Generate groups" above.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {generatedGroups.map((group, i) => (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Group {i + 1} · {group.length}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-1">
                    {group.map((sid) => (
                      <li key={sid} className="text-sm">{studentName.get(sid) ?? "Unknown"}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}