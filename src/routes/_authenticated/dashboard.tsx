import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Plus, Users, ChevronRight } from "lucide-react";
import { CreateClassDialog } from "@/components/CreateClassDialog";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Grouply" }] }),
  component: Dashboard,
});

function Dashboard() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data: classes, isLoading } = useQuery({
    queryKey: ["classes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("classes")
        .select("id, name, created_at, students(count)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div>
      <div className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Your classes</h1>
          <p className="mt-1 text-sm text-muted-foreground">Create a class, then share the link with students.</p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" /> New class
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : !classes || classes.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Users className="mb-3 h-10 w-10 text-muted-foreground" />
            <h3 className="text-lg font-semibold">No classes yet</h3>
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
          {classes.map((c) => {
            const count = Array.isArray(c.students) ? (c.students[0] as { count: number } | undefined)?.count ?? 0 : 0;
            return (
              <Link
                key={c.id}
                to="/classes/$id"
                params={{ id: c.id }}
                className="group"
              >
                <Card className="h-full transition-shadow hover:shadow-md">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between text-lg">
                      {c.name}
                      <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                    </CardTitle>
                    <CardDescription>
                      {count} student{count === 1 ? "" : "s"}
                    </CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      <CreateClassDialog open={open} onOpenChange={setOpen} onCreated={() => qc.invalidateQueries({ queryKey: ["classes"] })} />
    </div>
  );
}