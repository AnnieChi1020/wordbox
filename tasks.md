# Wordbox — Tasks

> Version: v1.3 (2026-10-23) · matches `requirements.md` v0.8 and `design.md` v1.3
> v1.3 changes: added Phase 7.
> v1.2 changes: added Phase 6.
> v1.1 changes: translated into English; content unchanged.
> Each task lists the requirements it covers; it is done when those requirements' AC pass.
> Implement in order; start the next task only after the current one is done (tests included).

---

## Phase 1 — Accounts and word management

- [x] **T1.1 Project skeleton**
  - Next.js App Router + strict TypeScript, Tailwind, shadcn/ui, ESLint, Prettier
  - Vitest and Playwright setup; `.env.example` (design §2)
  - Done when: `npm run dev`, `npm test`, and `npm run test:e2e` all run

- [x] **T1.2 Supabase and database (Phase 1 part)** — R1.4
  - Local Supabase CLI environment
  - Migration: `profiles`, `part_of_speech`, `words`, `senses`, `ai_generation_logs`, indexes, RLS (design §4.1, §4.2)
  - Profile creation trigger (design §4.4; timezone defaults to null)
  - RPCs: `create_word`, `update_word_content`, `replace_word_content` (design §4.3)
  - Done when: RLS tests prove user A cannot read user B's words or senses; an `update_word_content` test proves unchanged senses keep their ids

- [x] **T1.3 Google sign-in** — R1.1–R1.3, R1.5, R1.6
  - Supabase Google provider, `/login`, `/auth/callback`, `proxy.ts` (`middleware.ts` on Next.js 15 and earlier)
  - `initProfileTimezone()` writes only when `timezone is null` and checks for a valid IANA time zone
  - Sign-out button
  - Done when: all R1 AC pass

- [x] **T1.4 App layout and navigation** — NFR1, NFR2
  - Bottom tab bar on phones, top navigation on desktop (Words / Review / Stats); review and stats start as empty pages

- [x] **T1.5 Domain basics** — R2.2, R2.3, R2.11, R3.1
  - `normalize.ts`, `pos.ts`, `stars.ts`, `dates.ts`, with unit tests

- [x] **T1.6 AI word generation** — R2.5–R2.7, R2.10, R2.12, NFR3, NFR6
  - `schemas.ts`, `prompts.ts`, `generateWord.ts` (20-second timeout, logging)
  - `AI_MOCK` fixtures: `apple`, `run`, `give up`, `aple`, timeout, invalid format
  - Done when: every branch is tested with fixtures

- [x] **T1.7 `addWord` action** — R2.2–R2.8
  - Normalize → duplicate check → AI → `create_word` RPC; a concurrent conflict returns `exists`
  - Done when: unit or integration tests cover all 4 result statuses

- [x] **T1.8 Add word UI** — R2.1, R2.4, R2.6, R2.9, R2.10
  - Input, format error message, loading state, clickable spelling suggestions, retry
  - Both `exists` and `created` open the popup with `?word=<id>`

- [x] **T1.9 Word list** — R3.1–R3.4, R3.7, R3.8, NFR4
  - Database queries driven by URL search params
  - Row component: word, part-of-speech tags, stars (with aria-label), important
  - Filters (multi-select stars, important only), sort (6 orders), empty state
  - 100 rows per page, loaded while scrolling (design D11)
  - Done when: all R3 AC pass; NFR4 is met with 2,000 fake words (`npm run test:perf`)

- [x] **T1.10 Important toggle** — R3.5
  - `setImportant` action + optimistic update; shared by the list and the popup

- [x] **T1.11 Word popup (view)** — R4.1, R4.2, R4.8, R4.9, NFR5
  - Shows every field; Web Speech pronunciation (hidden when unsupported)
  - Closes with the button, Esc, the backdrop, or the back button; full screen on phones; focus trap

- [x] **T1.11a Store words in their dictionary headword spelling** (added requirement) — R2.7, design D12
  - `headword` in `GenerateWordSchema`, prompt rule 9, `canonicalText()` + unit tests
  - Fixtures cover words that need capitals (`monday`) and the AI changing the word (`ran` → `run`)
  - Existing local data converted to headword spelling
  - Done when: the new R2.7 AC pass

- [x] **T1.12 Edit mode** — R4.3, R4.4
  - Form (Zod validation), adding or removing senses (1–3), `updateWord` → `update_word_content` (existing senses carry their ids)

- [x] **T1.13 Regenerate and delete** — R4.5–R4.7
  - Confirmation dialogs; a failed regeneration keeps the original content
  - Regeneration does not change the word itself (the AI's headword is ignored)
  - The R4.7 AC "the dashboard's answer history is unchanged" needs review_logs and the dashboard, so it is verified in T3.3; Phase 1 only verifies immediate removal from the list

- [x] **T1.14 Phase 1 E2E tests**
  - Sign in → add (valid / misspelled / duplicate) → filter and sort the list → edit in the popup → regenerate → delete

- [x] **T1.15 Deployment**
  - Vercel + Supabase Cloud, Google OAuth production domain setup, environment variables
  - Email provider disabled in production (kept enabled locally for E2E tests), per R1.2
  - Done when: the production URL allows signing in and adding a word

---

## Phase 2 — Review

- [x] **T2.1 Database: review logs and distractor cache** — R6.5, R7.3, R8.6
  - Migration: `review_logs`, `ai_distractors`, indexes, RLS (design §4.1, §4.2)
  - After update trigger on `senses`: deletes the sense's ai_distractors when content columns change, keeps them when only position changes (design §4.1)
  - `apply_review` RPC: locks the word, `question_id` idempotency, box / next_due_on optimistic lock (design §4.3, D13)
  - Types updated with `npm run db:types`
  - Done when (`tests/db`):
    - RLS: user A cannot read user B's review_logs or ai_distractors
    - Sending the same `question_id` twice creates one log and updates words once; the second call returns `duplicate = true`
    - A `p_box_before` that does not match → `40001`, nothing written
    - Edit that only reorders → cache kept; changing def_zh → that sense's cache deleted; regenerating → all deleted
    - After deleting a word, review_logs remain with `word_id` set to null (R4.7)

- [x] **T2.2 `leitner.ts`** — R7.4
  - `intervalDays`, `applyAnswer` (design §7.3)
  - Done when: one test per R7.4 AC (5); also box 0 answered correctly and all 10 cells of the normal and important interval tables

- [x] **T2.3 `random.ts` + `selection.ts`** — R5.1
  - `random.ts`: seedable rng, `shuffle`, `pick`, shared by all randomness in Phase 2
  - `orderSessionCandidates` returns the full sequence (design §7.4)
  - Done when: due words come first, by next_due_on oldest to newest; same-date order comes from the rng and is reproducible with a fixed seed; words not due are ordered by box low → high, then next_due_on near → far; no duplicates

- [x] **T2.4 `questions.ts`** — R6.1–R6.4
  - `availableTypes`, `buildQuestion`, `filterDistractors` (design §7.5)
  - Done when:
    - A sense without synonyms never gets `word_to_synonym` (R7 AC)
    - One test per exclusion rule in the design §7.5 table; comparisons trim and ignore case
    - Same part-of-speech candidates come first
    - With too few candidates it returns `needsAi`, with the missing count and the partial candidates found
    - The order of the 4 options comes from the rng

- [x] **T2.5 AI distractors** — R6.5, R6.6, R2.12
  - `DistractorsSchema`, prompt, `generateDistractors.ts` (20-second timeout, log kind = `distractors`) (design §5.3, §5.4)
  - `lib/review/distractors.ts`: cache → AI → R6.4 filter → write cache (design §5.3)
  - The mock dispatches on the request name; `mock distractor fail` triggers a failure
  - Done when:
    - unit: success, timeout, invalid format, fewer than 3 after filtering (all count as failures)
    - db: a cache hit does not call the AI; a cache that falls short after filtering triggers a new call and is overwritten; failures are not cached

- [x] **T2.6 `startReviewSession`** — R5, R6
  - `lib/review/startSession.ts` + action (design §6 flow)
  - Questions that need the AI run in parallel (D14); R6.6 switches types, or skips the word and takes the next one
  - Questions do not contain the correct answer (D15)
  - Done when (db tests, mock AI):
    - No words → empty array
    - 2 words → 2 questions, with distractors filled in by the AI (R7 AC)
    - The `mock distractor fail` word is skipped and replaced by the next word
    - Every question has 4 distinct options, and all `questionId`s differ
    - 2,000 words without AI finishes within 1 second

- [x] **T2.7 `submitAnswer` and `countDueWords`** — R7.3, R7.4, R8.6
  - `lib/review/submitAnswer.ts` + action (design §6 flow)
  - Done when (db tests):
    - The 5 R7.4 AC verified through the action
    - A repeated submission counts once and returns the same result (R7.3)
    - `local_date` is computed in the profile time zone
    - Options without the correct answer, `selected` not among the options, or another user's word → `ok: false`, nothing written
    - Sense regenerated while answering → `ok: false`, nothing written

- [x] **T2.8 Review UI** — R7.1, R7.2, NFR1, NFR5
  - `ReviewIntro`: number of words due today and a start button; loading state while building questions, toast with retry on failure
  - `QuestionCard`: progress (3 / 8), prompt with part of speech, 4 options; locks after answering, green / red marking, 「下一題」 (Next question)
  - Options are locked while waiting for the check; if submitAnswer fails, a toast appears and the same `questionId` can be resent
  - Keyboard: Tab plus Enter, or number keys 1–4, to answer; the result is announced with `aria-live` and not conveyed by color alone

- [x] **T2.9 Summary screen** — R7.5
  - Number of correct answers, each word's result and star change (boxBefore → boxAfter)
  - 「再來一輪」 (Another round), 「回單字列表」 (Back to word list); 「今天到期的字都複習完了」 (All of today's due words are reviewed) when `countDueWords() = 0`

- [x] **T2.10 Empty state and Phase 2 E2E** — R5.2, R7 AC
  - Empty state with 「去新增單字」 (Go add words) when there are no words
  - E2E (`AI_MOCK=1`):
    - A session can be completed with only 2 words
    - After correct and wrong answers, the stars in the list change correctly
    - After answering 3 questions and leaving the page, the database has 3 review_logs (R7 AC)
    - The summary shows the right counts and star changes; 「再來一輪」 starts a new session

- [x] **T2.11 Phase 2 deployment**
  - Push the T2.1 migration with `supabase db push`, redeploy Vercel
  - Done when: a review session can be completed on the production URL

- [x] **T2.12 Reset to zero on a wrong answer** (added requirement) — R7.4, design D16
  - `applyAnswer` sets box to 0 on a wrong answer (was 1)
  - Expected results for wrong answers updated in unit, db, and E2E tests
  - Done when: the revised R7.4 AC pass; a new word answered wrong stays at 0 stars

---

## Phase 3 — Dashboard and PWA

- [x] **T3.1 `heatmap.ts`** — R8.3, R8.4
  - `heatLevel`, `heatmapStart`, `buildHeatmapGrid` (design §7.6)
  - Done when:
    - `heatLevel` boundaries: 0, 1, 8, 9, 16, 17, 32, 33 (R8 AC: 10 answers is the third level, i.e. level 2)
    - 53 columns × 7 rows, Sunday in the first row, the last column contains today, cells after today are null
    - Cell dates are correct when today is a Sunday or a Saturday, and across a year boundary and a leap day
    - Dates with answers map to the right cells and levels

- [x] **T3.2 Dashboard stats RPC** — R8.1, R8.2, R8.6
  - Migration: `get_dashboard_stats(p_since)` (design §4.3, D17)
  - `lib/db/stats.ts`; `npm run db:types`
  - Done when (`tests/db`):
    - The total and the 0–5 star distribution are correct
    - `daily` is aggregated by `local_date` and includes only dates from `p_since`
    - RLS: other users' data is not counted
    - After deleting a word, the total drops by 1 and `daily` is unchanged (R8 AC, R4.7 AC)

- [x] **T3.3 Dashboard screen** — R8.1–R8.5, NFR1, NFR5
  - `/dashboard`: `StatTotal`, `StarDistributionChart`, `Heatmap` (design §8.1)
  - Brand color CSS variables (design §8.3)
  - Heatmap: tooltip (hover / tap), roving tabindex and arrow keys, sr-only summary, horizontal scrolling on phones showing the most recent weeks by default, dark mode color scale
  - Empty state when there are no words
  - Done when (E2E):
    - The total and star distribution match the data
    - 10 answers today → today's cell is level 2, and the tooltip shows the date and count (R8 AC)
    - After deleting a word, the total drops by 1 and the heatmap is unchanged (R8 AC, R4.7 AC)
    - The keyboard can move between cells and read each cell's date and count
    - No horizontal page scrolling at 360px width (only the heatmap itself scrolls)

- [x] **T3.4 Manifest and icons** — R9.1
  - `app/manifest.ts`, `public/icons/*` (192, 512, maskable 512), `app/icon.svg`, `app/apple-icon.png`
  - Icons per design §8.3: dark blue background, cream "W"; PNGs in each size generated from the SVG with sharp
  - `appleWebApp` metadata, `viewport.themeColor`
  - `npm run test:pwa`: a Playwright config that runs against a production build (like `test:perf`)
  - Done when (`test:pwa`): `/manifest.webmanifest` has the R9.1 fields; every icon can be fetched and its actual size matches the declared one

- [x] **T3.5 Service worker and offline page** — R9.2
  - `public/sw.js`, `components/pwa/sw-register.tsx`, `app/offline/page.tsx` (design §8.2, D19, D20)
  - `proxy.ts` allows the offline page and PWA files; `next.config.ts` sets the `/sw.js` headers
  - Done when (`test:pwa`):
    - The service worker registers
    - Reloading `/words` while offline shows the 「需要網路連線」 (Internet connection required) page (R9 AC)
    - Reloading after reconnecting returns to the normal page
    - Only static assets are cached: Cache Storage has no page HTML (except the offline page) and no API responses

- [x] **T3.6 Phase 3 deployment and device testing** — R9 AC
  - Push the T3.2 migration with `supabase db push`, redeploy Vercel
  - On real devices (done by the user): add to the home screen in Chrome (Android) and Safari (iOS) and open in a standalone window; reload in airplane mode to see the offline page
  - Done when: the dashboard displays correctly on the production URL; the R9 AC pass on real devices
  - Result (2026-10-22): passed on iOS Safari (add to home screen, standalone window, offline page). Not tested on a real Android device; the install criteria (manifest, icons, service worker) are verified in Chromium by `test:pwa`

- [x] **T3.7 Site-wide brand colors** (added requirement) — design §8.3, D22
  - `--primary` becomes brand-900 and `--ring` brand-600; the navigation bar's selected state uses the primary color
  - The background stays white (a cream background was tried and not adopted)
  - Darker star and correct-answer colors for clearer contrast
  - Done when: screenshots of each page checked (words, popup, review, stats, login, offline); existing E2E and `test:pwa` all pass

---

## Phase 4 — Dark mode

- [x] **T4.1 Appearance switching** — R10.1–R10.4
  - Anti-flash inline script in the root layout, `suppressHydrationWarning` (design §8.4, D23)
  - `ThemeToggle`: dark mode switch (on = dark), next to the sign-out button in the top navigation bar
  - Done when (E2E):
    - Never switched: system dark → dark; system light → light
    - After switching, the choice survives a reload and the system setting is no longer followed; `<html>` has the right class as the HTML loads (no flash)
    - The login and offline pages apply the stored setting
    - The switch can be operated with the keyboard

- [x] **T4.2 Dark palette** — R10.5
  - `.dark` variables: primary, ring, chart-bar (design §8.4, D24)
  - Dark variants of the star, correct, and wrong colors
  - Done when: dark screenshots of each page checked (words, popup, edit, review, summary, stats, login, offline); new colors' contrast verified with the dataviz tools; existing E2E and `test:pwa` all pass

- [x] **T4.3 Deployment**
  - Redeploy Vercel (no migration)
  - Done when: the production URL displays correctly on iOS with both the light and dark system settings
  - Result (2026-10-22): passed on iOS Safari

---

## Phase 5 — Antonym questions

- [x] **T5.1 Database: question type constraint** — R6.1
  - Migration: add `word_to_antonym` to the `question_type` check on `review_logs` and `ai_distractors` (design §4.1)
  - Applied locally with `supabase migration up`, without a reset
  - Done when (`tests/db`): `apply_review` and `ai_distractors` accept `word_to_antonym`; other strings are still rejected

- [x] **T5.2 Antonym questions in `questions.ts`** — R6.1, R6.4, R7.3
  - `antonyms` added to `QuestionSense`; `availableTypes`, `buildQuestion`, and `findCorrectOption` support `word_to_antonym` (design §7.5, D25)
  - Question building and answer checking read `antonyms` (`listReviewWords`, `submitAnswer`)
  - Done when:
    - A sense without antonyms never gets `word_to_antonym` (R7 AC)
    - The correct answer is one of the sense's antonyms; candidates come from other words' antonyms, excluding the quiz word itself and the synonyms and antonyms of all its senses
    - `findCorrectOption` accepts antonyms (case-insensitive) and returns null when several options match
    - db: `submitAnswer` checks antonym questions

- [x] **T5.3 AI distractors** — R6.5
  - Prompt describes the new question type and includes the antonym list (design §5.3); the mock adds `distractors_word_to_antonym`
  - Done when (unit): the user message includes the antonym list; the request name is `distractors_word_to_antonym`

- [x] **T5.4 Review UI and E2E** — R6.1, R7 AC
  - `QuestionCard` prompt text: 「哪一個是 X 的反義詞？」 (Which one is the antonym of X?)
  - Done when: an E2E test (`AI_MOCK=1`) completes a session that includes an antonym question; existing E2E pass

- [x] **T5.5 Deployment**
  - Push the T5.1 migration with `supabase db push`, redeploy Vercel
  - Done when: antonym questions appear and can be answered on the production URL
  - Result (2026-10-23): confirmed on the production URL

---

## Phase 6 — Word list search

- [x] **T6.1 Search query** — R3.4, R3.9
  - `listParams.ts`: `q` in `ListParams`, `normalizeSearch`, `likePattern`; `hasActiveFilters` includes `q` (design §7.7)
  - `listWords` filters with `text_key ilike` (design §6, D26)
  - Done when:
    - unit: parsing and serializing `q` (normalized, lowercased, at most 64 characters, omitted when empty); `likePattern` escapes `\`, `%`, and `_`
    - db: substring and case-insensitive matches; combined with the star filter; `%` and `_` match literally

- [x] **T6.2 Search UI and E2E** — R3.8, R3.9, NFR5
  - `WordSearch` above the filters: 300ms debounce with `router.replace`, clear button, `role="search"` (design §7.7)
  - 「清除篩選」 also clears the search; the popup keeps the search when opened and closed
  - Done when (E2E): the R3 search AC pass; typing does not add history entries; the clear button works from the keyboard; existing E2E pass

- [x] **T6.3 Deployment**
  - Redeploy Vercel (no migration)
  - Done when: search works on the production URL
  - Result (2026-10-23): confirmed on the production URL

---

## Phase 7 — Cloze questions

- [x] **T7.1 Database: question type constraint** — R6.1
  - Migration: add `cloze` to the `question_type` check on `review_logs` and `ai_distractors` (design §4.1)
  - Applied locally with `supabase migration up`, without a reset
  - Done when (`tests/db`): `apply_review` and `ai_distractors` accept `cloze`

- [ ] **T7.2 Cloze questions in `questions.ts`** — R6.1, R6.4, R7.3
  - `clozeSentence`; `examples` in `QuestionSense`; `availableTypes`, `buildQuestion`, and `findCorrectOption` support `cloze` (design §7.5, D27, D28)
  - `listReviewWords` reads `examples`
  - Done when:
    - unit: `clozeSentence` blanks every whole-word occurrence case-insensitively, matches phrases across extra whitespace, does not match inside other words (`run` in `running`, `brunch`), and returns null for inflected-only sentences
    - unit: a sense without a matching example never gets `cloze` (R7 AC); the prompt is a blanked example and the answer is the word; distractors exclude synonyms and antonyms
    - db: `submitAnswer` checks cloze answers

- [ ] **T7.3 AI distractors** — R6.5
  - Prompt describes `cloze` (design §5.3); `quizWord` uses the answer for `cloze`; the mock adds `distractors_cloze`
  - Done when (unit): the request name is `distractors_cloze` and the log input is the word, not the sentence

- [ ] **T7.4 Review UI and E2E** — R6.1, R7 AC
  - `QuestionCard` cloze layout; summary label for skipped cloze questions (design §8)
  - Done when: an E2E test (`AI_MOCK=1`) answers a cloze question; existing E2E pass

- [ ] **T7.5 Deployment**
  - Push the T7.1 migration with `supabase db push`, redeploy Vercel
  - Done when: cloze questions appear and can be answered on the production URL
