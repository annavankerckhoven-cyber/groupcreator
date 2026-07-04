import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Sparkles, Users, ClipboardList, WandSparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/how")({
  head: () => ({ meta: [{ title: "How it works — Group Creator" }] }),
  component: HowItWorksPage,
});

function HowItWorksPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto flex min-h-screen max-w-5xl flex-col px-6 py-12">
        <Link to="/" className="mb-8 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to home
        </Link>

        <section className="space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-xs font-medium text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            How Group Creator works
          </div>

          <div className="space-y-3">
            <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
              Make group work feel fair, simple, and calm.
            </h1>
            <p className="max-w-3xl text-lg text-muted-foreground">
              Group Creator helps teachers build balanced classroom groups from student preferences.
              Students can share who they want to work with and who they would rather avoid, and the app turns that information into thoughtful group suggestions.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardContent className="pt-6">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Users className="h-5 w-5" />
                </div>
                <h2 className="mb-2 font-semibold">1. Create a class</h2>
                <p className="text-sm text-muted-foreground">
                  Add your students manually or import them via an Excel or CSV file to create a class.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <ClipboardList className="h-5 w-5" />
                </div>
                <h2 className="mb-2 font-semibold">2. Share a student form</h2>
                <p className="text-sm text-muted-foreground">
                  Students submit who they want to work with and who they prefer not to work with, anonymously to peers.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <WandSparkles className="h-5 w-5" />
                </div>
                <h2 className="mb-2 font-semibold">3. Generate balanced groups</h2>
                <p className="text-sm text-muted-foreground">
                  Set your preferred group size and let the app generate groupings that honor positive preferences and avoid conflicts.
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-wrap gap-3 pt-2">
            <Button asChild size="lg">
              <Link to="/auth">Get started for free</Link>
            </Button>
          </div>
        </section>
      </main>
    </div>
  );
}
