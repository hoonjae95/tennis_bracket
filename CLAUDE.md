# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project

L.P.T (Let's Play Tennis) 클럽의 대진표 자동 생성 웹 서비스. Next.js (App Router) + Supabase + Vercel.

## Commands

```bash
npm run dev      # dev server (Turbopack)
npm run build    # production build
npm run start    # run production build locally
npm run lint     # eslint
```

No test suite exists yet.

## Architecture

- **Auth**: no Supabase Auth — single fixed admin account (`ADMIN_USERNAME`/`ADMIN_PASSWORD` env vars) with a hand-rolled JWT session cookie (`src/lib/auth/session.ts`, signed via `jose`). `src/proxy.ts` (Next.js 16 middleware) gates `/admin/*` and `/api/admin/*`, redirecting unauthenticated requests to `/admin/login`.
- **Data access**: `src/lib/supabase/{client,server,admin}.ts`. Public reads use the anon key (`client.ts`/`server.ts`); all writes go through `admin.ts` (service-role client, bypasses RLS) and are only reachable from server actions that call `isAdminAuthenticated()` first. RLS policies in `supabase/migrations/0001_init.sql` allow public `select` on every table and no public writes at all — the app's own admin-session check is the only write gate.
- **Schema**: `rooms` (일정/방) → `courts`, `room_participants` (member + per-room grade override), `matches` → `match_players` (team 1/2). See `supabase/migrations/`.
- **Bracket generation**: pure function `generateBracket()` in `src/lib/bracket/generate.ts`, runs client-side for instant re-roll before saving. Balances team grade-score sums (A=3/B=2/C=1, max diff 2), enforces no 3-in-a-row play/rest, and evens out per-player game counts. It always fills every court/round slot — if a gender-restricted match type can't be built it auto-falls-back to `mixed_any_doubles`, and if total players can't fill every court it round-robins which court is "자유 랠리 연습" (free practice) each round rather than leaving a slot empty. Returns `freePracticeSlots` and `restingPlayersByRound` alongside `matches`, and `GeneratedMatch.note` reports the *actual* consecutive-play count (not a hardcoded "3경기") when a player is forced past the normal 3-in-a-row limit. `src/lib/bracket/actions.ts` persists only `matches`/`match_players` (deletes+reinserts on regenerate) — `note`/free-practice/resting info is derived at render time, not persisted, so the public room page recomputes resting/free-practice rounds from saved matches rather than reading them from the DB.
- **Room creation flow**: `src/components/rooms/room-wizard.tsx` is a multi-step client wizard (schedule → game rules → summary/confirm → participant picker) that calls `createRoom()` (`src/lib/rooms/actions.ts`) once at the end. Day-of-week templates (화/토/목) live in `src/lib/rooms/templates.ts`.

## Gotchas learned this session

- **Next.js 16 renamed middleware to proxy**: file must be `src/proxy.ts` (not `middleware.ts`), exported function must be named `proxy` (not `middleware`). Using the old convention silently still works but prints a deprecation warning — always use the new one here.
- **Next.js 16 `metadata.colorScheme` is deprecated**: put `colorScheme` in the `viewport` export (`export const viewport: Viewport = { colorScheme: "light" }`) instead of the `metadata` export — the old location silently still works but logs a warning on every request.
- **No test suite exists, so pure-function logic changes (e.g. to `generate.ts`) were verified by compiling a standalone copy with `tsc --module commonjs` (relative-import copy in a scratch dir, since `@/` path aliases need the project tsconfig) and running scripted scenarios via Node's `createRequire`. Faster than wiring up a real test runner for a one-off check.
- **Vercel new-project deploys need `vercel.json` with `{"framework": "nextjs"}`**: `vercel link` on a brand-new project sometimes leaves `framework: null` in project settings, which makes Vercel pick `@vercel/static-build` and silently drop all server functions/middleware — every route 404s in production even though the build "succeeds". If a fresh Vercel deploy 404s on every path, check `.vercel/output/config.json` — a nearly-empty `routes` array and no `functions/` directory means this happened. Fix is the `vercel.json` framework hint, not a code change.
- **`vercel build` fails locally on Windows** with `EPERM: operation not permitted, symlink` when Next.js output-traces duplicate route files. This doesn't affect the actual Vercel cloud build (Linux) — don't chase it locally, just `vercel deploy` and check the real deployment.
- **Supabase CLI browser login doesn't work in this non-TTY shell.** A personal access token is stored in `.env.local` as `SUPABASE_ACCESS_TOKEN` (gitignored) — export it before running any `supabase` CLI command (e.g. `export SUPABASE_ACCESS_TOKEN=$(grep SUPABASE_ACCESS_TOKEN .env.local | cut -d= -f2)`), then commands like `supabase migration list --linked` / `supabase db push` work without any login prompt. Don't ask the user to generate a new token — reuse this one. Only prompt for a fresh one if it stops working (401/expired).
- **Direct Postgres connection (`db.<ref>.supabase.co:5432`) is IPv6-only and unreachable from this environment** (no IPv4 A record, network has no IPv6 route). Don't waste time debugging `ENOTFOUND`/`ECONNREFUSED` here — use the Supabase CLI (which goes over HTTPS) or the dashboard SQL Editor instead of a raw `pg` connection.
- **To spot-check actual table data** (not just migration status), query the REST API directly with the anon key from `.env.local`: `curl "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/<table>?select=..." -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" -H "Authorization: Bearer $NEXT_PUBLIC_SUPABASE_ANON_KEY"`. Works around the Postgres IPv6 issue above; RLS allows public `select` on every table so this always works for reads.
