# 英文單字記憶 App — Design

> 版本：v0.6（2026-10-21）・對應 `requirements.md` v0.3
> Phase 3 的設計為初稿，進入該階段時再修訂。
>
> v0.6 變更：答錯時 box 設為 0（§7.3、D16）。
> v0.5 變更：細化 Phase 2——目錄（§3）、`apply_review` 介面與併發處理（§4.3、D13）、干擾選項快取的使用方式（§5.3）、出題與作答的介面（§6、D14、D15）、選字回傳完整序列（§7.4）。
> v0.4 變更：AI 回傳 `headword`，單字以字典標準寫法儲存（§5.1、§5.2、§6、§7.1、D12）。
> v0.3 變更：`words.text_key`（§4.1）；單字列表改為分頁載入（§6、D11）。
> v0.2 變更：`profiles.timezone` 改為 nullable（§4.1、§4.4）；編輯改為原地更新義項（§4.1、§4.3、D9）；`middleware.ts` → `proxy.ts`（§3）；`questionId` 由伺服器產生（§6）。

---

## 1. 架構

```
┌──────────────── Browser (PWA) ────────────────┐
│  Next.js React Client Components              │
│  Web Speech API（發音）                        │
└──────────────┬────────────────────────────────┘
               │ Server Actions / Route Handlers
┌──────────────▼──────────── Vercel ────────────┐
│  Next.js (App Router) Server                  │
│   ├ lib/domain   純函式：Leitner、選字、出題    │
│   ├ lib/ai       OpenAI 呼叫 + Zod 驗證        │
│   └ lib/db       Supabase server client        │
└───────┬───────────────────────────┬───────────┘
        │                           │
┌───────▼────────┐          ┌───────▼────────┐
│ Supabase       │          │ OpenAI API     │
│ Postgres + RLS │          │ structured out │
│ Auth (Google)  │          └────────────────┘
└────────────────┘
```

原則：
- **商業邏輯集中在 `lib/domain` 的純函式**（不碰資料庫或網路），方便以單元測試覆蓋需求的 AC。
- 所有寫入都經過 Server Actions；瀏覽器端只使用 Supabase 做登入流程，不直接寫資料表。
- RLS 是最後一道防線：即使伺服器端程式有錯，也查不到別人的資料。

## 2. 技術選擇

| 項目 | 選擇 | 備註 |
|---|---|---|
| 語言 | TypeScript（strict） | |
| 框架 | Next.js App Router | Server Components 讀取、Server Actions 寫入 |
| UI | Tailwind CSS + shadcn/ui | 可替換；Dialog、Toast、Select 直接使用 |
| 資料庫 / 登入 | Supabase（Postgres、Auth Google provider），`@supabase/ssr` | |
| AI | `openai` SDK，structured outputs（JSON Schema strict） | 模型型號以 `OPENAI_MODEL` 設定 |
| 驗證 | Zod | AI 回傳與表單共用 schema |
| 日期 / 時區 | `date-fns` + `date-fns-tz` | 一律在伺服器端計算當地日期 |
| 圖表 | 長條圖用 Recharts；熱力圖自行以 CSS Grid 實作 | |
| 測試 | Vitest（單元）、Playwright（E2E） | |
| 部署 | Vercel + Supabase Cloud | |

### 環境變數

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
OPENAI_API_KEY=          # 僅伺服器端
OPENAI_MODEL=            # 例：支援 structured outputs 的模型
AI_MOCK=0                # 1 = 使用 fixtures，不呼叫 OpenAI（NFR6）
```

## 3. 目錄結構

```
app/
  login/page.tsx
  auth/callback/route.ts          # OAuth 回呼，交換 session
  (app)/layout.tsx                # 導覽列（NFR1）
  (app)/words/page.tsx            # ?stars=0,1&important=1&sort=created_desc&word=<id>
  (app)/review/page.tsx
  (app)/dashboard/page.tsx
  manifest.ts                     # Phase 3
  offline/page.tsx                # Phase 3
proxy.ts                          # 未登入導向 /login（R1.1、R1.6）；Next.js 16 起取代 middleware.ts
lib/
  domain/
    normalize.ts                  # R2.2、R2.3
    pos.ts                        # 詞性 enum 與縮寫（R2.11）
    stars.ts                      # box → 星數
    random.ts                     # 可設定 seed 的 rng、shuffle、pick（Phase 2）
    leitner.ts                    # R7.4（Phase 2）
    selection.ts                  # R5.1（Phase 2）
    questions.ts                  # R6.1–R6.4（Phase 2）
    heatmap.ts                    # R8.3、R8.4（Phase 3）
    dates.ts                      # 當地日期計算
  ai/
    schemas.ts                    # Zod + JSON Schema
    prompts.ts
    generateWord.ts               # R2.5–R2.7、R4.5
    generateDistractors.ts        # R6.5（Phase 2）
    fixtures/                     # AI_MOCK 用
  db/
    server.ts                     # Supabase server client
    words.ts / reviews.ts / stats.ts
  words/                          # 單字流程（依賴以參數注入，供 db 測試）
  review/                         # 複習流程（Phase 2）
    distractors.ts                # 快取 → AI → 過濾（R6.5）
    startSession.ts               # R5、R6
    submitAnswer.ts               # R7.3、R7.4
  actions/                        # "use server" 薄包裝：建立 client 後呼叫 words/、review/
    words.ts                      # addWord、updateWord、regenerateWord、deleteWord、setImportant
    review.ts                     # startReviewSession、submitAnswer、countDueWords（Phase 2）
components/
  words/  review/  dashboard/  ui/
supabase/migrations/
tests/unit/  tests/e2e/
```

## 4. 資料庫

### 4.1 Schema

```sql
-- Phase 1 ---------------------------------------------------------------

create table profiles (
  id uuid primary key references auth.users on delete cascade,
  timezone text,                  -- null = 尚未初始化（§4.4）；計算日期時視為 'UTC'
  created_at timestamptz not null default now()
);

create type part_of_speech as enum (
  'noun','verb','adjective','adverb','pronoun',
  'preposition','conjunction','interjection','determiner','phrase'
);

create table words (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  text text not null,
  ipa text,
  is_important boolean not null default false,
  box smallint not null default 0 check (box between 0 and 5),
  next_due_on date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  text_key text generated always as (lower(text)) stored  -- 字母排序與查重（PostgREST 無法以運算式排序）
);
create unique index words_user_text_uniq on words (user_id, lower(text));   -- R2.4
create index words_user_due_idx on words (user_id, next_due_on);
create index words_user_text_key_idx on words (user_id, text_key);
create index words_user_box_idx on words (user_id, box);

create table senses (
  id uuid primary key default gen_random_uuid(),
  word_id uuid not null references words on delete cascade,
  position smallint not null check (position between 1 and 3),
  pos part_of_speech not null,
  def_en text not null check (length(def_en) > 0),
  def_zh text not null check (length(def_zh) > 0),
  synonyms text[] not null default '{}' check (cardinality(synonyms) <= 5),
  antonyms text[] not null default '{}' check (cardinality(antonyms) <= 5),
  examples text[] not null default '{}' check (cardinality(examples) <= 2),
  unique (word_id, position) deferrable initially deferred  -- 編輯時重排 position（§4.3）
);

create table ai_generation_logs (                                         -- R2.12
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users on delete cascade,
  kind text not null check (kind in ('generate','regenerate','distractors')),
  input text not null,
  success boolean not null,
  created_at timestamptz not null default now()
);

-- Phase 2 ---------------------------------------------------------------

create table review_logs (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users on delete cascade,
  question_id uuid not null unique,                   -- 冪等（R7.3）
  word_id uuid references words on delete set null,   -- 刪字保留紀錄（R4.7）
  sense_id uuid references senses on delete set null, -- 重新生成保留紀錄（R4.5）
  question_type text not null
    check (question_type in ('word_to_zh','word_to_synonym','zh_to_word')),
  is_correct boolean not null,
  was_due boolean not null,
  box_before smallint not null,
  box_after smallint not null,
  answered_at timestamptz not null default now(),
  local_date date not null                            -- R8.6
);
create index review_logs_user_date_idx on review_logs (user_id, local_date);

create table ai_distractors (                                             -- R6.5
  sense_id uuid not null references senses on delete cascade,
  question_type text not null
    check (question_type in ('word_to_zh','word_to_synonym','zh_to_word')),
  options text[] not null check (cardinality(options) = 3),
  created_at timestamptz not null default now(),
  primary key (sense_id, question_type)
);

-- senses 的 after update trigger：pos、def_en、def_zh、synonyms、antonyms、examples
-- 任一變動時刪除該義項的 ai_distractors；只有 position 變動時保留（R6.5、D9）
```

### 4.2 RLS

```sql
alter table profiles enable row level security;
create policy own on profiles using (id = auth.uid()) with check (id = auth.uid());

alter table words enable row level security;
create policy own on words using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table senses enable row level security;
create policy own on senses
  using (exists (select 1 from words w where w.id = word_id and w.user_id = auth.uid()))
  with check (exists (select 1 from words w where w.id = word_id and w.user_id = auth.uid()));

-- review_logs、ai_generation_logs：user_id = auth.uid()
-- ai_distractors：經 senses → words 關聯檢查，寫法同 senses
```

### 4.3 交易性 RPC

Supabase JS client 不支援多語句交易，因此以 Postgres function（`security invoker`，受 RLS 約束）包住多表寫入：

| Function | 用途 | 行為 |
|---|---|---|
| `create_word(p_text, p_ipa, p_senses jsonb, p_today date)` | R2.7、R2.8 | 新增 word 與 senses；若觸發唯一索引衝突則回傳既有 word id 與 `exists = true` |
| `update_word_content(p_word_id, p_ipa, p_senses jsonb)` | R4.3、R6.5 | 編輯用，原地更新：`p_senses` 依顯示順序排列，帶 `id` 的更新該義項、沒有 `id` 的新增，不在清單中的刪除；position 依陣列順序重排。內容有變動的義項刪除其 ai_distractors；未變動的保留快取與 sense id。更新 `updated_at` |
| `replace_word_content(p_word_id, p_ipa, p_senses jsonb)` | R4.5 | 重新生成用：刪除所有舊 senses、新增新 senses、更新 `updated_at`；舊義項的 ai_distractors 隨之 cascade 刪除（R6.5） |
| `apply_review(p_question_id, p_word_id, p_sense_id, p_question_type, p_is_correct, p_was_due, p_box_before, p_due_before, p_box_after, p_due_after, p_local_date)` | R7.3、R7.4（Phase 2） | 見下方 |

`apply_review` 依序：
1. 鎖定 word（`for update`）；找不到 → `P0002`。
2. `question_id` 已存在 → 不做任何事，回傳既有紀錄（`duplicate = true`）。
3. word 目前的 `box`、`next_due_on` 不等於 `p_box_before`、`p_due_before` → `40001`（D13）。
4. 寫入 review_logs、更新 words 的 `box`、`next_due_on`，回傳 `{ is_correct, box_before, box_after, duplicate: false }`。

Leitner 規則只實作在 `lib/domain/leitner.ts`，RPC 不重算，只負責原子寫入與冪等。

### 4.4 Profile 建立

`auth.users` 的 insert trigger 建立 `profiles`（timezone = `null`）。登入回呼後，client 以 `Intl.DateTimeFormat().resolvedOptions().timeZone` 呼叫 `initProfileTimezone(tz)`：

```sql
update profiles set timezone = $tz where id = auth.uid() and timezone is null;
```

- 只有 `timezone is null` 時才寫入（R1.3），之後不自動更新。
- 首次寫入失敗時，下次登入會再嘗試。使用者若本來就在 UTC 也能正確初始化。
- 伺服器端驗證 `tz` 是有效的 IANA 時區，無效時不寫入。
- 讀取時以 `coalesce(timezone, 'UTC')` 計算當地日期（§7.2）。

## 5. AI 設計

### 5.1 生成單字：輸出 schema

OpenAI strict structured outputs 要求所有欄位都必填，因此選填欄位以 `null` 表示。

```ts
const SenseSchema = z.object({
  pos: z.enum(POS_VALUES),
  def_en: z.string().min(1),
  def_zh: z.string().min(1),
  synonyms: z.array(z.string()).max(5),
  antonyms: z.array(z.string()).max(5),
  examples: z.array(z.string()).min(1).max(2),
});

const GenerateWordSchema = z.object({
  is_valid: z.boolean(),
  suggestions: z.array(z.string()).max(3),          // is_valid=false 時使用
  headword: z.string().nullable(),                  // 字典標準寫法；is_valid=false 時為 null
  ipa: z.string().nullable(),
  senses: z.array(SenseSchema).max(3),              // is_valid=true 時 1–3 個
});
```

伺服器端在 Zod 驗證後再檢查：`is_valid = true` 時 `senses.length ≥ 1`，否則視為格式錯誤（R2.10）。

### 5.2 生成單字：prompt 要點

System prompt（`lib/ai/prompts.ts`）需涵蓋：
1. 角色：為台灣的英文學習者編寫詞典條目。
2. 判斷輸入是否為真實的英文單字或常用片語（含 phrasal verb、idiom）；專有名詞、拼錯字、隨機字串都判為無效，並提供最多 3 個最接近的有效拼法。
3. 最多 3 個義項，依常用程度排序；同一個字有不同詞性時各自成為義項。
4. `def_en`：學習者友善、25 個英文字以內。`def_zh`：繁體中文、台灣用語、20 個中文字以內。
5. 同義詞與反義詞必須對應該義項，0–5 個，單字或短片語，不要硬湊。
6. 例句 1–2 句、20 個英文字以內，必須包含該字。
7. `ipa`：美式發音，以 `/…/` 包住；不確定時回傳 `null`。
8. 片語的詞性使用 `phrase`。
9. `headword`：字典詞條的寫法。一般為小寫；英文本身需大寫者保留（星期、月份、語言、國籍、代名詞 I、縮寫如 DNA）。只能改變大小寫，不可改拼字、詞形或空白。

使用者輸入只放在 user message，並明確標示為「要查詢的字」，避免 prompt injection。

### 5.3 干擾選項（Phase 2）

```ts
const DistractorsSchema = z.object({ options: z.array(z.string()).length(3) });
```

輸入：題型、題目、正確答案、目標字的同義詞清單。要求：與正確答案同語言、同格式、同詞性，看起來合理但確定錯誤，且不可為同義詞。回傳的 3 個選項需互不重複，否則視為格式錯誤；之後與字庫候選合併、以 R6.4 的規則過濾，仍湊不到 3 個干擾選項即視為失敗（R6.6）。

快取的使用（`lib/review/distractors.ts`）：
- AI 一律生成 3 個，快取存 3 個；出題時先用字庫候選，不足的部分從快取（或 AI 結果）依序補上。
- 讀出快取後也以 R6.4 過濾（字庫或義項可能已改變）；過濾後不夠補足時，重新呼叫 AI 並覆寫快取。
- AI 失敗時不寫入快取。
- `AI_MOCK=1` 時 mock 依 request `name` 分派：干擾選項產生可辨識、符合 R6.4 的選項；目標字為 `mock distractor fail` 時回傳失敗（測試 R6.6）。

### 5.4 共同處理

- 逾時 20 秒（`AbortController`），不自動重試，由使用者手動重試（R2.10）。
- 每次呼叫都寫入 `ai_generation_logs`（R2.12）。
- `AI_MOCK=1` 時從 `lib/ai/fixtures/*.json` 讀取資料，fixture 需涵蓋：有效單字、多義字（`run`）、片語（`give up`）、拼錯字（`aple`）、逾時、格式錯誤。

## 6. Server Actions

```ts
// lib/actions/words.ts
type AddWordResult =
  | { status: 'exists'; wordId: string }
  | { status: 'invalid'; suggestions: string[] }
  | { status: 'created'; wordId: string }
  | { status: 'error'; message: string };

addWord(input: string): Promise<AddWordResult>
  // 1. normalize + validate（R2.2、R2.3）
  // 2. 以 lower(text) 查詢是否已存在 → exists（R2.4）
  // 3. generateWord → invalid / error
  // 4. canonicalText(input, headword) 決定儲存的寫法（R2.7、D12）
  // 5. create_word RPC（併發時唯一索引衝突 → exists）

updateWord(wordId, { ipa, senses }): Promise<Result>       // R4.3、R4.4；senses 帶既有 id → update_word_content
regenerateWord(wordId): Promise<Result>                    // R4.5、R4.6
deleteWord(wordId): Promise<Result>                        // R4.7
setImportant(wordId, value: boolean): Promise<Result>      // R3.5（前端 optimistic update）

// lib/actions/review.ts（Phase 2）
type Question = {
  questionId: string;              // crypto.randomUUID()，伺服器產生
  wordId: string; senseId: string;
  type: QuestionType;
  prompt: string;                  // 單字或中文解釋
  pos: PartOfSpeech;               // 題目旁顯示詞性
  options: string[];               // 4 個，已打亂；不標示哪個正確（D15）
};

type AnswerResult =
  | { ok: true; isCorrect: boolean; correctOption: string; boxBefore: number; boxAfter: number }
  | { ok: false; message: string };

startReviewSession(): Promise<
  { ok: true; questions: Question[] } | { ok: false; message: string }
>                                           // 沒有單字時 questions = []（R5.2）
submitAnswer({ questionId, wordId, senseId, questionType, options, selected }): Promise<AnswerResult>
  // client 原樣帶回 questionId 與 options；重送時以 questionId 判定冪等（R7.3）
countDueWords(): Promise<number>            // ReviewIntro 與結算畫面（R7.5）
```

### startReviewSession 流程（R5、R6）

1. 一次查詢讀取所有單字與義項（選字狀態 + 干擾候選），以及 profile 時區。
2. `orderSessionCandidates`（§7.4）產生完整序列，取前 8 個。
3. 每個字隨機選義項、隨機選題型，以 `buildQuestion` 從字庫出題。
4. 回傳 `needsAi` 的題目**平行**呼叫 `getDistractors`（D14）。
5. 失敗的字改用其他題型（每種最多試一次）；全部失敗則略過，從序列的下一個字遞補，回到步驟 3，直到 8 題或序列用完（R6.6）。

### submitAnswer 流程（R7.3、R7.4）

1. 驗證參數：uuid、題型、`options` 為 4 個不重複字串且包含 `selected`。
2. 讀取 word、sense（RLS 限定自己的）與 profile；找不到 → `ok: false`（作答期間被刪除或重新生成，該題不計）。
3. 在 `options` 中找出正確選項（規則見下方）；找不到恰好一個 → `ok: false`。
4. `applyAnswer`（§7.3）→ `apply_review`；`40001` 時重新讀取並重試一次（D13）。
5. 重送時 `apply_review` 回傳第一次的紀錄，結果相同。

讀取（列表、popup、dashboard）在 Server Components 中直接查詢。列表篩選與排序以 URL search params 驅動（R3.4），查詢在資料庫端完成。

### 單字列表分頁（NFR4、D11）

- 每次查詢 100 筆（`range`），以同一個查詢取得 `count: exact` 顯示總數；排序最後以 `id` 決定，分頁不重複不遺漏。
- 第一頁由 Server Component 查詢；捲動到底時以 `loadMoreWords(listQuery, offset)` action 載入下一頁，也提供「載入更多」按鈕供鍵盤操作。
- 伺服器只傳精簡資料給 client 列表元件，由 client 渲染每一列，避免 RSC 傳送整棵元素樹。
- 篩選、排序或資料變動時，伺服器重新渲染第一頁，client 列表重設；載入中的舊頁結果丟棄。
- 效能以 `npm run test:perf` 量測（production build、2,000 字）。

### submitAnswer 的伺服器端判定（R7.3）

伺服器不保存 session 狀態；作答時依資料庫重新計算正確選項（干擾選項已排除所有同義詞，因此 4 個選項中恰好一個符合）：
- `word_to_zh`：等於 `sense.def_zh`
- `word_to_synonym`：屬於 `sense.synonyms`（不分大小寫）
- `zh_to_word`：等於 `word.text`（不分大小寫）

`isCorrect = selected === correctOption`。

`was_due` 也在伺服器端以作答當下的當地日期計算，然後呼叫 `apply_review` RPC。

## 7. Domain 邏輯（純函式）

### 7.1 normalize.ts

```ts
normalizeInput(raw: string): string        // trim + 連續空白合併
isValidInput(s: string): boolean           // /^[A-Za-z][A-Za-z '\-]{0,63}$/
dedupeKey(s: string): string               // normalizeInput(s).toLowerCase()
canonicalText(input: string, headword: string | null): string
  // headword 與 input 只差大小寫且格式有效 → headword；否則 input 全小寫（R2.7）
```

### 7.2 dates.ts

```ts
localToday(timezone: string, now = new Date()): string   // 'YYYY-MM-DD'
addDays(date: string, n: number): string
```

所有「今天」都由伺服器依 `profiles.timezone` 計算（null 時視為 `'UTC'`），不信任 client 的日期。

### 7.3 leitner.ts（R7.4）

```ts
const BASE_INTERVAL = [0, 1, 2, 4, 8, 16] as const;  // index = box

export function intervalDays(box: number, important: boolean): number {
  const d = BASE_INTERVAL[box];
  return important ? Math.max(1, Math.ceil(d / 2)) : d;
}

export function applyAnswer(
  s: { box: number; nextDueOn: string; isImportant: boolean },
  isCorrect: boolean,
  today: string,
): { box: number; nextDueOn: string; wasDue: boolean } {
  const wasDue = s.nextDueOn <= today;
  if (!isCorrect) return { box: 0, nextDueOn: addDays(today, 1), wasDue };
  if (!wasDue) return { box: s.box, nextDueOn: s.nextDueOn, wasDue };
  const box = Math.min(s.box + 1, 5);
  return { box, nextDueOn: addDays(today, intervalDays(box, s.isImportant)), wasDue };
}
```

### 7.4 selection.ts（R5.1）

```ts
orderSessionCandidates(words: WordState[], today: string, rng: Rng): WordState[]
  due    = words.filter(w => w.nextDueOn <= today)
             .sort(by nextDueOn asc, tie → rng)
  notDue = words.filter(w => w.nextDueOn > today)
             .sort(by box asc, then nextDueOn asc)
  return [...due, ...notDue]
```

回傳完整序列而非前 8 個：`startReviewSession` 依序取前 8 個出題，某個字無法出題時（R6.6）從同一序列繼續往下取。

### 7.5 questions.ts（R6）

```ts
type QuestionType = 'word_to_zh' | 'word_to_synonym' | 'zh_to_word';

availableTypes(sense): QuestionType[]     // 同義詞為空時排除 word_to_synonym

buildQuestion(target, sense, type, pool, rng):
  { question: Question } | { needsAi: QuestionDraft }
  // 義項與題型由呼叫端決定，R6.6 換題型時重新呼叫
  // QuestionDraft：題目、正確答案、字庫找到的部分候選、missing、排除清單

completeQuestion(draft, extra: string[], rng): Question | null
  // 以快取或 AI 的選項補足；套用同一份排除清單，仍不足時回傳 null（R6.6）

findCorrectOption(type, word, sense, options): string | null   // submitAnswer 判定用（§6）
```

候選來源與排除規則：

| 題型 | 候選來源（其他單字） | 額外排除 |
|---|---|---|
| `word_to_zh` | 各義項的 `def_zh` | 等於目標字任一義項的 `def_zh` |
| `word_to_synonym` | 各義項的 `synonyms` | 目標字本身、目標字所有義項的同義詞 |
| `zh_to_word` | 各單字的 `text` | 屬於目標字同義詞的單字；任一義項 `def_zh` 等於題目的單字 |

共同規則：比較時一律 trim 加小寫，去除重複，排除正確答案。排序：同詞性的候選優先，其餘隨機；取前 3 個。不足時回傳 `needsAi`，由 action 層讀取 `ai_distractors` 快取，沒有快取才呼叫 AI。

所有隨機行為都透過注入的 `rng`，單元測試以固定 seed 取得可重現的結果。

### 7.6 heatmap.ts（R8.3、R8.4）

```ts
heatLevel(count: number): 0 | 1 | 2 | 3 | 4
  // 0 → 0, 1–8 → 1, 9–16 → 2, 17–32 → 3, 33+ → 4

buildHeatmapGrid(counts: Map<string, number>, today: string): Cell[][]
  // 53 欄 × 7 列，最後一欄包含 today，週日為第一列；today 之後的格子不顯示
```

## 8. 畫面

| 路由 | 主要元件 | 說明 |
|---|---|---|
| `/login` | `GoogleSignInButton` | |
| `/words` | `AddWordForm`、`WordFilters`、`WordList`、`WordDialog` | `?word=<id>` 控制 popup（R4.9）；以 `router.push` 開啟，因此「上一頁」可關閉（R4.8） |
| `/review` | `ReviewIntro` → `QuestionCard` → `SessionSummary` | 題目在 client state 中；每題作答都立即呼叫 `submitAnswer` |
| `/dashboard` | `StatTotal`、`StarDistributionChart`、`Heatmap` | Server Component 查詢後傳入 |

狀態處理：AI 生成中顯示 skeleton；所有錯誤以 toast 顯示，並在原位置提供重試按鈕。

## 9. 錯誤處理

| 情況 | 行為 |
|---|---|
| AI 逾時或失敗 | 不寫入資料，回傳 `error`，UI 顯示重試（R2.10、R4.6） |
| AI 格式不符 | Zod 驗證失敗，同上，並記錄到 log |
| 新增時併發重複 | 唯一索引衝突 → 回傳 `exists`（R2.4） |
| 重複送出答案 | `question_id` 唯一 → 回傳第一次的結果（R7.3） |
| Session 過期 | `proxy.ts` 導向 `/login` |

## 10. 測試策略

- **單元測試（Vitest）**：`lib/domain/*` 全部函式，並以 requirements 的 AC 直接作為測試案例（例如 R7.4 的 5 個 AC 對應 `leitner.test.ts`）。
- **AI 層**：以 fixtures 測試 Zod 驗證與錯誤分支（有效、無效、格式錯誤、逾時）。
- **資料庫**：以 Supabase CLI 啟動本地環境，測試 RLS（A 使用者查不到 B 使用者的資料）與 RPC。
- **E2E（Playwright）**：`AI_MOCK=1` 加本地 Supabase；登入以測試用 session 注入，不實際經過 Google。

## 11. 設計決策紀錄

| # | 決策 | 理由 |
|---|---|---|
| D1 | 熟悉度記在 word，不記在 sense | 列表只需一個星數；Phase 1 討論結論（Q5） |
| D2 | `next_due_on` 使用 date，不使用 timestamp | Leitner 以「天」為單位，避免時區與時刻造成的邊界問題 |
| D3 | 補位字答對時不升級 | 避免提前複習破壞間隔設計（Q3） |
| D4 | 伺服器端重新判定答案，不保存 session | 無狀態，適合 serverless，也避免竄改作答結果 |
| D5 | 刪字時保留 review_logs（`set null`） | Dashboard 歷史不應因刪字而改變 |
| D6 | 干擾選項以字庫為主，AI 補足並快取 | 降低 API 成本（D2 討論結論） |
| D7 | 只做線上版本，PWA 僅提供安裝 | 離線同步的複雜度不划算（Q4） |
| D8 | 暫不限制 AI 用量，但記錄 log | 日後可依 log 直接加上限（Q2） |
| D9 | 編輯原地更新義項，重新生成才整批取代 | 編輯只讓有變動義項的干擾快取失效（R6.5），並保留 `review_logs.sense_id` |
| D10 | `profiles.timezone` 以 null 表示未初始化 | 可區分「未初始化」與「使用者在 UTC」，首次寫入失敗也能補寫 |
| D11 | 單字列表每頁 100 筆，捲動載入 | 2,000 字一次渲染時 RSC 1.6MB、篩選 0.6–1 秒；分頁後約 6KB、70–160ms，符合 NFR4。也避開 PostgREST 預設 1,000 筆上限 |
| D12 | 單字以字典標準寫法儲存，由 AI 在同一次呼叫回傳 `headword` | 一律小寫會錯寫 Monday、English、I、DNA；首字母大寫不符合字典慣例。只接受大小寫差異，避免 AI 擅自改成原形 |
| D13 | `apply_review` 以 box、next_due_on 做樂觀鎖，衝突時 action 重讀重試一次 | Leitner 規則只保留一份 TS 實作；同一個字在兩個分頁同時作答時不會以舊狀態覆寫 |
| D14 | 出題時需要 AI 的題目平行處理 | 字庫小時每題都可能需要 AI，依序呼叫最壞要 8 × 20 秒 |
| D15 | 題目不帶正確答案，作答時 client 帶回 4 個選項由伺服器判定 | 無狀態且不洩漏答案；伺服器需要選項才能回傳要標綠色的那一個（R7.2） |
| D16 | 答錯時 box 設為 0，而非標準 Leitner 的 1 | 星數 = box，設為 1 會讓新字答錯反而多一顆星；排程不變，答錯的字仍是明天複習 |
