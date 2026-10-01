# English and Dutch website

## What will change

- Add a compact language selector to the public and signed-in page headers.
- Keep every existing English URL unchanged.
- Add a Dutch mirror under `/nl`, including account pages, dashboard, classes, projects, runs, distributions, presentation mode, password reset, and student forms.
- Make the selector keep visitors on the equivalent page when switching languages, including dynamic class, project, run, distribution, and student-link URLs.
- Translate all interface copy, form labels, dialogs, notifications, status text, help content, and page metadata into Dutch.
- Keep user-entered class names, student names, project names, run names, labels, and “Group Creator” untranslated.
- Generate copied student links in the teacher’s active language, so a link copied from Dutch opens the Dutch student form.

## Technical details

- Introduce a small shared localization layer that derives the language from the URL and provides typed English/Dutch strings and locale-aware links.
- Add `/nl` route counterparts that reuse the same page implementations and data behavior as English pages, rather than maintaining separate features.
- Make authenticated Dutch routes use the existing sign-in protection and preserve the selected language through sign-in, sign-out, password reset, and internal navigation.
- Give each Dutch content route its own Dutch title, description, Open Graph title/description, `og:type`, and Twitter card metadata.
- Verify direct navigation to `/nl`, a Dutch student link, language switching on nested pages, desktop/mobile header layout, and the production build.
