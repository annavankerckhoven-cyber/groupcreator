# Group Builder Platform

A free web app for teachers to create classes, collect student grouping preferences via a shareable link, and auto-generate balanced groups respecting "must avoid" constraints. Students can resubmit; teachers can regenerate, mark absentees, and slot late-arrivals back in.

## Tech stack
- React + TanStack Start (hosted on Cloudflare via Lovable's pipeline)
- Lovable Cloud (Postgres + Auth — email/password)
- Tailwind v4 + shadcn
- CSV/XLSX import via `papaparse` + `xlsx` (SheetJS)

## Pages

```text
/                                       Public landing — what it is, why use it,
                                        "100% free", contact/donation info, Login/Sign up CTA
/auth                                   Email + password sign-in / sign-up
/_authenticated/dashboard               All your classes (cards), "New class" button
/_authenticated/classes/$id             Roster, share link, submission progress,
                                        list of group configs, "New config"
/_authenticated/classes/$id/configs/$configId
                                        Generated groups view (per config)
/s/$token                               Public student form
```

## Data model

```text
profiles            (id = auth.users.id, display_name)
classes             (id, owner_id, name, created_at)
students            (id, class_id, name, sort_order)
share_links         (id UNIQUE token, class_id, created_at)
submissions         (id, class_id, student_id, submitted_at,
                     UNIQUE (class_id, student_id))   -- upsert on resubmit
preferences         (id, submission_id, target_student_id,
                     kind: 'with' | 'avoid')           -- 'neutral' = no row
group_configs       (id, class_id, name, group_size,
                     size_policy: 'flex' | 'strict',
                     generated_at)
group_config_absent (config_id, student_id)            -- excluded this run
generated_groups    (id, config_id, group_index, student_id)
```
RLS: owner-only for everything class-scoped. The public student form goes through a **server function** that takes the token, validates it, and reads/writes only what's needed — no broad anon SELECT policies on the data tables.

## Key UX flows

### New class
Two tabs in the create dialog:
1. **Paste / type** — textarea, one student per line.
2. **Import file** — drop a CSV or XLSX. Show a column picker if there are multiple columns; preview the parsed names before confirming.

### Share link & student form
- Teacher copies a single share URL per class.
- Student opens `/s/$token`, picks their name from the roster, fills three-way toggle (Together / Doesn't matter [default] / Not together) for each peer, submits.
- **Resubmission allowed**: opening the link again with the same name pre-fills their previous answers and lets them resubmit. Submitting upserts and updates `submitted_at`.
- Roster on the class page shows a green dot for submitted, with timestamp.

### Group configurations
A class can have **many** configs (e.g. "Project 1 — groups of 4", "Project 2 — pairs").
Creating a config asks:
- Name
- Group size N
- Size policy (radio): "Allow ±1 per group" / "Strict size, leftover smaller group"
- Absentees: checklist of students to **exclude** from this run

Hit Generate → groups are computed and **persisted** in `generated_groups`. From this point the config is **frozen** — later student form edits don't silently alter it.

### Regenerate / modify a saved config
On the config page:
- **"Generate new groups"** button — re-runs the algorithm with current submissions + current absentee list. Replaces the saved groups.
- **Absentee toggle list** — add/remove students from the absent set; doesn't take effect until regenerate is pressed (clear "unsaved changes" indicator).
- **"Add previously absent student: <name>"** — for each absentee NOT in any group, a one-click action. Inserts that student into the single best-fit existing group (lowest-conflict, smallest group), without reshuffling anyone else. The other groups remain identical.
- Submission deletion is never automatic when a student becomes absent — their preferences are preserved.

### Landing page (`/`)
- Hero: what the platform does in one sentence.
- "Why use it" section (3 short benefits).
- "100% free" callout.
- Contact / suggestions / donations block (placeholder details for now — easy to edit).
- Login / Sign up button.
- If already signed in, button reads "Go to dashboard".

## Grouping algorithm (hard avoid, soft prefer)

Pure deterministic function in `src/lib/grouping.ts` (testable, no DB):

1. Input: present students, group size N, size policy, list of "with" edges and "avoid" edges (both undirected; either side wanting it counts).
2. Build connected components from "with" edges. While merging, **never** unify two students who have an "avoid" edge — that "with" edge is dropped, those students stay in separate clusters.
3. Sort clusters largest-first.
4. Greedy bin-pack into groups of target capacity. For each cluster, score every open group:
   - reject if placing it creates an "avoid" pair in that group (hard constraint),
   - reject if it would exceed the size cap (per policy),
   - prefer the group with the most satisfied "with" edges to existing members and the most remaining capacity.
   Open a new group when nothing fits.
5. Final balancing pass to honor the chosen size policy.

`addStudentToBestGroup(existingGroups, student, edges, sizeCap)` — used by "Add previously absent student". Picks the lowest-conflict group with capacity; if all groups are at cap, opens a new singleton group rather than violating an avoid.

## Build order
1. DB migration (tables, RLS, grants, indexes, `profiles` auto-creation trigger).
2. Landing page + `/auth` (email/password).
3. `_authenticated` layout + dashboard with class CRUD.
4. Class creation with **manual** and **CSV/XLSX import** tabs.
5. Class detail page: roster, share link, submission progress, config list.
6. Public `/s/$token` form, including resubmission.
7. Grouping algorithm + unit smoke tests in `src/lib/grouping.test.ts`.
8. Config create / view / regenerate / add-absentee actions.

## Design direction
Calm and school-appropriate. Warm off-white background, single amber/terracotta accent for primary actions, generous spacing, Figtree (sans-serif). Not purple. Cards for classes, simple data tables for rosters.

## Out of scope (v1)
- Editing a single preference inline by the teacher (teacher can reset a submission instead).
- Email/SMS notifications to students.
- Drag-and-drop manual group edits (only "add absent student" is supported as a post-generation tweak).

Approve and I'll build it end-to-end, starting with the DB migration.
