import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Reset password — Group Creator" }] }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    // The recovery link lands here with a token in the URL hash; Supabase
    // exchanges it for a session and fires PASSWORD_RECOVERY.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });
    // Fallback: a valid recovery session may already exist.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    const timeout = setTimeout(() => {
      setReady((r) => {
        if (!r) setInvalid(true);
        return r;
      });
    }, 5000);
    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  async function updatePassword(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) return toast.error("Passwords do not match.");
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Password updated. You are now signed in.");
    navigate({ to: "/dashboard" });
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <Link to="/auth" className="mb-6 text-sm text-muted-foreground hover:text-foreground">
        ← Back to sign in
      </Link>
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Choose a new password</CardTitle>
        </CardHeader>
        <CardContent>
          {invalid ? (
            <div className="space-y-3 pt-2">
              <p className="text-sm text-muted-foreground">
                This reset link is invalid or has expired. Request a new one from the sign-in page.
              </p>
              <Link to="/auth">
                <Button className="w-full">Back to sign in</Button>
              </Link>
            </div>
          ) : (
            <form onSubmit={updatePassword} className="space-y-3 pt-2">
              <div className="space-y-1.5">
                <Label htmlFor="pw-new">New password</Label>
                <Input
                  id="pw-new"
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pw-confirm">Confirm new password</Label>
                <Input
                  id="pw-confirm"
                  type="password"
                  required
                  minLength={6}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading || !ready}>
                {loading ? "Updating…" : "Update password"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
