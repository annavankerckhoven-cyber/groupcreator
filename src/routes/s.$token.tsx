import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Users, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { getPublicForm, submitPublicForm } from "@/lib/public-form.functions";

export const Route = createFileRoute("/s/$token")({
  head: () => ({ meta: [{ title: "Student form — Group Creator" }] }),
  component: StudentForm,
});

type Pref = "with" | "neutral" | "avoid";

function StudentForm() {
  const { token } = Route.useParams();
  const qc = useQueryClient();
  const getForm = useServerFn(getPublicForm);
  const submitForm = useServerFn(submitPublicForm);

  const [studentId, setStudentId] = useState<string>("");
  const [prefs, setPrefs] = useState<Map<string, Pref>>(new Map());
  const [showSuccess, setShowSuccess] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["public-form", token, studentId],
    queryFn: () => getForm({ data: { token, studentId: studentId || undefined } }),
  });

  // Hydrate prefs when student selection or data changes
  useEffect(() => {
    if (!data?.ok || !studentId) return;
    const m = new Map<string, Pref>();
    for (const s of data.students) {
      if (s.id === studentId) continue;
      m.set(s.id, "neutral");
    }
    for (const p of data.myPrefs) m.set(p.target_student_id, p.kind);
    setPrefs(m);
  }, [studentId, data]);

  const submittedIds = useMemo(
    () => new Set((data?.ok ? data.submissions : []).map((s) => s.student_id)),
    [data],
  );

  const submitMut = useMutation({
    mutationFn: async () => {
      const out: { targetId: string; kind: "with" | "avoid" }[] = [];
      prefs.forEach((kind, targetId) => {
        if (kind !== "neutral") out.push({ targetId, kind });
      });
      return submitForm({ data: { token, studentId, preferences: out } });
    },
    onSuccess: (res) => {
      if (!res.ok) return toast.error(res.error);
      toast.success("Your preferences have been saved.");
      setShowSuccess(true);
      qc.invalidateQueries({ queryKey: ["public-form", token] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  if (isLoading) return <CenterMessage>Loading…</CenterMessage>;
  if (!data || !data.ok) return <CenterMessage>This link is no longer valid.</CenterMessage>;

  if (showSuccess) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <Card className="max-w-md w-full">
          <CardContent className="flex flex-col items-center py-10 text-center">
            <CheckCircle2 className="mb-3 h-10 w-10 text-primary" />
            <h2 className="text-xl font-semibold">Thanks!</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Your preferences have been saved. You can close this tab.
            </p>
            <Button
              variant="ghost"
              className="mt-4"
              onClick={() => {
                setShowSuccess(false);
                setStudentId("");
              }}
            >
              Submit as a different student
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-10 px-4">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="h-4 w-4" /> {data.className}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Pick your name</CardTitle>
            <CardDescription>
              Your answers stay private — nobody can see them. Not even your teacher.
              <br />
              <strong>It is advised not to enter too many preferences.</strong> The fewer preferences you enter, the more likely they are to be respected.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Select value={studentId} onValueChange={setStudentId}>
              <SelectTrigger>
                <SelectValue placeholder="Select your name" />
              </SelectTrigger>
              <SelectContent>
                {data.students.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                    {submittedIds.has(s.id) ? " ✓" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {studentId && submittedIds.has(studentId) && (
              <p className="mt-2 text-xs text-muted-foreground">
                You've submitted before — your previous answers are loaded below. You can change
                them and resubmit.
              </p>
            )}
          </CardContent>
        </Card>

        {studentId && (
          <Card>
            <CardHeader>
              <CardTitle>For each classmate</CardTitle>
              <CardDescription>
                Choose whether you'd like to work with them. "Doesn't matter" is the default.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="divide-y divide-border">
                {data.students
                  .filter((s) => s.id !== studentId)
                  .map((s) => {
                    const v = prefs.get(s.id) ?? "neutral";
                    return (
                      <li key={s.id} className="flex items-center justify-between gap-3 py-3">
                        <span className="font-medium">{s.name}</span>
                        <div className="inline-flex overflow-hidden rounded-md border border-border text-xs">
                          {(["with", "neutral", "avoid"] as Pref[]).map((opt) => {
                            const label =
                              opt === "with"
                                ? "Together"
                                : opt === "neutral"
                                  ? "Doesn't matter"
                                  : "Not together";
                            const active = v === opt;
                            const color =
                              opt === "with"
                                ? "bg-primary text-primary-foreground"
                                : opt === "avoid"
                                  ? "bg-destructive text-destructive-foreground"
                                  : "bg-secondary text-secondary-foreground";
                            return (
                              <button
                                key={opt}
                                type="button"
                                className={`px-3 py-1.5 transition-colors ${active ? color : "bg-card text-muted-foreground hover:bg-muted"}`}
                                onClick={() => {
                                  const next = new Map(prefs);
                                  next.set(s.id, opt);
                                  setPrefs(next);
                                }}
                              >
                                {label}
                              </button>
                            );
                          })}
                        </div>
                      </li>
                    );
                  })}
              </ul>
              <div className="mt-6">
                <Button
                  className="w-full"
                  disabled={submitMut.isPending}
                  onClick={() => submitMut.mutate()}
                >
                  {submitMut.isPending ? "Saving…" : "Submit"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function CenterMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-sm text-muted-foreground px-4 text-center">
      {children}
    </div>
  );
}
