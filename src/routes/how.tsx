import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

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

        <section className="space-y-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-xs font-medium text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            User guide
          </div>

          <div className="space-y-3">
            <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
              Group Creator — instructions manual
            </h1>
            <p className="max-w-3xl text-lg text-muted-foreground">
              This page explains how to create a class, collect student preferences, and turn them into balanced groups.
            </p>
          </div>

          <div className="space-y-6">
            <section className="space-y-2">
              <h2 className="text-2xl font-semibold">1. Create a class</h2>
              <p className="text-base leading-7 text-muted-foreground">
                Start from the dashboard. Choose New class, give the class a name, and add your students. You can type names manually or import them from a CSV or Excel file. If you import a file, review the preview and select the cells that contain the student names.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-2xl font-semibold">2. Share the student form</h2>
              <p className="text-base leading-7 text-muted-foreground">
                After the class is created, open the class page and copy the student link. Send that link to students so they can submit who they would like to work with and who they would rather avoid. Their answers are kept anonymous to their peers.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-2xl font-semibold">3. Create a project</h2>
              <p className="text-base leading-7 text-muted-foreground">
                Inside a class, create a project for the way you want to divide the class. Set the target group size and choose the size policy that fits your classroom situation.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-2xl font-semibold">4. Run the grouping process</h2>
              <p className="text-base leading-7 text-muted-foreground">
                Open the project page and start a new run. The application will compute possible group distributions using the student preferences. You can review the results and keep the runs that work best for you.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-2xl font-semibold">5. Use the results</h2>
              <p className="text-base leading-7 text-muted-foreground">
                Once a run is complete, you can inspect the generated groups and use them as a basis for classroom organization. You can also mark favorite runs or distributions to keep the most useful outcomes easy to find.
              </p>
            </section>
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
