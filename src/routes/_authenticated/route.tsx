import { createFileRoute, Outlet, redirect, Link, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Users, LogOut, Coffee, CircleHelp } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthLayout,
});

function AuthLayout() {
  const navigate = useNavigate();
  async function signOut() {
    await supabase.auth.signOut();
    toast.success("Signed out");
    navigate({ to: "/" });
  }
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/dashboard" className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-content-center rounded-lg bg-primary text-primary-foreground">
              <Users className="h-4 w-4" />
            </div>
            <span className="hidden sm:inline text-lg font-semibold tracking-tight">Group Creator</span>
          </Link>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm" className="shrink-0 whitespace-nowrap">
              <Link to="/how" className="inline-flex items-center gap-2">
                <CircleHelp className="h-4 w-4" />
                <span className="hidden sm:inline">Help</span>
              </Link>
            </Button>
            <Button asChild variant="ghost" size="sm" className="shrink-0 whitespace-nowrap">
              <a
                href="https://www.buymeacoffee.com/annavankerckhoven"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2"
                aria-label="Buy me a coffee"
              >
                <Coffee className="h-4 w-4" />
                <span className="hidden sm:inline">Buy me a coffee</span>
              </a>
            </Button>
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="mr-1.5 h-4 w-4" /> Sign out
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
