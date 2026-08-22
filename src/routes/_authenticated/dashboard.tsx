import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Plus,
  Users,
  Trash2,
  Archive,
  ArchiveRestore,
  Search,
  Tag,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { CreateClassDialog } from "@/components/CreateClassDialog";
import { toast } from "sonner";

type SortKey = "name" | "created" | "modified";
type SortDir = "asc" | "desc";
type SortOption = `${SortKey}-${SortDir}`;
const SORT_STORAGE_KEY = "gc.dashboard.sort";
const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "name-asc", label: "Alphabetically (A to Z)" },
  { value: "name-desc", label: "Alphabetically (Z to A)" },
  { value: "created-desc", label: "Created date (newest first)" },
  { value: "created-asc", label: "Created date (oldest first)" },
  { value: "modified-desc", label: "Modified date (newest first)" },
  { value: "modified-asc", label: "Modified date (oldest first)" },
];

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Group Creator" }] }),
  component: Dashboard,
});

function Dashboard() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [classToDelete, setClassToDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
  const [sortOption, setSortOption] = useState<SortOption>("created-desc");

  // Restore the user's saved sorting preference (persists across sessions).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SORT_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { key?: string; dir?: string };
      if (
        parsed.key &&
        ["name", "created", "modified"].includes(parsed.key) &&
        (parsed.dir === "asc" || parsed.dir === "desc")
      ) {
        setSortOption(`${parsed.key}-${parsed.dir}` as SortOption);
      }
    } catch {
      /* ignore malformed preference */
    }
  }, []);

  function changeSort(option: SortOption) {
    setSortOption(option);
    try {
      const [key, dir] = option.split("-") as [SortKey, SortDir];
      localStorage.setItem(SORT_STORAGE_KEY, JSON.stringify({ key, dir }));
    } catch {
      /* ignore storage failures */
    }
  }

  const sortKey = sortOption.split("-")[0] as SortKey;
  const sortDir = sortOption.split("-")[1] as SortDir;
  
  async function archiveOldActiveClasses(classesToCheck: typeof active) {
    const now = new Date();
    const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    
    const classesToArchive = classesToCheck.filter((c) => {
      const activatedAt = new Date(c.activated_at || c.created_at);
      return activatedAt < oneYearAgo;
    });
    
    if (classesToArchive.length === 0) return;
    
    try {
      const { error } = await supabase
        .from("classes")
        .update({ archived_at: now.toISOString() })
        .in("id", classesToArchive.map((c) => c.id));
      
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["classes"] });
    } catch (e) {
      console.error("Failed to archive old classes:", e);
    }
  }
  
  async function deleteLongArchivedClasses(classesToCheck: typeof archived) {
    const now = new Date();
    const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    
    const classesToDelete = classesToCheck.filter((c) => {
      const archivedAt = new Date(c.archived_at!);
      return archivedAt < oneYearAgo;
    });
    
    if (classesToDelete.length === 0) return;
    
    try {
      const { error } = await supabase
        .from("classes")
        .delete()
        .in("id", classesToDelete.map((c) => c.id));
      
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["classes"] });
    } catch (e) {
      console.error("Failed to delete archived classes:", e);
    }
  }
  const { data: classes, isLoading } = useQuery({
    queryKey: ["classes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("classes")
        .select(
          "id, name, created_at, updated_at, archived_at, activated_at, labels, students(count), group_configs(created_at, updated_at, runs(created_at, completed_at))",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  async function confirmDeleteClass() {
    if (!classToDelete) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from("classes").delete().eq("id", classToDelete);
      if (error) throw error;
      toast.success("Class deleted");
      await qc.invalidateQueries({ queryKey: ["classes"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setDeleting(false);
      setConfirmOpen(false);
      setClassToDelete(null);
    }
  }

  async function toggleArchive(classId: string, archive: boolean) {
    const { error } = await supabase
      .from("classes")
      .update(
        archive
          ? { archived_at: new Date().toISOString() }
          : { archived_at: null, activated_at: new Date().toISOString() },
      )
      .eq("id", classId);
    if (error) return toast.error(error.message);
    toast.success(archive ? "Class archived" : "Class restored");
    await qc.invalidateQueries({ queryKey: ["classes"] });
  }

  const allActive = (classes ?? []).filter((c) => !c.archived_at);
  const allArchived = (classes ?? []).filter((c) => c.archived_at);

  const allLabels = useMemo(() => {
    const set = new Set<string>();
    (classes ?? []).forEach((c) => (c.labels ?? []).forEach((l) => set.add(l)));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [classes]);

  function modifiedAt(c: (typeof allActive)[number]) {
    const stamps: string[] = [c.updated_at ?? c.created_at];
    (c.group_configs ?? []).forEach((cfg) => {
      stamps.push(cfg.updated_at, cfg.created_at);
      (cfg.runs ?? []).forEach((r) => {
        stamps.push(r.created_at);
        if (r.completed_at) stamps.push(r.completed_at);
      });
    });
    return stamps.reduce((max, s) => (s && s > max ? s : max), "");
  }

  function applyFilters(list: typeof allActive) {
    const q = search.trim().toLowerCase();
    const filtered = list.filter((c) => {
      const matchesSearch = !q || c.name.toLowerCase().includes(q);
      const matchesLabels =
        selectedLabels.length === 0 ||
        selectedLabels.some((l) => (c.labels ?? []).includes(l));
      return matchesSearch && matchesLabels;
    });
    const sorted = [...filtered].sort((a, b) => {
      if (sortKey === "name") return a.name.localeCompare(b.name);
      if (sortKey === "modified") return modifiedAt(a).localeCompare(modifiedAt(b));
      return a.created_at.localeCompare(b.created_at);
    });
    return sortDir === "desc" ? sorted.reverse() : sorted;
  }

  const active = applyFilters(allActive);
  const archived = applyFilters(allArchived);


  // Run archival and deletion checks when classes load
  useEffect(() => {
    if (classes && classes.length > 0) {
      archiveOldActiveClasses(active);
      deleteLongArchivedClasses(archived);
    }
  }, [classes]);

  const renderCard = (c: (typeof active)[number]) => {
    const count = Array.isArray(c.students)
      ? ((c.students[0] as { count: number } | undefined)?.count ?? 0)
      : 0;
    const isArchived = !!c.archived_at;
    return (
      <div key={c.id} className="group relative">
        <Link to="/classes/$id" params={{ id: c.id }} className="block">
          <Card className="h-full transition-shadow hover:shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-lg">
                {c.name}
              </CardTitle>
              <CardDescription>
                {count} student{count === 1 ? "" : "s"}
              </CardDescription>
              {c.labels && c.labels.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {c.labels.map((l) => (
                    <span
                      key={l}
                      className="rounded-md bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground"
                    >
                      {l}
                    </span>
                  ))}
                </div>
              )}
            </CardHeader>
          </Card>
        </Link>
        <button
          type="button"
          aria-label={`Delete ${c.name}`}
          title={`Delete class ${c.name}`}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setClassToDelete(c.id);
            setConfirmOpen(true);
          }}
          className="absolute right-3 top-3 rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted"
        >
          <Trash2 className="h-4 w-4" />
        </button>
        <button
          type="button"
          aria-label={isArchived ? `Restore ${c.name}` : `Archive ${c.name}`}
          title={isArchived ? "Move back to Active" : "Move to Archive"}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleArchive(c.id, !isArchived);
          }}
          className="absolute right-3 top-12 rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted"
        >
          {isArchived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
        </button>
      </div>
    );
  };

  return (
    <div>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Your classes</h1>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" /> New class
        </Button>
      </div>

      <div className="mb-8 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <Select value={sortOption} onValueChange={(v) => changeSort(v as SortOption)}>
          <SelectTrigger className="h-8 w-[180px] border-transparent bg-transparent text-xs text-muted-foreground hover:bg-muted">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="relative w-full sm:w-56">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search…"
            className="h-8 border-transparent bg-transparent pl-8 text-xs text-foreground placeholder:text-muted-foreground/70 focus-visible:bg-background"
          />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 gap-1.5 px-2 text-xs text-muted-foreground hover:bg-muted">
              <Tag className="h-3.5 w-3.5" />
              {selectedLabels.length > 0 ? `Labels (${selectedLabels.length})` : "Labels"}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="max-h-72 w-56 overflow-auto">
            {allLabels.length === 0 ? (
              <DropdownMenuItem disabled>No labels yet</DropdownMenuItem>
            ) : (
              <>
                {allLabels.map((label) => (
                  <DropdownMenuCheckboxItem
                    key={label}
                    checked={selectedLabels.includes(label)}
                    onCheckedChange={(checked) =>
                      setSelectedLabels((prev) =>
                        checked ? [...prev, label] : prev.filter((l) => l !== label),
                      )
                    }
                    onSelect={(e) => e.preventDefault()}
                  >
                    {label}
                  </DropdownMenuCheckboxItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => setSelectedLabels([])}>
                  Clear labels
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>


      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="space-y-10">
          <section>
            <div className="mb-4">
              <h2 className="text-xl font-semibold tracking-tight">Active classes</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Active classes are moved to Archive automatically after 1 year.
              </p>
            </div>
            {active.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                  <Users className="mb-3 h-10 w-10 text-muted-foreground" />
                  <h3 className="text-lg font-semibold">No active classes</h3>
                  <p className="mb-6 mt-1 max-w-sm text-sm text-muted-foreground">
                    Create your first class. Paste a list of names or import a CSV/Excel file.
                  </p>
                  <Button onClick={() => setOpen(true)}>
                    <Plus className="mr-1.5 h-4 w-4" /> Create a class
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {active.map(renderCard)}
              </div>
            )}
          </section>

          <section>
            <div className="mb-4">
              <h2 className="text-xl font-semibold tracking-tight">Archive</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Archived classes are deleted permanently after 1 year. Set your class to Active
                again to prevent deletion. It will remain active again for another year. Archived classes can't be edited, but you can still view and clone their projects.
              </p>
            </div>
            {archived.length === 0 ? (
              <p className="text-sm text-muted-foreground">No archived classes.</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {archived.map(renderCard)}
              </div>
            )}
          </section>
        </div>
      )}

      <Dialog
        open={confirmOpen}
        onOpenChange={(open) => {
          if (!open) {
            setConfirmOpen(false);
            setClassToDelete(null);
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Delete class</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this class? All of its projects, runs, distributions,
              and student form responses will be deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <div className="flex gap-2">
              <Button
                variant="outline"
                disabled={deleting}
                onClick={() => {
                  setConfirmOpen(false);
                  setClassToDelete(null);
                }}
              >
                Cancel
              </Button>
              <Button variant="destructive" disabled={deleting} onClick={confirmDeleteClass}>
                {deleting ? "Deleting…" : "Delete"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CreateClassDialog
        open={open}
        onOpenChange={setOpen}
        onCreated={() => qc.invalidateQueries({ queryKey: ["classes"] })}
      />
    </div>
  );
}
