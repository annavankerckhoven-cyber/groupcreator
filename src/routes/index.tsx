import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Users, Sparkles, Heart, Mail, Coffee, Home, CircleUserRound } from "lucide-react";
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
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-6">
        <div className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-content-center rounded-lg bg-primary text-primary-foreground">
            <Users className="h-4 w-4" />
          </div>
          <span className="text-lg font-semibold tracking-tight">Group Creator</span>
        </div>

        <div className="ml-auto flex flex-nowrap items-center gap-2">
          <Button asChild variant={signedIn ? "default" : "outline"} className="shrink-0 whitespace-nowrap">
            <a
              href="https://www.buymeacoffee.com/annavankerckhoven"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 whitespace-nowrap"
              aria-label="Buy me a coffee"
            >
              <Coffee className="h-4 w-4" />
              <span className="hidden sm:inline">Buy me a coffee</span>
            </a>
          </Button>
          <Button asChild variant="default" className="shrink-0 whitespace-nowrap">
            <Link to={signedIn ? "/dashboard" : "/auth"} className="inline-flex items-center gap-2 whitespace-nowrap">
              {signedIn ? <Home className="h-4 w-4" /> : <CircleUserRound className="h-4 w-4" />}
              <span className="hidden sm:inline">
                {signedIn ? "Go to dashboard" : "Log in / Sign up"}
              </span>
            </Link>
          </Button>
        </div>
      </header>

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
            <a
              href="#how"
              className="text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              How it works →
            </a>
          </div>
        </section>

        <section id="how" className="grid gap-6 py-12 md:grid-cols-3">
          {[
            {
              title: "Create a class",
              body: "Paste your roster or import a CSV/Excel file. Done in 30 seconds.",
            },
            {
              title: "Share a form",
              body: "Students pick who they'd like to work with — and who not. Anonymous to peers.",
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

        <section className="grid gap-6 py-12 md:grid-cols-2">
          <Card>
            <CardContent className="pt-6">
              <Mail className="mb-3 h-5 w-5 text-primary" />
              <h3 className="mb-2 text-lg font-semibold">Contact & suggestions</h3>
              <p className="text-sm text-muted-foreground">
                Did you encounter an issue, or do you have ideas to improve this application?
                {"Reach out to\u00a0"}
                <span className="font-medium text-foreground">annavankerckhoven@gmail.com</span>.
              </p>
            </CardContent>
          </Card>
        </section>

        <footer className="border-t border-border py-8 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} Group Creator.
        </footer>
      </main>
    </div>
  );
}
