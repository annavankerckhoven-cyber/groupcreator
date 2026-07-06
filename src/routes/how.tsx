import { createFileRoute, Link } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/PageHeader";

export const Route = createFileRoute("/how")({
  head: () => ({ meta: [{ title: "How it works — Group Creator" }] }),
  component: HowItWorksPage,
});

function HowItWorksPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <PageHeader />

      <main className="mx-auto flex min-h-screen max-w-5xl flex-col px-6 py-12">

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
                Start from the dashboard. Choose New class, and enter a class name.
              </p>
              <h3 className="text-lg font-semibold tracking-tight text-foreground/90">Add labels</h3>
              <p className="text-base leading-7 text-muted-foreground">
                You can give your class a label (for example: "biology_6th_grade"). You can add labels when creating a class or edit them later. Labels can be used to clone a project to all classes with a given label.
              </p>
              <h3 className="text-lg font-semibold tracking-tight text-foreground/90">Add students</h3>
              <p className="text-base leading-7 text-muted-foreground">
                You can add students to your class by typing their names manually or importing them from a CSV or Excel file. If you import a file, you can select the cells containing student names in a preview of the file. Students can still be edited manually after creating the class if needed.
              </p>
              <h3 className="text-lg font-semibold tracking-tight text-foreground/90">Archived classes</h3>
              <p className="text-base leading-7 text-muted-foreground">
                When creating a new class, this class will be active by default for 1 year. After 1 year, this class will be archived. Archived classes are still accessible, but can't be edited. You can clone projects from archived classes to active classes. Archived classes are deleted permanently after 1 year.
                You can always archive, restore or delete classes manually. If you restore an archived class, this class will remain active again for 1 year. Thereby you can easily maintain your classes.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-2xl font-semibold">2. Share the student form</h2>
              <p className="text-base leading-7 text-muted-foreground">
                After the class is created, open the class page and copy the student link. Send that link to students so they can submit who they would like to work with and who they would rather avoid. Their answers are kept anonymous to their peers. Even you (being the teacher) can't view their responses.
              </p>
              <p className="text-base leading-7 text-muted-foreground">
                The same link always remains enabled for the students. That way they can change their responses throughout the year. Previously generated distributions won't be updated, but when you run the grouping process again to generate distributions, the new preferences will be taken into account. The students list on your class page indicates which students have submitted the form.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-2xl font-semibold">3. Create a project</h2>
              <p className="text-base leading-7 text-muted-foreground">
                Inside a class, create a project. Set the target group size. If the number of students is not divisible by the group size, you can choose whether some groups should have one extra student or one less. You can copy a created project to multiple classes using the clone feature.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-2xl font-semibold">4. Run the grouping process</h2>
              <h3 className="text-lg font-semibold tracking-tight text-foreground/90">How to start a run</h3>
              <p className="text-base leading-7 text-muted-foreground">
                Open the project page and start a new run. Indicate which students are currently absent (if applicable), so they won't be added to any groups. The application will compute possible group distributions using the student preferences. Indicate the time the run should take. The longer the run, the more distributions are evaluated, increasing the changes of finding the optimal results. Once a run has comleted, you can review the results.
              </p>
              <h3 className="text-lg font-semibold tracking-tight text-foreground/90">Algorithm used to find optimal distributions</h3>
              <p className="text-base leading-7 text-muted-foreground">
                During the run, many distributions are generated using an algoritm specialized for large optimalization problems. To give an illustration: to divide a group of 20 people into groups of 4, there are 2.546.168.625 possible distributions. The algorithm will evaluate as much as possible distributions (optimized based on the students responses) within the time limit you set, and store the best ones.
                Therefore a longer run gives you a better chance of finding the optimal distribution, but even a short run will give you good results. 
                While running you can see the score of the best distribution found so far. The score is a measure of how well the student preferences are respected. The final results will also show the score of each of the best distribution found.
              </p>
              <h3 className="text-lg font-semibold tracking-tight text-foreground/90">Distribution scores</h3>
              <p className="text-base leading-7 text-muted-foreground">
                Each group gets a score based on the preferences of its members. 
                The score increases per liked peer in a student's group, 
                and decreases per disliked peer in the group. 
                The penalty for being with disliked classmates is higher than the reward 
                for being with liked classmates. Thereby avoiding disliked classmates comes first. 
                Groups also receive a penalty when a student has none of their liked peers in their group. 
                This encourages distributions where every student has at least one friend in their group, 
                rather than concentrating friendships among a few students.
                The total score of a distribution is the sum of the scores of all the groups.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-2xl font-semibold">5. Use the results</h2>
              <p className="text-base leading-7 text-muted-foreground">
                Once a run is complete, you can inspect the generated distributions. You can also mark favorite runs or distributions to keep the most useful outcomes easy to find.
                Use the view button to present a distribution.
              </p>
            </section>
          </div>

          <div className="flex flex-wrap gap-3 pt-2">
            <Button asChild size="lg">
              <Link to="/auth">Get started</Link>
            </Button>
            <Button variant="outline" size="lg" asChild>
              <a href="https://github.com/annavankerckhoven-cyber/groupcreator/issues" target="_blank" rel="noopener noreferrer">Report an issue</a>
            </Button>
            <Button variant="outline" size="lg" asChild>
              <a href="https://github.com/annavankerckhoven-cyber/groupcreator/discussions" target="_blank" rel="noopener noreferrer">Suggest a new feature</a>
            </Button>
          </div>
        </section>
      </main>
    </div>
  );
}
