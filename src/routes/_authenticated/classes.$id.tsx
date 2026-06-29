import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Copy, Link as LinkIcon, Trash2, Plus, CheckCircle2, Circle, Settings } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/classes/$id")({
  head: () => ({ meta: [{ title: "Class — Grouply" }] }),
  component: ClassDetail,
});

function ClassDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [configOpen, setConfigOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["class", id],
    queryFn: async () => {
      const [cls, students, link, subs, configs] = await Promise.all([
        supabase.from("classes").select("id, name").eq("id", id).single(),
        supabase.from("students").select("id, name").eq("class_id", id).order("sort_order"),
        supabase.from("share_links").select("token").eq("class_id", id).limit(1).maybeSingle(),
        supabase.from("submissions").select("student_id, submitted_at").eq("class_id", id),
        supabase.from("group_configs").select("id, name, group_size, size_policy, generated_at").eq("class_id", id).order("created_at", { ascending: false }),
      ]);
      return {
        cls: cls.data, students: students.data ?? [], link: link.data, submissions: subs.data ?? [], configs: configs.data ?? [],
      };
    },
  });

  async function deleteClass() {
    if (!confirm("Delete this class and all its data? This cannot be undone.")) return;
    const { error } = await supabase.from("classes").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Class deleted");
    navigate({ to: "/dashboard" });
  }

  async function resetSubmission(studentId: string) {
    if (!confirm("Reset this student's submission? Their preferences will be cleared.")) return;
    await supabase.from("submissions").delete().eq("class_id", id).eq("student_id", studentId);
    qc.invalidateQueries({ queryKey: ["class", id] });
    toast.success("Submission cleared");
  }

  if (isLoading || !data?.cls) return <p className="text-sm text-muted-foreground">Loading…</p>;

  const shareUrl = data.link ? `${window.location.origin}/s/${data.link.token}` : "";
  const submittedSet = new Set(data.submissions.map((s) => s.student_id));
  const submittedAt = new Map(data.submissions.map((s) => [s.student_id, s.submitted_at]));

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between">
        <div>
          <Link to="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">← All classes</Link>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">{data.cls.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {submittedSet.size} of {data.students.length} students have submitted
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={deleteClass} className="text-destructive hover:text-destructive">
          <Trash2 className="mr-1.5 h-4 w-4" /> Delete class
        </Button>
      </div>

      {shareUrl && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><LinkIcon className="h-4 w-4" /> Student link</CardTitle>
            <CardDescription>Share this with your students. They open it, pick their name, and fill the form.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input readOnly value={shareUrl} className="font-mono text-xs" />
              <Button variant="outline" onClick={() => { navigator.clipboard.writeText(shareUrl); toast.success("Link copied"); }}>
                <Copy className="mr-1.5 h-4 w-4" /> Copy
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Roster</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="divide-y divide-border">
            {data.students.map((s) => {
              const done = submittedSet.has(s.id);
              return (
                <li key={s.id} className="flex items-center justify-between py-2.5">
                  <div className="flex items-center gap-3">
                    {done ? (
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                    ) : (
                      <Circle className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span>{s.name}</span>
                    {done && (
                      <span className="text-xs text-muted-foreground">
                        — submitted {new Date(submittedAt.get(s.id)!).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  {done && (
                    <Button variant="ghost" size="sm" onClick={() => resetSubmission(s.id)}>Reset</Button>
                  )}
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Group configurations</CardTitle>
            <CardDescription>Create a config to generate groups for a specific project.</CardDescription>
          </div>
          <Button size="sm" onClick={() => setConfigOpen(true)}><Plus className="mr-1.5 h-4 w-4" /> New config</Button>
        </CardHeader>
        <CardContent>
          {data.configs.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No configurations yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {data.configs.map((c) => (
                <li key={c.id}>
                  <Link
                    to="/classes/$id/configs/$configId"
                    params={{ id, configId: c.id }}
                    className="flex items-center justify-between py-3 hover:bg-muted/40 -mx-2 px-2 rounded-md"
                  >
                    <div>
                      <div className="font-medium">{c.name}</div>
                      <div className="text-xs text-muted-foreground">
                        Groups of {c.group_size} · {c.size_policy === "strict" ? "strict size" : "±1 allowed"}
                        {c.generated_at ? ` · generated ${new Date(c.generated_at).toLocaleDateString()}` : " · not yet generated"}
                      </div>
                    </div>
                    <Settings className="h-4 w-4 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <NewConfigDialog
        open={configOpen}
        onOpenChange={setConfigOpen}
        classId={id}
        students={data.students}
        onCreated={() => qc.invalidateQueries({ queryKey: ["class", id] })}
      />
    </div>
  );
}

function NewConfigDialog({
  open, onOpenChange, classId, students, onCreated,
}: {
  open: boolean; onOpenChange: (o: boolean) => void;
  classId: string; students: { id: string; name: string }[];
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [size, setSize] = useState(4);
  const [policy, setPolicy] = useState<"flex" | "strict">("flex");
  const [absent, setAbsent] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  function toggleAbsent(id: string) {
    const next = new Set(absent);
    if (next.has(id)) next.delete(id); else next.add(id);
    setAbsent(next);
  }

  async function create() {
    if (!name.trim()) return toast.error("Give it a name");
    if (size < 2) return toast.error("Group size must be at least 2");
    setLoading(true);
    try {
      const { data: cfg, error } = await supabase
        .from("group_configs")
        .insert({ class_id: classId, name: name.trim(), group_size: size, size_policy: policy })
        .select("id")
        .single();
      if (error || !cfg) throw error ?? new Error("Failed");
      if (absent.size > 0) {
        await supabase.from("group_config_absent").insert(
          Array.from(absent).map((sid) => ({ config_id: cfg.id, student_id: sid })),
        );
      }
      toast.success("Configuration created");
      onCreated();
      onOpenChange(false);
      setName(""); setSize(4); setPolicy("flex"); setAbsent(new Set());
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
          <DialogTitle>New group configuration</DialogTitle>
          <DialogDescription>Set the parameters; you'll generate groups on the next screen.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="cn">Name</Label>
            <Input id="cn" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Project 1" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="gs">Students per group</Label>
              <Input id="gs" type="number" min={2} value={size} onChange={(e) => setSize(parseInt(e.target.value) || 0)} />
            </div>
            <div className="space-y-1.5">
              <Label>If it doesn't divide evenly</Label>
              <RadioGroup value={policy} onValueChange={(v) => setPolicy(v as "flex" | "strict")} className="mt-1.5 space-y-1.5">
                <div className="flex items-center gap-2"><RadioGroupItem value="flex" id="p-flex" /><Label htmlFor="p-flex" className="font-normal">Allow ±1 per group</Label></div>
                <div className="flex items-center gap-2"><RadioGroupItem value="strict" id="p-strict" /><Label htmlFor="p-strict" className="font-normal">Strict size, leftover smaller</Label></div>
              </RadioGroup>
            </div>
          </div>
          <div>
            <Label>Mark students as absent (excluded from this run)</Label>
            <div className="mt-2 max-h-56 space-y-1.5 overflow-auto rounded-md border border-border p-3">
              {students.map((s) => (
                <label key={s.id} className="flex cursor-pointer items-center gap-2">
                  <Checkbox checked={absent.has(s.id)} onCheckedChange={() => toggleAbsent(s.id)} />
                  <span className="text-sm">{s.name}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button disabled={loading} onClick={create}>{loading ? "Creating…" : "Create configuration"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}