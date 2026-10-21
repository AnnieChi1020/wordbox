# 英文單字記憶 App — Tasks

> 版本：v0.6（2026-10-21）・對應 `requirements.md` v0.3、`design.md` v0.6
> 每個任務都標註對應需求；完成條件以該需求的 AC 為準。
> 依序實作；一個任務完成（含測試通過）後才開始下一個。

---

## Phase 1 — 帳號與單字管理

- [x] **T1.1 專案骨架**
  - Next.js App Router + TypeScript strict、Tailwind、shadcn/ui、ESLint、Prettier
  - Vitest、Playwright 設定；`.env.example`（design §2）
  - 完成條件：`npm run dev`、`npm test`、`npm run test:e2e` 都可執行

- [x] **T1.2 Supabase 與資料庫（Phase 1 部分）** — R1.4
  - Supabase CLI 本地環境
  - Migration：`profiles`、`part_of_speech`、`words`、`senses`、`ai_generation_logs`、索引、RLS（design §4.1、§4.2）
  - Profile 建立 trigger（design §4.4，timezone 預設為 null）
  - RPC：`create_word`、`update_word_content`、`replace_word_content`（design §4.3）
  - 完成條件：RLS 測試證明 A 使用者查不到 B 使用者的 words、senses；`update_word_content` 測試證明未變動的義項保留原 id

- [x] **T1.3 Google 登入** — R1.1–R1.3、R1.5、R1.6
  - Supabase Google provider、`/login`、`/auth/callback`、`proxy.ts`（Next.js 15 以下為 `middleware.ts`）
  - `initProfileTimezone()` 只在 `timezone is null` 時寫入，並驗證是有效的 IANA 時區
  - 登出按鈕
  - 完成條件：R1 的 AC 全數通過

- [x] **T1.4 App layout 與導覽** — NFR1、NFR2
  - 手機底部分頁列、桌面頂部導覽（單字 / 複習 / 統計），複習與統計先放空頁

- [x] **T1.5 Domain 基礎函式** — R2.2、R2.3、R2.11、R3.1
  - `normalize.ts`、`pos.ts`、`stars.ts`、`dates.ts` 及單元測試

- [x] **T1.6 AI 生成單字** — R2.5–R2.7、R2.10、R2.12、NFR3、NFR6
  - `schemas.ts`、`prompts.ts`、`generateWord.ts`（20 秒逾時、寫入 log）
  - `AI_MOCK` fixtures：`apple`、`run`、`give up`、`aple`、逾時、格式錯誤
  - 完成條件：以 fixtures 測試所有分支

- [x] **T1.7 `addWord` action** — R2.2–R2.8
  - 正規化 → 查重 → AI → `create_word` RPC；併發衝突回傳 `exists`
  - 完成條件：單元或整合測試涵蓋 4 種回傳狀態

- [x] **T1.8 新增單字 UI** — R2.1、R2.4、R2.6、R2.9、R2.10
  - 輸入框、格式錯誤提示、載入狀態、拼字建議（可點擊）、重試
  - `exists` 與 `created` 都以 `?word=<id>` 開啟 popup

- [x] **T1.9 單字列表** — R3.1–R3.4、R3.7、R3.8、NFR4
  - 由 URL search params 驅動的資料庫查詢
  - 列表列元件：單字、詞性 tag、星數（含 aria-label）、important
  - 篩選（星數複選、只看 important）、排序（6 種）、空狀態
  - 每頁 100 筆、捲動載入（design D11）
  - 完成條件：R3 的 AC 全數通過；2,000 字假資料下符合 NFR4（`npm run test:perf`）

- [x] **T1.10 Important 切換** — R3.5
  - `setImportant` action + optimistic update；列表與 popup 共用

- [x] **T1.11 單字 popup（檢視）** — R4.1、R4.2、R4.8、R4.9、NFR5
  - 顯示所有欄位、Web Speech 發音（不支援時隱藏）
  - 關閉方式：按鈕、Esc、背景、上一頁；手機全螢幕；focus trap

- [x] **T1.11a 單字以字典標準寫法儲存**（追加需求）— R2.7、design D12
  - `GenerateWordSchema` 加 `headword`、prompt 規則 9、`canonicalText()` + 單元測試
  - fixtures 涵蓋需大寫（`monday`）與 AI 改字（`ran` → `run`）
  - 本地既有資料改為標準寫法
  - 完成條件：R2.7 新增的 AC 通過

- [x] **T1.12 編輯模式** — R4.3、R4.4
  - 表單（Zod 驗證）、新增或移除義項（1–3）、`updateWord` → `update_word_content`（既有義項帶 id）

- [x] **T1.13 重新生成與刪除** — R4.5–R4.7
  - 確認對話框；重新生成失敗時保留原內容
  - 重新生成不改變單字本身（忽略 AI 回傳的 headword）
  - R4.7 AC「Dashboard 的歷史答題數不變」需要 review_logs 與 Dashboard，延到 T3.3 一併驗證；Phase 1 只驗證列表立即移除

- [x] **T1.14 Phase 1 E2E 測試**
  - 登入 → 新增（有效 / 拼錯 / 重複）→ 列表篩選排序 → popup 編輯 → 重新生成 → 刪除

- [x] **T1.15 部署**
  - Vercel + Supabase Cloud、Google OAuth 正式網域設定、環境變數
  - 正式環境關閉 Email provider（本地為了 E2E 測試保持開啟），符合 R1.2
  - 完成條件：正式網址可登入並新增單字

---

## Phase 2 — 複習

- [x] **T2.1 資料庫：複習紀錄與干擾快取** — R6.5、R7.3、R8.6
  - Migration：`review_logs`、`ai_distractors`、索引、RLS（design §4.1、§4.2）
  - `senses` 的 after update trigger：內容欄位變動時刪除該義項的 ai_distractors，只改 position 時保留（design §4.1）
  - `apply_review` RPC：鎖定 word、`question_id` 冪等、box / next_due_on 樂觀鎖（design §4.3、D13）
  - `npm run db:types` 更新型別
  - 完成條件（`tests/db`）：
    - RLS：A 使用者查不到 B 使用者的 review_logs、ai_distractors
    - 同一個 `question_id` 送兩次只有一筆紀錄、words 只更新一次，第二次回傳 `duplicate = true`
    - `p_box_before` 與目前不符 → `40001`，沒有寫入
    - 編輯只改順序 → 快取保留；改 def_zh → 該義項快取刪除；重新生成 → 全部刪除
    - 刪除單字後 review_logs 保留，`word_id` 為 null（R4.7）

- [x] **T2.2 `leitner.ts`** — R7.4
  - `intervalDays`、`applyAnswer`（design §7.3）
  - 完成條件：R7.4 的 5 個 AC 各一個測試；另測 box 0 答對、一般與 important 間隔表的 10 格

- [x] **T2.3 `random.ts` + `selection.ts`** — R5.1
  - `random.ts`：可設定 seed 的 rng、`shuffle`、`pick`，Phase 2 所有隨機行為共用
  - `orderSessionCandidates` 回傳完整序列（design §7.4）
  - 完成條件：到期的字在前且依 next_due_on 舊→新；同日期順序由 rng 決定，固定 seed 可重現；未到期依 box 低→高、next_due_on 近→遠；不重複

- [x] **T2.4 `questions.ts`** — R6.1–R6.4
  - `availableTypes`、`buildQuestion`、`filterDistractors`（design §7.5）
  - 完成條件：
    - 沒有同義詞的義項不出 `word_to_synonym`（R7 AC）
    - design §7.5 表格的每條排除規則各一個測試；比較時 trim 加不分大小寫
    - 同詞性候選優先
    - 候選不足時回傳 `needsAi`，含缺幾個與已找到的部分候選
    - 4 個選項的順序由 rng 決定

- [x] **T2.5 AI 干擾選項** — R6.5、R6.6、R2.12
  - `DistractorsSchema`、prompt、`generateDistractors.ts`（20 秒逾時、log kind = `distractors`）（design §5.3、§5.4）
  - `lib/review/distractors.ts`：快取 → AI → R6.4 過濾 → 寫入快取（design §5.3）
  - mock 依 request name 分派；`mock distractor fail` 觸發失敗
  - 完成條件：
    - unit：成功、逾時、格式錯誤、過濾後不足 3 個（皆視為失敗）
    - db：快取命中時不呼叫 AI；快取過濾後不足時重新呼叫並覆寫；失敗不寫入快取

- [x] **T2.6 `startReviewSession`** — R5、R6
  - `lib/review/startSession.ts` + action（design §6 流程）
  - 需要 AI 的題目平行處理（D14）；R6.6 換題型、略過並遞補
  - 題目不含正確答案（D15）
  - 完成條件（db 測試，mock AI）：
    - 沒有單字 → 空陣列
    - 2 個字 → 2 題，干擾選項由 AI 補足（R7 AC）
    - `mock distractor fail` 的字被略過並由下一個字遞補
    - 每題 4 個不重複選項，`questionId` 皆不同
    - 2,000 字、不需 AI 時 1 秒內完成

- [x] **T2.7 `submitAnswer` 與 `countDueWords`** — R7.3、R7.4、R8.6
  - `lib/review/submitAnswer.ts` + action（design §6 流程）
  - 完成條件（db 測試）：
    - R7.4 的 5 個 AC 經由 action 驗證
    - 重複送出只計一次，回傳相同結果（R7.3）
    - `local_date` 依 profile 時區計算
    - 選項不含正確答案、`selected` 不在選項中、他人的字 → `ok: false`，不寫入
    - 作答期間義項被重新生成 → `ok: false`，不寫入

- [x] **T2.8 複習 UI** — R7.1、R7.2、NFR1、NFR5
  - `ReviewIntro`：今天到期數、開始按鈕；出題中顯示載入狀態，失敗時 toast 加重試
  - `QuestionCard`：進度（3 / 8）、題目與詞性、4 個選項；作答後鎖定、綠 / 紅標示、「下一題」
  - 等待判定時鎖定選項；submitAnswer 失敗時 toast，並可重送同一個 `questionId`
  - 鍵盤：Tab 加 Enter 或數字鍵 1–4 作答；結果以 `aria-live` 宣告，不只靠顏色區分

- [x] **T2.9 結算畫面** — R7.5
  - 答對題數、每個字的對錯與星數變化（boxBefore → boxAfter）
  - 「再來一輪」、「回單字列表」；`countDueWords() = 0` 時顯示「今天到期的字都複習完了」

- [x] **T2.10 空狀態與 Phase 2 E2E** — R5.2、R7 AC
  - 沒有單字時顯示空狀態與「去新增單字」
  - E2E（`AI_MOCK=1`）：
    - 只有 2 個字也能完成一輪
    - 答對與答錯後，列表的星數正確變化
    - 作答 3 題後離開頁面，資料庫有 3 筆 review_logs（R7 AC）
    - 結算畫面的題數與星數變化正確；「再來一輪」可開始新的一輪

- [x] **T2.11 Phase 2 部署**
  - `supabase db push` 推送 T2.1 的 migration，Vercel 重新部署
  - 完成條件：正式網址可完成一輪複習

- [x] **T2.12 答錯歸零**（追加需求）— R7.4、design D16
  - `applyAnswer` 答錯時 box 設為 0（原為 1）
  - 更新 unit、db、E2E 測試中答錯的預期結果
  - 完成條件：R7.4 修改後的 AC 通過；新字答錯後仍為 0 星

---

## Phase 3 — Dashboard 與 PWA（初稿，進入時細化）

- [ ] **T3.1** Dashboard 查詢：總數、星數分布、每日答題數（最近 53 週）— R8.1、R8.2、R8.6
- [ ] **T3.2** 總單字數與星數分布長條圖 — R8.1、R8.2
- [ ] **T3.3** `heatmap.ts` + 單元測試；熱力圖元件與 tooltip — R8.3–R8.5
  - 補驗 R4.7 AC：刪除單字後 Dashboard 歷史答題數與熱力圖不變
- [ ] **T3.4** Manifest、圖示、service worker（只快取靜態資源）、離線頁 — R9.1、R9.2
- [ ] **T3.5** Android 與 iOS 安裝實機測試 — R9 AC
