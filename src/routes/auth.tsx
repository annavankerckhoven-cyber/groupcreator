import { useTranslation, pageHead } from "@/lib/i18n";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: ({ match }) =>
    pageHead(
      "Sign in — Group Creator",
      "Sign in or create your free Group Creator teacher account.",
      match.context.locale,
    ),
  component: AuthPage,
});

export function AuthPage() {
  const { t, locale } = useTranslation();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard" });
    });
  }, [navigate]);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      // Supabase returns "Invalid login credentials" for any auth failure.
      // Surface a clearer, conventional message to the user instead.
      if (
        error.message.toLowerCase().includes("invalid login") ||
        error.message.toLowerCase().includes("invalid credentials")
      ) {
        return toast.error(t("Email and password do not match."));
      }
      return toast.error(t(error.message));
    }
    navigate({ to: "/dashboard" });
  }

  async function sendResetLink(e: React.FormEvent) {
    e.preventDefault();
    setResetLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: `${window.location.origin}${locale === "nl" ? "/nl" : ""}/reset-password`,
    });
    setResetLoading(false);
    if (error) return toast.error(t(error.message));
    setResetOpen(false);
    toast.success(t("If an account exists for that email, a reset link is on its way."));
  }

  async function signUp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}${locale === "nl" ? "/nl" : ""}`,
        data: { display_name: name || email.split("@")[0] },
      },
    });
    setLoading(false);
    if (error) return toast.error(t(error.message));
    toast.success(t("Account created!"));
    navigate({ to: "/dashboard" });
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <Link to="/" className="mb-6 text-sm text-muted-foreground hover:text-foreground">
        {t("← Back home")}
      </Link>
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{t("Welcome to Group Creator")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="signin">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">{t("Sign in")}</TabsTrigger>
              <TabsTrigger value="signup">{t("Sign up")}</TabsTrigger>
            </TabsList>
            <TabsContent value="signin">
              <form onSubmit={signIn} className="space-y-3 pt-2">
                <div className="space-y-1.5">
                  <Label htmlFor="email-in">{t("Email")}</Label>
                  <Input
                    id="email-in"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pw-in">{t("Password")}</Label>
                  <Input
                    id="pw-in"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setResetEmail(email);
                      setResetOpen(true);
                    }}
                    className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                  >
                    {t("Forgot password?")}
                  </button>
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {t(loading ? "Signing in…" : "Sign in")}
                </Button>
              </form>
            </TabsContent>
            <TabsContent value="signup">
              <form onSubmit={signUp} className="space-y-3 pt-2">
                <div className="space-y-1.5">
                  <Label htmlFor="name-up">{t("Your name")}</Label>
                  <Input
                    id="name-up"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t("Ms. Rivera")}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email-up">{t("Email")}</Label>
                  <Input
                    id="email-up"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pw-up">{t("Password")}</Label>
                  <Input
                    id="pw-up"
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {t(loading ? "Creating…" : "Create account")}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("Reset your password")}</DialogTitle>
            <DialogDescription>
              {t(
                "Enter the email address of your account and we'll send you a link to reset your password.",
              )}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={sendResetLink} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="reset-email">{t("Email")}</Label>
              <Input
                id="reset-email"
                type="email"
                required
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setResetOpen(false)}>
                {t("Go back")}
              </Button>
              <Button type="submit" disabled={resetLoading}>
                {t(resetLoading ? "Sending…" : "Send reset link")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
