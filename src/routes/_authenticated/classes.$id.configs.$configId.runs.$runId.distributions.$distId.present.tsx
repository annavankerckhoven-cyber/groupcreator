import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

export const Route = createFileRoute(
  "/_authenticated/classes/$id/configs/$configId/runs/$runId/distributions/$distId/present",
)({
  head: () => ({ meta: [{ title: "Presentation — Group Creator" }] }),
  component: Present,
});

function Present() {
  const { id, configId, runId, distId } = Route.useParams();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ["present", distId],
    queryFn: async () => {
      const [dist, rows, students] = await Promise.all([
        supabase.from("run_distributions").select("id, rank, score").eq("id", distId).single(),
        supabase
          .from("run_distribution_groups")
          .select("group_index, student_id")
          .eq("distribution_id", distId),
        supabase.from("students").select("id, name").eq("class_id", id),
      ]);
      return { dist: dist.data, rows: rows.data ?? [], students: students.data ?? [] };
    },
  });

  if (isLoading || !data?.dist) return <p className="text-sm text-muted-foreground">Loading…</p>;

  const nameById = new Map(data.students.map((s) => [s.id, s.name]));
  const groups: string[][] = [];
  for (const r of data.rows) {
    if (!groups[r.group_index]) groups[r.group_index] = [];
    groups[r.group_index].push(r.student_id);
  }

  return (
    <div className="fixed inset-0 z-50 overflow-auto bg-background p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <div className="text-sm text-muted-foreground">
              Distribution #{data.dist.rank} · Score {data.dist.score}
            </div>
            <h1 className="text-3xl font-semibold">Groups</h1>
          </div>
          <Button
            variant="outline"
            onClick={() =>
              navigate({
                to: "/classes/$id/configs/$configId/runs/$runId",
                params: { id, configId, runId },
              })
            }
          >
            <X className="mr-1.5 h-4 w-4" /> Close
          </Button>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((g, gi) => (
            <div key={gi} className="rounded-xl border-2 border-border bg-card p-6 shadow-sm">
              <div className="mb-3 text-sm font-medium uppercase tracking-wider text-muted-foreground">
                Group {gi + 1}
              </div>
              <ul className="space-y-2">
                {g.map((sid) => (
                  <li key={sid} className="text-xl font-medium">
                    {nameById.get(sid) ?? sid}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
