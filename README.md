# Wordbox

An English vocabulary notebook that uses AI to build dictionary entries and the Leitner system to schedule reviews.

Live: https://wordbox-omega.vercel.app

## Features

- **Add words**: enter an English word or phrase; AI generates the IPA, parts of speech, English and Traditional Chinese definitions, synonyms, antonyms, and example sentences. Misspellings get spelling suggestions.
- **Word list**: filter by familiarity (0–5 stars) and the important flag, with six sort orders. Open a word to edit, regenerate, or delete it, and hear it pronounced with the browser's speech synthesis.
- **Review**: rounds of up to 8 multiple-choice questions (word → Chinese, word → synonym, word → antonym, Chinese → word). The Leitner box schedules each word's next review; AI fills in distractors when your word list is too small.
- **Stats**: total words, familiarity distribution, and a 53-week heatmap of daily answers.
- **PWA**: install to the home screen and open in a standalone window; shows an offline page without a connection.
- **Dark mode**: defaults to the system setting and can be switched manually.
- Google sign-in only; each user can access only their own data (Row Level Security).

## Tech stack

| Area | Choice |
|---|---|
| Framework | Next.js 16 (App Router, Server Actions, Cache Components), React 19, TypeScript |
| UI | Tailwind CSS 4, shadcn/ui |
| Database & auth | Supabase (Postgres, RLS, Google OAuth) |
| AI | OpenAI structured outputs, validated with Zod |
| Testing | Vitest (unit, db), Playwright (E2E, performance, PWA) |
| Hosting | Vercel + Supabase Cloud |

## Documents

Development is spec-driven. The specs are in English; the app's interface is in Traditional Chinese:

- [`requirements.md`](requirements.md): requirements (EARS format) and acceptance criteria
- [`design.md`](design.md): architecture, database, AI, UI design, and the design decision log (D1–D25)
- [`tasks.md`](tasks.md): tasks derived from the requirements, with completion criteria

## Local development

### Prerequisites

- Node.js 24 or later (see `.nvmrc`)
- Docker (for the local Supabase stack)
- A Google OAuth client (for signing in locally; not needed for E2E tests)

### Setup

```bash
npm install

# Start local Supabase (applies supabase/migrations on first run)
npm run db:start
```

Create two env files (both git-ignored; see `.env.example` for the format):

- **`.env.local`** (Next.js): set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` from `npx supabase status`, and `OPENAI_API_KEY` and `OPENAI_MODEL` from your OpenAI account. Set `AI_MOCK=1` to use the fixtures in `lib/ai/fixtures` instead of calling OpenAI.
- **`.env`** (Supabase CLI): `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` and `SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET`. The Google OAuth client's redirect URIs must include `http://127.0.0.1:54321/auth/v1/callback`.

```bash
npm run dev   # http://localhost:3000
```

### Database

```bash
npx supabase migration new <name>      # create a migration
npx supabase migration up --local      # apply pending migrations, keeping data
npm run db:types                       # regenerate lib/db/types.ts
```

> `npm run db:reset` wipes the local database, including Google sign-in accounts and all words. Use it only when you need to rebuild.

## Testing

| Command | What it covers | Requires |
|---|---|---|
| `npm test` | Unit tests (`lib/domain`, AI layer) | — |
| `npm run test:db` | RLS, RPCs, and server action flows | Local Supabase |
| `npm run test:e2e` | User flows on desktop and mobile, with `AI_MOCK=1` and a test account | Local Supabase |
| `npm run test:perf` | Word list performance with 2,000 words (production build) | Local Supabase |
| `npm run test:pwa` | Manifest, service worker, offline page (production build) | Local Supabase |

Other checks: `npm run typecheck`, `npm run lint`, `npm run format:check`.

The full E2E suite occasionally times out on a busy machine; `npx playwright test --workers=2` reduces parallelism.

## Project structure

```
app/            routes: (app)/words, review, dashboard; login, offline, manifest
components/     words, review, dashboard, pwa, theme, ui (shadcn)
lib/
  domain/       pure functions: normalization, Leitner, word selection, questions, heatmap, dates
  ai/           OpenAI calls, prompts, Zod schemas, mock fixtures
  db/           Supabase clients and queries
  words/        word flows (add, edit, regenerate, delete)
  review/       review flows (questions, answers, distractor cache)
  actions/      Server Actions (thin wrappers)
supabase/       config and migrations
tests/          unit, db, e2e, perf, pwa
scripts/        icon generation (npm run icons)
```

## Deployment

- **Vercel**: connected to the GitHub repo; every push to `main` deploys. Environment variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `OPENAI_API_KEY`, `OPENAI_MODEL`, `AI_MOCK=0`.
- **Supabase Cloud**: push new migrations with `npx supabase db push` (after `npx supabase link`), then push the code.
- **Auth settings** (Supabase Dashboard → Authentication):
  - Enable the Google provider, and add `https://<project-ref>.supabase.co/auth/v1/callback` to the Google OAuth client's redirect URIs.
  - **Disable the Email provider** so that only Google sign-in is allowed. It stays enabled locally for the E2E tests.
  - URL Configuration: set the Site URL and Redirect URLs (`https://<domain>/auth/callback`) to the production domain.
