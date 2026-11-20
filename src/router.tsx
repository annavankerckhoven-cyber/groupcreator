import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { localeFromPathname, withoutLocale, withLocale, type Locale } from "./lib/i18n";

export const getRouter = () => {
  const queryClient = new QueryClient();
  let locale: Locale = "en";

  const router = createRouter({
    routeTree,
    context: {
      queryClient,
      get locale() {
        return locale;
      },
    },
    rewrite: {
      input: ({ url }) => {
        locale = localeFromPathname(url.pathname);
        url.pathname = withoutLocale(url.pathname);
        return url;
      },
      output: ({ url }) => {
        url.pathname = withLocale(url.pathname, locale);
        return url;
      },
    },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
