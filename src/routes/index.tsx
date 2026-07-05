import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkles, Mail } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Group Creator — Smarter group making" },
      {
        name: "description",
        content: "Free tool for teachers to create classroom groups based on student preferences.",
      },
      { property: "og:title", content: "Group Creator — Smarter group making" },
      {
        property: "og:description",
        content: "Free tool for teachers to create classroom groups based on student preferences.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PageHeader />

      <main className="mx-auto max-w-6xl px-6">
        <section className="py-20 text-center">
          <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-xs font-medium text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            100% free, forever
          </div>
          <h1 className="mx-auto max-w-3xl text-5xl font-semibold tracking-tight md:text-6xl">
            Making group work work.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            Let your students quietly say who they'd like to work with — and who they really
            shouldn't. Group Creator turns those answers into balanced groups.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg">
              <Link to={signedIn ? "/dashboard" : "/auth"}>Get started — completely free</Link>
            </Button>
            <Link
              to="/how"
              className="text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              How it works →
            </Link>
          </div>
        </section>

        <section id="how" className="grid gap-6 py-12 md:grid-cols-3">
          {[
            {
              title: "Create a class",
              body: "Enter student names or import a CSV/Excel file. Done in 30 seconds.",
            },
            {
              title: "Share a form",
              body: "Students pick who they'd like to work with — and who not, completely anonymous.",
            },
            {
              title: "Generate groups",
              body: "Set a group size and hit go. Hard avoids are respected, friendships honored.",
            },
          ].map((step, i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <div className="mb-3 text-sm font-medium text-primary">Step {i + 1}</div>
                <h3 className="mb-2 text-lg font-semibold">{step.title}</h3>
                <p className="text-sm text-muted-foreground">{step.body}</p>
              </CardContent>
            </Card>
          ))}
        </section>

        <footer className="border-t border-border py-8 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} Group Creator.
        </footer>
      </main>
    </div>
  );
}
