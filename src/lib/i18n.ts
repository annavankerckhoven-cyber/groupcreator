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
