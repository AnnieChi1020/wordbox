# 英文單字記憶 App — Tasks

> 版本：v1.0（2026-10-23）・對應 `requirements.md` v0.5、`design.md` v1.0
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

## Phase 3 — Dashboard 與 PWA

- [x] **T3.1 `heatmap.ts`** — R8.3、R8.4
  - `heatLevel`、`heatmapStart`、`buildHeatmapGrid`（design §7.6）
  - 完成條件：
    - `heatLevel` 邊界：0、1、8、9、16、17、32、33（R8 AC：10 題為第 3 級，即 level 2）
    - 53 欄 × 7 列，第一列為週日，最後一欄包含 today，today 之後的格子為 null
    - today 為週日、週六，以及跨年、跨閏日時格子日期正確
    - 有作答的日期對應到正確的格子與 level

- [x] **T3.2 Dashboard 統計 RPC** — R8.1、R8.2、R8.6
  - Migration：`get_dashboard_stats(p_since)`（design §4.3、D17）
  - `lib/db/stats.ts`；`npm run db:types`
  - 完成條件（`tests/db`）：
    - 總數與 0–5 星分布正確
    - `daily` 依 `local_date` 彙總，只含 `p_since` 之後
    - RLS：不會計入其他使用者的資料
    - 刪除單字後總數減 1、`daily` 不變（R8 AC、R4.7 AC）

- [x] **T3.3 Dashboard 畫面** — R8.1–R8.5、NFR1、NFR5
  - `/dashboard`：`StatTotal`、`StarDistributionChart`、`Heatmap`（design §8.1）
  - 品牌色 CSS 變數（design §8.3）
  - Heatmap：tooltip（hover / 點擊）、roving tabindex 與方向鍵、sr-only 摘要、手機水平捲動並預設顯示最近幾週、深色模式色階
  - 沒有單字時的空狀態
  - 完成條件（E2E）：
    - 總數與星數分布和資料一致
    - 今天答 10 題 → 今天的格子為 level 2，tooltip 顯示日期與題數（R8 AC）
    - 刪除一個單字後總數減 1，熱力圖不變（R8 AC、R4.7 AC）
    - 可用鍵盤移動並讀到每格的日期與題數
    - 360px 寬度沒有頁面水平捲動（只有熱力圖本身可捲動）

- [x] **T3.4 Manifest 與圖示** — R9.1
  - `app/manifest.ts`、`public/icons/*`（192、512、maskable 512）、`app/icon.svg`、`app/apple-icon.png`
  - 圖示依 design §8.3：深藍底、米黃「W」；由 SVG 以 sharp 產生各尺寸 PNG
  - `appleWebApp` metadata、`viewport.themeColor`
  - `npm run test:pwa`：以 production build 執行的 Playwright 設定（同 `test:perf`）
  - 完成條件（`test:pwa`）：`/manifest.webmanifest` 含 R9.1 的欄位；每個圖示都能取得，且實際尺寸與宣告相符

- [x] **T3.5 Service worker 與離線頁** — R9.2
  - `public/sw.js`、`components/pwa/sw-register.tsx`、`app/offline/page.tsx`（design §8.2、D19、D20）
  - `proxy.ts` 放行離線頁與 PWA 檔案；`next.config.ts` 設定 `/sw.js` headers
  - 完成條件（`test:pwa`）：
    - service worker 註冊成功
    - 離線時重新整理 `/words` 顯示「需要網路連線」頁面（R9 AC）
    - 恢復連線後重新整理回到正常頁面
    - 只快取靜態資源：Cache Storage 中沒有頁面 HTML（離線頁除外）與 API 回應

- [x] **T3.6 Phase 3 部署與實機測試** — R9 AC
  - `supabase db push` 推送 T3.2 的 migration，Vercel 重新部署
  - 實機（使用者操作）：Chrome（Android）與 Safari（iOS）加入主畫面、以獨立視窗開啟；開啟飛航模式後重新整理顯示離線頁
  - 完成條件：正式網址的 Dashboard 正確顯示；R9 AC 實機通過
  - 結果（2026-10-22）：iOS Safari 實機通過（加入主畫面、獨立視窗、離線頁）。Android Chrome 未實機測試；安裝條件（manifest、圖示、service worker）由 `test:pwa` 在 Chromium 驗證

- [x] **T3.7 全站品牌配色**（追加需求）— design §8.3、D22
  - `--primary` 改為 brand-900、`--ring` 改為 brand-600；導覽列選取狀態使用主要色
  - 背景維持白色（cream 背景試過後不採用）
  - 星星與答對顏色加深，對比更清楚
  - 完成條件：各頁截圖確認（單字、popup、複習、統計、登入、離線）；既有 E2E 與 `test:pwa` 全數通過

---

## Phase 4 — 深色模式

- [x] **T4.1 外觀切換機制** — R10.1–R10.4
  - 根 layout 的防閃爍 inline script、`suppressHydrationWarning`（design §8.4、D23）
  - `ThemeToggle`：深色模式開關（開 = 深色），放在頂部導覽列登出按鈕旁
  - 完成條件（E2E）：
    - 尚未切換過：系統深色 → 深色；系統淺色 → 淺色
    - 切換後重新整理仍保留，且不再依系統設定；HTML 載入時 `<html>` 的 class 已正確（不閃爍）
    - 登入頁與離線頁套用已儲存的設定
    - 可用鍵盤操作開關

- [x] **T4.2 深色配色** — R10.5
  - `.dark` 變數：主要色、ring、chart-bar（design §8.4、D24）
  - 星星、答對與答錯的深色變體
  - 完成條件：各頁深色截圖確認（單字、popup、編輯、複習、結算、統計、登入、離線）；新增顏色以 dataviz 工具驗證對比；既有 E2E 與 `test:pwa` 全數通過

- [x] **T4.3 部署**
  - Vercel 重新部署（沒有 migration）
  - 完成條件：正式網址在 iOS 的淺色與深色系統設定下都正確顯示
  - 結果（2026-10-22）：iOS Safari 實機通過

---

## Phase 5 — 反義詞題型

- [x] **T5.1 資料庫：題型限制** — R6.1
  - Migration：`review_logs`、`ai_distractors` 的 `question_type` check 加入 `word_to_antonym`（design §4.1）
  - 本地以 `supabase migration up` 套用，不 reset
  - 完成條件（`tests/db`）：`apply_review` 與 `ai_distractors` 可寫入 `word_to_antonym`；其他字串仍被拒絕

- [x] **T5.2 `questions.ts` 反義詞題型** — R6.1、R6.4、R7.3
  - `QuestionSense` 加入 `antonyms`；`availableTypes`、`buildQuestion`、`findCorrectOption` 支援 `word_to_antonym`（design §7.5、D25）
  - 出題與作答判定讀取 `antonyms`（`listReviewWords`、`submitAnswer`）
  - 完成條件：
    - 沒有反義詞的義項不出 `word_to_antonym`（R7 AC）
    - 正確答案是該義項的反義詞之一；候選來自其他單字的反義詞，排除目標字本身與所有義項的同義詞、反義詞
    - `findCorrectOption` 接受反義詞（不分大小寫），多個選項符合時回傳 null
    - db：`submitAnswer` 判定反義詞題

- [x] **T5.3 AI 干擾選項** — R6.5
  - prompt 加入題型說明與反義詞清單（design §5.3）；mock 加入 `distractors_word_to_antonym`
  - 完成條件（unit）：user message 含反義詞清單；request name 為 `distractors_word_to_antonym`

- [x] **T5.4 複習 UI 與 E2E** — R6.1、R7 AC
  - `QuestionCard` 題目敘述：「哪一個是 X 的反義詞？」
  - 完成條件：E2E（`AI_MOCK=1`）可完成含反義詞題的一輪；既有 E2E 通過

- [x] **T5.5 部署**
  - `supabase db push` 推送 T5.1 的 migration，Vercel 重新部署
  - 完成條件：正式網址可出現並作答反義詞題
  - 結果（2026-10-23）：正式網址確認通過
