import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Copy,
  Link as LinkIcon,
  Trash2,
  Plus,
  CheckCircle2,
  Circle,
  Pencil,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/classes/$id/")({
  head: () => ({ meta: [{ title: "Class — Group Creator" }] }),
  component: ClassDetail,
});

function ClassDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [projectOpen, setProjectOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [addStudentOpen, setAddStudentOpen] = useState(false);
  const [cloneProjectOpen, setCloneProjectOpen] = useState(false);
  const [projectToClone, setProjectToClone] = useState<{
    id: string;
    name: string;
    group_size: number;
    size_policy: string;
  } | null>(null);
  const [selectedClassesForClone, setSelectedClassesForClone] = useState<Set<string>>(new Set());
  const [editingClassName, setEditingClassName] = useState(false);
  const [newClassName, setNewClassName] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["class", id],
    queryFn: async () => {
      const [cls, students, link, subs, projects, allClasses] = await Promise.all([
        supabase.from("classes").select("id, name").eq("id", id).single(),
        supabase.from("students").select("id, name").eq("class_id", id).order("sort_order"),
        supabase.from("share_links").select("token").eq("class_id", id).limit(1).maybeSingle(),
        supabase.from("submissions").select("student_id, submitted_at").eq("class_id", id),
        supabase
          .from("group_configs")
          .select("id, name, group_size, size_policy")
          .eq("class_id", id)
          .order("created_at", { ascending: false }),
        supabase.from("classes").select("id, name").order("name"),
      ]);
      return {
        cls: cls.data,
        students: students.data ?? [],
        link: link.data,
        submissions: subs.data ?? [],
        projects: projects.data ?? [],
        allClasses: allClasses.data ?? [],
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

  async function deleteStudent(studentId: string, studentName: string) {
    if (!confirm(`Delete ${studentName}? Their submissions and any preferences referencing them will be removed, and they will disappear from previous group distributions.`)) return;
    const { error } = await supabase.from("students").delete().eq("id", studentId);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["class", id] });
    toast.success("Student deleted");
  }

  async function deleteProject() {
    if (!projectToDelete) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from("group_configs").delete().eq("id", projectToDelete);
      if (error) throw error;
      toast.success("Project deleted");
      await qc.invalidateQueries({ queryKey: ["class", id] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setDeleting(false);
      setConfirmOpen(false);
      setProjectToDelete(null);
    }
  }

  async function cloneProject() {
    if (!projectToClone || selectedClassesForClone.size === 0) return;
    try {
      const newProjects = Array.from(selectedClassesForClone).map((classId) => ({
        class_id: classId,
        name: projectToClone.name,
        group_size: projectToClone.group_size,
        size_policy: projectToClone.size_policy,
      }));

      const { error } = await supabase.from("group_configs").insert(newProjects);
      if (error) throw error;
      toast.success("Project cloned to selected classes");
      setCloneProjectOpen(false);
      setProjectToClone(null);
      setSelectedClassesForClone(new Set());
      await qc.invalidateQueries({ queryKey: ["class", id] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function saveClassName() {
    if (!newClassName.trim() || !data?.cls) return;
    try {
      const { error } = await supabase
        .from("classes")
        .update({ name: newClassName.trim() })
        .eq("id", id);
      if (error) throw error;
      toast.success("Class name updated");
      setEditingClassName(false);
      await qc.invalidateQueries({ queryKey: ["class", id] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  if (isLoading || !data?.cls) return <p className="text-sm text-muted-foreground">Loading…</p>;

  const shareUrl = data.link ? `${window.location.origin}/s/${data.link.token}` : "";
  const submittedSet = new Set(data.submissions.map((s) => s.student_id));
  const submittedAt = new Map(data.submissions.map((s) => [s.student_id, s.submitted_at]));

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between">
        <div>
          <Link to="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">
            ← All classes
          </Link>
          {editingClassName ? (
            <div className="mt-2">
              <Input
                value={newClassName}
                onChange={(e) => setNewClassName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setEditingClassName(false);
                }}
                onBlur={saveClassName}
                autoFocus
                className="text-2xl font-semibold"
              />
            </div>
          ) : (
            <div
              className="mt-2 flex items-center gap-2 cursor-pointer group"
              onClick={() => {
                setEditingClassName(true);
                setNewClassName(data?.cls?.name || "");
              }}
              title="Click to edit class name"
            >
              <h1 className="text-3xl font-semibold tracking-tight group-hover:text-muted-foreground">
                {data?.cls?.name}
              </h1>
              <Pencil className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          )}
          <p className="mt-1 text-sm text-muted-foreground">
            {submittedSet.size} of {data.students.length} students have submitted
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={deleteClass}
          className="text-destructive hover:text-destructive"
        >
          <Trash2 className="mr-1.5 h-4 w-4" /> Delete class
        </Button>
      </div>

      {shareUrl && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <LinkIcon className="h-4 w-4" /> Student link
            </CardTitle>
            <CardDescription>
              Share this with your students. They open it, pick their name, and fill the form.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input readOnly value={shareUrl} className="font-mono text-xs" />
              <Button
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(shareUrl);
                  toast.success("Link copied");
                }}
              >
                <Copy className="mr-1.5 h-4 w-4" /> Copy
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Students</CardTitle>
          <Button size="sm" onClick={() => setAddStudentOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" /> Add student
          </Button>
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
                  <div className="flex items-center gap-1">
                    {done && (
                      <Button variant="ghost" size="sm" onClick={() => resetSubmission(s.id)}>
                        Reset
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteStudent(s.id, s.name)}
                      className="text-destructive hover:text-destructive"
                      aria-label={`Delete ${s.name}`}
                      title={`Delete ${s.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Projects</CardTitle>
            <CardDescription>
              Each project is one way of dividing the class — set the group size, then make runs to
              compute groups.
            </CardDescription>
          </div>
          <Button size="sm" onClick={() => setProjectOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" /> New project
          </Button>
        </CardHeader>
        <CardContent>
          {data.projects.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No projects yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {data.projects.map((p) => (
                <li key={p.id}>
                  <div className="flex items-center justify-between rounded-md px-2 py-3 hover:bg-muted/40">
                    <Link
                      to="/classes/$id/configs/$configId"
                      params={{ id, configId: p.id }}
                      className="flex flex-1 items-center justify-between"
                    >
                      <div>
                        <div className="font-medium">{p.name}</div>
                        <div className="text-xs text-muted-foreground">
                          Groups of {p.group_size} ·{" "}
                          {p.size_policy === "plus" ? "some groups +1" : "some groups −1"}
                        </div>
                      </div>
                    </Link>
                    <button
                      type="button"
                      aria-label={`Clone ${p.name}`}
                      title={`Clone ${p.name} to other classes`}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setProjectToClone(p);
                        setSelectedClassesForClone(new Set());
                        setCloneProjectOpen(true);
                      }}
                      className="ml-3 rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-primary"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete ${p.name}`}
                      title={`Delete ${p.name}`}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setProjectToDelete(p.id);
                        setConfirmOpen(true);
                      }}
                      className="ml-3 rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={confirmOpen}
        onOpenChange={(open) => {
          if (!open) {
            setConfirmOpen(false);
            setProjectToDelete(null);
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Delete project</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this project? Its runs and distributions will be removed as well.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <div className="flex gap-2">
              <Button
                variant="outline"
                disabled={deleting}
                onClick={() => {
                  setConfirmOpen(false);
                  setProjectToDelete(null);
                }}
              >
                Cancel
              </Button>
              <Button variant="destructive" disabled={deleting} onClick={deleteProject}>
                {deleting ? "Deleting…" : "Delete"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={cloneProjectOpen}
        onOpenChange={(open) => {
          if (!open) {
            setCloneProjectOpen(false);
            setProjectToClone(null);
            setSelectedClassesForClone(new Set());
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Clone project</DialogTitle>
            <DialogDescription>
              Select the classes to which you want to clone "{projectToClone?.name}".
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-64 space-y-2 overflow-auto rounded-md border border-border p-3">
            {data?.allClasses
              .filter((c) => c.id !== id)
              .map((c) => (
                <label key={c.id} className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedClassesForClone.has(c.id)}
                    onChange={(e) => {
                      const next = new Set(selectedClassesForClone);
                      if (e.target.checked) {
                        next.add(c.id);
                      } else {
                        next.delete(c.id);
                      }
                      setSelectedClassesForClone(next);
                    }}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <span className="text-sm">{c.name}</span>
                </label>
              ))}
          </div>
          <DialogFooter>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setCloneProjectOpen(false);
                  setProjectToClone(null);
                  setSelectedClassesForClone(new Set());
                }}
              >
                Cancel
              </Button>
              <Button
                disabled={selectedClassesForClone.size === 0}
                onClick={cloneProject}
              >
                Clone
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <NewProjectDialog
        open={projectOpen}
        onOpenChange={setProjectOpen}
        classId={id}
        onCreated={() => qc.invalidateQueries({ queryKey: ["class", id] })}
      />

      <AddStudentDialog
        open={addStudentOpen}
        onOpenChange={setAddStudentOpen}
        classId={id}
        onCreated={() => qc.invalidateQueries({ queryKey: ["class", id] })}
      />
    </div>
  );
}

function NewProjectDialog({
  open,
  onOpenChange,
  classId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  classId: string;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [size, setSize] = useState(4);
  const [policy, setPolicy] = useState<"plus" | "minus">("plus");
  const [loading, setLoading] = useState(false);

  async function create() {
    if (!name.trim()) return toast.error("Give it a name");
    if (size < 2) return toast.error("Group size must be at least 2");
    setLoading(true);
    try {
      const { data: proj, error } = await supabase
        .from("group_configs")
        .insert({ class_id: classId, name: name.trim(), group_size: size, size_policy: policy })
        .select("id")
        .single();
      if (error || !proj) throw error ?? new Error("Failed");
      toast.success("Project created");
      onCreated();
      onOpenChange(false);
      setName("");
      setSize(4);
      setPolicy("plus");
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
          <DialogTitle>New project</DialogTitle>
          <DialogDescription>
            Set the group size; you'll create runs to compute groups on the project page.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="cn">Name</Label>
            <Input
              id="cn"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Project 1"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="gs">Students per group</Label>
            <Input
              id="gs"
              type="number"
              min={2}
              value={size}
              onChange={(e) => setSize(parseInt(e.target.value) || 0)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>If it doesn't divide evenly</Label>
            <RadioGroup
              value={policy}
              onValueChange={(v) => setPolicy(v as "plus" | "minus")}
              className="mt-1.5 space-y-1.5"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="plus" id="p-plus" />
                <Label htmlFor="p-plus" className="font-normal">
                  Some groups with 1 additional person
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="minus" id="p-minus" />
                <Label htmlFor="p-minus" className="font-normal">
                  Some groups with 1 fewer person
                </Label>
              </div>
            </RadioGroup>
          </div>
        </div>
        <DialogFooter>
          <Button disabled={loading} onClick={create}>
            {loading ? "Creating…" : "Create project"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddStudentDialog({
  open,
  onOpenChange,
  classId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  classId: string;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  async function addStudent() {
    if (!name.trim()) return toast.error("Enter a student name");
    setLoading(true);
    try {
      const { data: student, error } = await supabase
        .from("students")
        .insert({ class_id: classId, name: name.trim(), sort_order: 0 })
        .select("id")
        .single();
      if (error || !student) throw error ?? new Error("Failed to add student");
      toast.success("Student added");
      onCreated();
      onOpenChange(false);
      setName("");
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
          <DialogTitle>Add student</DialogTitle>
          <DialogDescription>
            Add a new student to the class. They will be included in future group distributions.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="student-name">Student name</Label>
            <Input
              id="student-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. John Smith"
              onKeyDown={(e) => {
                if (e.key === "Enter") addStudent();
              }}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            disabled={loading}
            onClick={() => {
              onOpenChange(false);
              setName("");
            }}
          >
            Cancel
          </Button>
          <Button disabled={loading} onClick={addStudent}>
            {loading ? "Adding…" : "Add student"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
