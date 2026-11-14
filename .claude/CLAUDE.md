# Hanzi Quest — rules for AI contributors

These rules are **mandatory** for any AI agent (Claude Code, Copilot, Cursor, Codex…) working on this repository.
They are enforced by a local hook, a required CI check and GitHub rulesets (see "Enforcement").
If a rule blocks what you were asked to do, **stop and ask a human maintainer** — never look for a workaround.

## Project in one paragraph

Gamified Mandarin-learning PWA for Portuguese speakers. Plain HTML + ES modules, **no build step and no npm
dependencies** (Hanzi Writer and, for Friends mode, supabase-js are loaded from jsDelivr). Run locally with `node server.js` → http://localhost:5173.
Published by GitHub Pages from `main`: https://anonymousbonsai420.github.io/hanzi-quest/
See `README.md` for the file map and `METODOLOGIA.md` for the pedagogy behind the features.

## Git workflow (gitflow)

| Branch | Created from | Merges into | How |
|---|---|---|---|
| `main` | — | — | Production. Only receives PRs from `develop` (release) or `hotfix/*`. |
| `develop` | `main` | `main` (release) | Integration branch, repository default. |
| `feature/<name>` | `develop` | `develop` | New features. |
| `fix/<name>` | `develop` | `develop` | Bug fixes. |
| `hotfix/<name>` | `main` | `main` | Urgent production fixes only. |

- Branch names: lowercase kebab-case after the prefix, e.g. `feature/tone-pairs`, `fix/pinyin-sandhi`.
- **Every change reaches `main` or `develop` through a pull request.** Open PRs with `gh pr create --base develop`
  (or `--base main` only for a release or a hotfix).

### You must never

- commit, merge, cherry-pick, rebase or revert while checked out on `main` or `develop`;
- push to `main` or `develop`, force-push them, or delete them;
- open a PR into `main` from anything other than `develop` or `hotfix/*`;
- create rulesets, change branch protection, the default branch, or repository settings;
- edit or disable `.claude/settings.json`, `.claude/hooks/`, `.github/workflows/branch-rules.yml` or
  `.github/workflows/backport.yml` unless a human explicitly asks for that change;
- bypass checks (`--no-verify`, admin merge, disabling hooks).

### Starting work

```bash
git switch develop && git pull --ff-only
git switch -c feature/<name>          # or fix/<name>
# … commit on the branch …
git push -u origin feature/<name>
gh pr create --base develop --fill
```

Hotfix: `git switch main && git pull --ff-only && git switch -c hotfix/<name>`, then `gh pr create --base main`.

### Release and backport

1. A human decides to release. Open the PR `develop` → `main` titled `Release vX.Y.Z` (merge commit only — squash is disabled on `main`).
2. After it merges, optionally tag it on `main`: `git tag vX.Y.Z origin/main && git push origin vX.Y.Z`.
3. **Backport:** every push to `main` (release or hotfix) runs `.github/workflows/backport.yml`, which opens and
   merges a PR `main` → `develop`, so `develop` never loses what is in production and the next release never
   overwrites it. Check that it succeeded (`gh run list --workflow backport.yml`).
4. If the backport fails because of conflicts, resolve them on a fix branch created from `develop`:
   ```bash
   git switch develop && git pull --ff-only
   git switch -c fix/backport-<yyyymmdd>
   git merge origin/main            # resolve conflicts, keep production fixes
   git push -u origin fix/backport-<yyyymmdd>
   gh pr create --base develop --title "Backport main → develop"
   ```
   Merge it with **"Create a merge commit"** (not squash), so `develop` really contains `main`'s history.

## Enforcement

- **Local hook** (`.claude/hooks/git-guard.js`, wired in `.claude/settings.json`): Claude Code refuses git/gh
  commands that break the rules above before they run.
- **Required check `branch-rules`** (`.github/workflows/branch-rules.yml`): fails any PR whose source/target pair
  is not allowed.
- **GitHub rulesets** on `main` and `develop`: no direct pushes, no force-push, no deletion, PR + `branch-rules`
  required; `main` accepts merge commits only.

## Code conventions

- Vanilla JS ES modules in `js/`, one responsibility per file. No frameworks, bundlers or new dependencies
  without a human's approval.
- **Split by responsibility, never by comment banners.** A screen, a session mode, an exercise type or a feature
  gets its own file (and its own folder when it has several parts), in both JS and CSS, mirrored:
  `js/screens/<screen>.js` ↔ `css/screens/<screen>.css`, `js/session/<mode>.js` ↔ `css/session/<mode>.css`,
  `js/exercises/<type>.js` ↔ `css/exercises/<type>.css`, `js/friend-mode/*` ↔ `css/friend-mode.css`.
  If a file grows a second responsibility, split it.
- **Helpers are grouped by domain**, not in a catch-all `utils` file:
  - `js/lib/` = generic, app-agnostic helpers (`dom.js`, `time.js`, `random.js`, `events.js`);
  - `js/ui/` = reusable visual components (`modal`, `toast`, `confetti`, `heatmap`, `share`);
  - helpers that know about a feature stay inside that feature's folder (e.g. `js/friend-mode/actions.js`).
  Shared styles live in `css/base.css`, `css/layout.css` and `css/components.css`.
- New exercise type → `js/exercises/<type>.js` exporting `<type>Exercise`, register it in `js/exercises/index.js`,
  add its styles in `css/exercises/<type>.css`.
- Check modules with `node --input-type=module --check < file.js` (plain `node --check` does not treat these
  files as ES modules and misses errors such as duplicate declarations).
- UI text and code comments in **Brazilian Portuguese**; keep the existing tone.
- Course content lives in `js/data.js`: pinyin in numeric form (`ni3 hao3`), tone `5` = neutral, `v` = ü,
  dictionary (citation) tones — the checker already accepts sandhi variants.
- Colors only through the CSS variables defined in `css/base.css` (light and dark themes must both work).
- New JS/CSS file → add it to `SHELL` in `sw.js` and bump `CACHE` (`hanziquest-vN`). New CSS file → also add its
  `<link>` in `index.html`, keeping the order base → layout → components → screens → session → features.
- Never change the `localStorage` key or the shape of saved state without a migration in `js/state.js`.

## Friends mode (Supabase)

- The database lives in `supabase/schema.sql`. Keep it **idempotent** (safe to re-run in the SQL Editor):
  `create … if not exists`, `create or replace function`, `drop trigger if exists`.
- Access model: RLS on and **no table privileges** for `anon`/`authenticated`; the app only calls `security definer`
  functions with `set search_path = ''`, and each one starts with `public.assert_member()` (or `assert_admin()`).
  Never add table policies or grants that bypass this, and never weaken the invite/member-cap checks.
- New RPC → grant it explicitly at the end of the schema, mirror it in `js/friend-mode/mock.js`, and add cases to
  `supabase/test/schema.test.mjs` (run it before opening the PR).
- Only the public (anon/publishable) key may appear in `js/friend-mode/config.js`. Never commit a `service_role`/secret key.
- User-provided text (display names, avatars) must go through `h()` text nodes or `esc()` before any `innerHTML`.
- Test the UI with `http://localhost:5173/?mock` (simulated server, admin invite `HQ-TEST-ADMN`).

## Before opening a PR

- `node --input-type=module --check < file.js` on every changed JS file.
- `node server.js`, open the app, exercise what you changed, and check the browser console for errors.
- Check a phone-width viewport (375 px) and dark mode for UI changes.
- PR description: what changed, why, and how you tested it. Mention anything you could not test
  (microphone and Chinese TTS often cannot be tested in automated browsers).
