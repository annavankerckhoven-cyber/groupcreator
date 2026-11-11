<!-- LOVABLE:BEGIN -->

> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

<!-- LOVABLE:END -->

- Localization uses a per-router native URL rewrite for locale prefixes and render-time dictionary translation; keep internal typed route paths shared so navigation and redirects preserve the current locale without duplicated pages or DOM mutation.
- Locale is derived from publicHref and inherited through route context; page metadata and translated rendering must use the same locale for SSR and hydration.
