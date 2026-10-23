# Wordbox — Requirements

> Version: v0.6 (2026-10-23)
> v0.6 changes: translated into English; content unchanged.
> v0.5 changes: added Phase 5, the antonym question type `word_to_antonym` (R6.1, R6.4, R7 AC).
> v0.4 changes: added Phase 4, dark mode (R10).
> v0.3 changes: R7.4 sets box to 0 on a wrong answer (was 1), so the star count resets to zero (AC included).
> v0.2 changes: R2.7 stores new words in their dictionary headword spelling (AC included); R4.5 notes that the word itself does not change.
> Format: requirements use EARS syntax (WHEN / IF / WHILE … THE SYSTEM SHALL …); each section ends with acceptance criteria (AC).
> Phases: Phase 1 word management → Phase 2 review → Phase 3 dashboard and PWA → Phase 4 dark mode → Phase 5 antonym questions.
> UI text: the interface is in Traditional Chinese (NFR2). UI strings are quoted in Chinese, followed by an English gloss in parentheses.

---

## 0. Overview

The user enters an English word or phrase, and the system uses AI to generate English and Chinese definitions, synonyms, antonyms, example sentences, and the IPA. The user reviews words through multiple-choice questions, and the system uses the Leitner box algorithm to track familiarity and schedule reviews.

### 0.1 Glossary

| Term | Definition |
|---|---|
| Word | An English word or phrase added by a user; belongs to exactly one user |
| Sense | One meaning of a word: part of speech, English definition, Chinese definition, synonyms, antonyms, and examples; 1–3 per word |
| Box | Leitner box level, an integer 0–5; **familiarity stars = box** |
| Due | `next_due_on` ≤ the user's local today |
| Session | One review round of at most 8 questions |
| Local date | The date in the user's profile time zone, rolling over at midnight |

### 0.2 Out of scope

Offline use, bulk adding, sign-in methods other than Google, AI usage limits (only logging is in place), cloze questions, OpenAI TTS, sharing and import/export, and a time zone settings page.

---

## Phase 1 — Accounts and word management

### R1 Accounts

- **R1.1** WHEN a signed-out user visits any app page, THE SYSTEM SHALL redirect to the login page.
- **R1.2** THE SYSTEM SHALL offer 「使用 Google 登入」 (Sign in with Google) on the login page, and no other sign-in method.
- **R1.3** WHEN a user signs in for the first time, THE SYSTEM SHALL create a profile and use the IANA time zone reported by the browser as `timezone`.
- **R1.4** THE SYSTEM SHALL ensure that users can read and modify only their own data (database-level Row Level Security).
- **R1.5** THE SYSTEM SHALL provide sign-out; WHEN sign-out completes, THE SYSTEM SHALL redirect to the login page.
- **R1.6** WHEN a signed-in user visits the login page or the root path `/`, THE SYSTEM SHALL redirect to the word list.

**AC**
- [ ] Opening `/words`, `/review`, or `/dashboard` while signed out redirects to `/login`.
- [ ] User A cannot query user B's words through any API or Supabase client.
- [ ] After the first sign-in, `profiles.timezone` equals the browser's time zone (e.g. `America/Boise`).

### R2 Adding words

- **R2.1** THE SYSTEM SHALL provide an input at the top of the word list for adding one word or phrase at a time.
- **R2.2** THE SYSTEM SHALL normalize the input before submitting: trim leading and trailing whitespace and collapse runs of whitespace into one space.
- **R2.3** IF the normalized input does not match "1–64 characters, starting with an English letter, containing only English letters, spaces, hyphens `-`, and apostrophes `'`", THE SYSTEM SHALL not submit it and SHALL show a format error.
- **R2.4** WHEN the user submits a word they already have (case-insensitive), THE SYSTEM SHALL not call the AI; it SHALL open that word's popup and show 「這個字已經在你的列表裡」 (This word is already in your list).
- **R2.5** WHEN the user submits a new word, THE SYSTEM SHALL call the AI to validate it and generate its content.
- **R2.6** IF the AI decides the input is not a valid English word or phrase, THE SYSTEM SHALL not save it, SHALL show 「找不到這個字」 (Word not found), and SHALL list up to 3 spelling suggestions; WHEN the user clicks a suggestion, THE SYSTEM SHALL resubmit with that suggestion (R2.4 still applies).
- **R2.7** WHEN the AI decides the input is valid, THE SYSTEM SHALL save:
  - The word itself, in its dictionary headword spelling: normally lowercase, keeping capitals where English requires them (days, months, languages, nationalities, the pronoun I, and abbreviations such as DNA). IF the spelling returned by the AI differs from the input by more than letter case (for example, changed to the base form), THE SYSTEM SHALL store the input in lowercase instead
  - The IPA (American; may be empty)
  - 1–3 senses, ordered from most to least common, each with:
    - Part of speech (see R2.11)
    - English definition (a concise, learner-friendly definition)
    - Chinese definition (Traditional Chinese, Taiwan usage)
    - 0–5 synonyms and 0–5 antonyms (both specific to that sense)
    - 1–2 example sentences
- **R2.8** WHEN a word is saved, THE SYSTEM SHALL set `box = 0`, `next_due_on = local today`, and `is_important = false`, and SHALL open the word's popup.
- **R2.9** WHILE the AI is generating, THE SYSTEM SHALL show a loading state and disable the submit button.
- **R2.10** IF the AI call fails, times out (20 seconds), or returns an invalid format, THE SYSTEM SHALL save nothing, SHALL show an error, and SHALL offer 「重試」 (Retry).
- **R2.11** The part of speech SHALL be one of the following, displayed as its abbreviation:
  `noun (n.)`, `verb (v.)`, `adjective (adj.)`, `adverb (adv.)`, `pronoun (pron.)`, `preposition (prep.)`, `conjunction (conj.)`, `interjection (interj.)`, `determiner (det.)`, `phrase (phr.)`
- **R2.12** THE SYSTEM SHOULD log every AI call (user, kind, success, time) so that usage limits can be added later.

**AC**
- [ ] The input `  Give   up ` is handled as `Give up`.
- [ ] With `apple` already saved, entering `Apple` does not call the AI and opens the popup for `apple`.
- [ ] Entering `aple` saves nothing and shows suggestions including `apple`; clicking it adds `apple`.
- [ ] Entering `run` saves 1–3 senses, with at least one `v.` part-of-speech tag.
- [ ] `Conventional` is stored as `conventional` and `GIVE UP` as `give up`; `monday` is stored as `Monday` and `dna` as `DNA`.
- [ ] With a simulated AI timeout, no word or sense is added to the database.

### R3 Word list

- **R3.1** THE SYSTEM SHALL list all of the user's words. Each row shows the word, part-of-speech tags (deduplicated across senses, in sense order), familiarity stars (5 stars, filled count = box, read-only), and the important flag.
- **R3.2** THE SYSTEM SHALL provide filters:
  - Stars (multi-select, 0–5)
  - Important only
- **R3.3** THE SYSTEM SHALL provide sort orders:
  - Date added (newest first, **default**; oldest first)
  - Alphabetical (A→Z; Z→A; case-insensitive)
  - Stars (low→high; high→low; ties ordered by date added, newest first)
- **R3.4** THE SYSTEM SHALL reflect the filter and sort state in the URL query string so that it survives a reload.
- **R3.5** WHEN the user clicks the important flag in the list, THE SYSTEM SHALL toggle the word's important state without opening the popup.
- **R3.6** WHEN the user clicks elsewhere on a word row, THE SYSTEM SHALL open that word's popup.
- **R3.7** IF the user has no words yet, THE SYSTEM SHALL show an empty state that guides them to add one.
- **R3.8** IF no words match the filters, THE SYSTEM SHALL show 「沒有符合條件的單字」 (No matching words) and offer a way to clear the filters.

**AC**
- [ ] A word in box 3 shows 3 filled stars and 2 empty stars.
- [ ] The filters "0 stars + 1 star" and "important only" can apply at the same time.
- [ ] After choosing "A→Z" and reloading, the sort order is kept.

### R4 Word popup

- **R4.1** THE SYSTEM SHALL show in the popup: the word, IPA, a pronunciation button, stars, the important toggle, and for each sense its part of speech, English definition, Chinese definition, synonyms, antonyms, and examples.
- **R4.2** WHEN the user clicks the pronunciation button, THE SYSTEM SHALL read the word aloud with the browser's speech synthesis (en-US); IF the browser does not support speech synthesis, THE SYSTEM SHALL hide the button.
- **R4.3** THE SYSTEM SHALL provide an edit mode for changing the IPA and every field of each sense, and for adding or removing senses (keeping 1–3); the word itself cannot be edited.
- **R4.4** IF the edited content breaks the rules (empty English or Chinese definition, more than 5 synonyms or antonyms, more than 2 examples, or a sense count outside 1–3), THE SYSTEM SHALL block saving and mark the invalid fields.
- **R4.5** WHEN the user chooses 「重新生成」 (Regenerate) and confirms, THE SYSTEM SHALL regenerate the IPA and all senses with the AI and replace the old content, keeping box, next_due_on, is_important, and the review history; the word itself does not change (R4.3).
- **R4.6** IF regeneration fails, THE SYSTEM SHALL keep the original content and show an error.
- **R4.7** WHEN the user chooses 「刪除」 (Delete) and confirms, THE SYSTEM SHALL delete the word and its senses, close the popup, and remove it from the list; review logs are kept so the dashboard history stays the same.
- **R4.8** THE SYSTEM SHALL let the user close the popup with the close button, the Esc key, a click on the backdrop, or the browser's back button; at phone widths the popup is full screen.
- **R4.9** WHILE the popup is open, THE SYSTEM SHALL keep the word's identifier in the URL so that the popup stays open after a reload.

**AC**
- [ ] After editing and saving synonyms, reopening the popup shows the new content.
- [ ] After regenerating, box and important are unchanged.
- [ ] After deleting, the word disappears from the list immediately and the dashboard's answer history is unchanged.
- [ ] At phone width (375px) the popup is full screen and scrollable.

---

## Phase 2 — Review

### R5 Word selection

- **R5.1** WHEN the user starts a review session, THE SYSTEM SHALL select up to 8 distinct words:
  1. Due words first, ordered by `next_due_on` from oldest to newest, with random order within the same date;
  2. IF fewer than 8 words are due, THE SYSTEM SHALL fill the session with words that are not due, ordered by box from low to high, then by `next_due_on` from nearest to farthest;
  3. IF the user has fewer than 8 words in total, THE SYSTEM SHALL use all of them.
- **R5.2** IF the user has no words, THE SYSTEM SHALL show an empty state that guides them to add words.

### R6 Questions

- **R6.1** For each selected word, THE SYSTEM SHALL pick a random sense, then a random question type from the types available for that sense:

  | Type | Prompt | Correct option | Available when |
  |---|---|---|---|
  | `word_to_zh` | The word (with part of speech) | The sense's Chinese definition | Always |
  | `word_to_synonym` | The word (with part of speech) | One of the sense's synonyms | The sense has at least 1 synonym |
  | `word_to_antonym` | The word (with part of speech) | One of the sense's antonyms | The sense has at least 1 antonym (Phase 5) |
  | `zh_to_word` | The Chinese definition (with part of speech) | The word | Always |

- **R6.2** THE SYSTEM SHALL give each question 4 options (1 correct, 3 distractors) in random order.
- **R6.3** THE SYSTEM SHALL take distractors from the user's own words first, and SHOULD prefer candidates with the same part of speech as the question.
- **R6.4** THE SYSTEM SHALL ensure that distractors are distinct from each other, are not equal to the correct option (case-insensitive), are not the quiz word itself, and are not a synonym of any of the quiz word's senses. Distractors for `word_to_antonym` also must not be an antonym of any of the quiz word's senses. Distractor words for `zh_to_word` must not have the same Chinese definition as the prompt.
- **R6.5** IF the user's words yield fewer than 3 candidates that satisfy R6.4, THE SYSTEM SHALL generate the missing distractors with the AI and cache them; later questions for the same sense and question type reuse the cache. WHEN the sense is edited or regenerated, THE SYSTEM SHALL invalidate the cache.
- **R6.6** IF generating AI distractors for a question fails, THE SYSTEM SHALL try another question type for that word; IF no question type works, THE SYSTEM SHALL skip the word and take the next one according to R5.1.

### R7 Answering and familiarity

- **R7.1** THE SYSTEM SHALL show one question at a time, with progress (e.g. 3 / 8).
- **R7.2** WHEN the user picks an option, THE SYSTEM SHALL lock the question and mark the correct option in green; IF the answer is wrong, it SHALL also mark the user's option in red; it SHALL then show the 「下一題」 (Next question) button.
- **R7.3** WHEN the user answers, THE SYSTEM SHALL immediately check the answer on the server, save a review log, and update familiarity (answers already given are kept if the user leaves mid-session); a repeated submission of the same question SHALL count only once.
- **R7.4** Familiarity update rules (today = local today):

  | Case | box | next_due_on |
  |---|---|---|
  | Wrong | Set to 0 | Today + 1 day |
  | Correct and the word is due | `min(box + 1, 5)` | Today + interval(new box) |
  | Correct but the word is not due (a filler word) | Unchanged | Unchanged |

  Intervals (days):

  | Box | 1 | 2 | 3 | 4 | 5 |
  |---|---|---|---|---|---|
  | Normal | 1 | 2 | 4 | 8 | 16 |
  | Important | 1 | 1 | 2 | 4 | 8 |

  (Important interval = `max(1, ceil(normal interval / 2))`. Toggling important does not change an already scheduled `next_due_on`; the new interval applies at the next answer.)

  (Stars = box and reset to zero on a wrong answer: 0 stars means a new word or one just answered wrong, so the star count is the number of correct answers in a row since the last wrong one.)

- **R7.5** WHEN every question in the session is answered, THE SYSTEM SHALL show a summary: the number of correct answers, each word's result and star change, and the 「再來一輪」 (Another round) and 「回單字列表」 (Back to word list) buttons; IF no words are due anymore, THE SYSTEM SHALL show 「今天到期的字都複習完了」 (All of today's due words are reviewed).

**AC**
- [ ] Box 2, due, normal word, correct → box 3, next_due_on = today + 4.
- [ ] Box 2, due, important word, correct → box 3, next_due_on = today + 2.
- [ ] Box 5, due, correct → box 5, next_due_on = today + 16.
- [ ] Box 4, wrong → box 0, next_due_on = tomorrow.
- [ ] A filler word that is not due, answered correctly → box and next_due_on both unchanged.
- [ ] A sense without synonyms never gets a `word_to_synonym` question.
- [ ] A sense without antonyms never gets a `word_to_antonym` question; when it has antonyms, the correct option is one of the sense's antonyms and none of the other 3 options is an antonym of the quiz word.
- [ ] A session can be completed with only 2 words saved (the AI fills in the distractors).
- [ ] Closing the page at question 4 keeps the logs of the first 3 answers.

---

## Phase 3 — Dashboard and PWA

### R8 Dashboard

- **R8.1** THE SYSTEM SHALL show the user's total number of words.
- **R8.2** THE SYSTEM SHALL show a bar chart of how many words have 0–5 stars.
- **R8.3** THE SYSTEM SHALL show a GitHub-style heatmap covering the last 53 weeks (including this week), with one column per week and one row per day (Sunday on top); each cell is the number of answers on that local date.
- **R8.4** THE SYSTEM SHALL shade heatmap cells in 5 levels by answer count: `0`, `1–8`, `9–16`, `17–32`, `33+`.
- **R8.5** WHEN the user hovers over a cell (or taps it on a phone), THE SYSTEM SHALL show the date and the answer count.
- **R8.6** THE SYSTEM SHALL compute each review log's local date in the user's time zone at the time of answering, rolling over at midnight.

**AC**
- [ ] After 10 answers today, today's cell is level 3 (9–16).
- [ ] After deleting a word, the total drops by 1 and the heatmap is unchanged.

### R9 PWA

- **R9.1** THE SYSTEM SHALL provide a Web App Manifest (name, icons, theme color, `display: standalone`) so users can install the app to the home screen.
- **R9.2** THE SYSTEM SHALL cache static assets only; IF the device is offline, THE SYSTEM SHALL show a 「需要網路連線」 (Internet connection required) page.

**AC**
- [ ] Chrome (Android) and Safari (iOS) can add the app to the home screen and open it in a standalone window.
- [ ] Reloading in airplane mode shows the offline page.

---

## Phase 4 — Dark mode

### R10 Appearance

- **R10.1** THE SYSTEM SHALL provide light and dark appearances; IF the user has not switched manually, THE SYSTEM SHALL follow the device's system setting (`prefers-color-scheme`) at load time.
- **R10.2** THE SYSTEM SHALL provide a dark mode switch (on = dark). The choice is stored on the device (not synced to other devices or the account); once the user switches manually, the chosen appearance always applies and the system setting is no longer followed.
- **R10.3** WHEN a page loads, THE SYSTEM SHALL apply the appearance before the page is shown, without flashing the other appearance first.
- **R10.4** THE SYSTEM SHALL NOT switch appearance live when the system setting changes during use (there is no "follow system" mode).
- **R10.5** In the dark appearance, text contrast SHALL be at least 4.5:1, and icons and chart marks SHALL be at least 3:1 (the heatmap is checked as a dataviz ordinal scale).

**AC**
- [ ] With the system in dark mode and no manual switch yet, the app opens in dark mode the first time.
- [ ] With the system in dark mode, after turning the switch off (light) and reloading, the app stays light and does not flash dark while loading.
- [ ] The login and offline pages use the same appearance.

---

## Non-functional requirements

- **NFR1 Responsive**: supports widths from 360px to 1440px, mobile first. On phones, navigation is a bottom tab bar (單字 Words / 複習 Review / 統計 Stats); on desktop, a top navigation bar.
- **NFR2 Language**: the interface is in Traditional Chinese.
- **NFR3 Security**: the OpenAI API key exists only on the server and must never appear in browser code.
- **NFR4 Performance**: with up to 2,000 words, filtering and sorting the word list should finish within 300ms.
- **NFR5 Accessibility**: every action can be done with the keyboard; stars have a text alternative (e.g. 「熟悉度 3 / 5」, Familiarity 3 / 5); focus is trapped inside the popup while it is open.
- **NFR6 Testability**: AI calls can be switched to a mock mode with an environment variable for automated tests.
