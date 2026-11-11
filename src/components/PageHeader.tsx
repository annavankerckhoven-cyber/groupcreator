import { useTranslation, pageHead } from "@/lib/i18n";
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Users, Coffee, CircleUserRound, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { LanguageSelector } from "@/components/LanguageSelector";

export function PageHeader() {
  const { t, locale } = useTranslation();
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
  }, []);

  return (
    <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-6">
      <Link to="/" className="flex items-center gap-2">
        <div className="grid h-8 w-8 place-content-center rounded-lg bg-primary text-primary-foreground">
          <Users className="h-4 w-4" />
        </div>
        <span className="hidden sm:inline text-lg font-semibold tracking-tight">{t("Group Creator")}</span>
      </Link>

      <div className="ml-auto flex flex-nowrap items-center gap-2">
        <LanguageSelector />
        <Button asChild variant="outline" className="shrink-0 whitespace-nowrap">
          <a
            href="https://www.buymeacoffee.com/annavankerckhoven"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 whitespace-nowrap"
            aria-label={t("Buy me a coffee")}
          >
            <Coffee className="h-4 w-4" />
            <span className="hidden sm:inline">{t("Buy me a coffee")}</span>
          </a>
        </Button>
        <Button asChild variant="default" className="shrink-0 whitespace-nowrap">
          <Link to={signedIn ? "/dashboard" : "/auth"} className="inline-flex items-center gap-2 whitespace-nowrap">
            {signedIn ? <Home className="h-4 w-4" /> : <CircleUserRound className="h-4 w-4" />}
            <span className="hidden sm:inline">
              {t(signedIn ? "Go to dashboard" : "Log in / Sign up")}
            </span>
          </Link>
        </Button>
      </div>
    </header>
  );
}
