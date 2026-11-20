import { Languages } from "lucide-react";
import { useRouterState } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { localeFromPathname, withLocale, type Locale } from "@/lib/i18n";

export function LanguageSelector() {
  const location = useRouterState({ select: (state) => state.location });
  const publicPath = location.publicHref.split(/[?#]/)[0];
  const locale = localeFromPathname(publicPath);

  function switchLanguage(next: Locale) {
    const path = withLocale(publicPath, next);
    window.location.assign(
      `${path}${location.searchStr}${location.hash ? `#${location.hash}` : ""}`,
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-9 shrink-0 gap-1.5 px-2.5 shadow-none"
          aria-label={locale === "nl" ? "Taal wijzigen" : "Change language"}
        >
          <Languages className="h-4 w-4" />
          <span className="uppercase">{locale}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem translate="no" onSelect={() => switchLanguage("en")}>
          English
        </DropdownMenuItem>
        <DropdownMenuItem translate="no" onSelect={() => switchLanguage("nl")}>
          Nederlands
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
