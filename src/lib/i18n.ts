import { useRouterState } from "@tanstack/react-router";
import { translateDutch } from "./translations";
export type Locale = "en" | "nl";

export function localeFromPathname(pathname: string): Locale {
  return pathname === "/nl" || pathname.startsWith("/nl/") ? "nl" : "en";
}

export function withoutLocale(pathname: string) {
  if (pathname === "/nl") return "/";
  return pathname.startsWith("/nl/") ? pathname.slice(3) || "/" : pathname;
}

export function withLocale(pathname: string, locale: Locale) {
  const plain = withoutLocale(pathname);
  return locale === "nl" ? (plain === "/" ? "/nl" : `/nl${plain}`) : plain;
}

export function isDutchPath(pathname: string) {
  return localeFromPathname(pathname) === "nl";
}

export function useTranslation() {
  const locale = useRouterState({ select: (state) => localeFromPathname(state.location.publicHref.split(/[?#]/)[0]) });
  const t = <T,>(value: T): T => (locale === "nl" && typeof value === "string" ? translateDutch(value) : value) as T;
  return { locale, t };
}

export function pageHead(title: string, description: string, locale: Locale = "en") {
  const t = (value: string) => locale === "nl" ? translateDutch(value) : value;
  return { meta: [
    { title: t(title) },
    { name: "description", content: t(description) },
    { property: "og:title", content: t(title) },
    { property: "og:description", content: t(description) },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] };
}
