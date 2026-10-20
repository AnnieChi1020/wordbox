# 英文單字記憶 App — Tasks

> 版本：v0.2（2026-10-20）・對應 `requirements.md` v0.1、`design.md` v0.2
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

- [ ] **T1.5 Domain 基礎函式** — R2.2、R2.3、R2.11、R3.1
  - `normalize.ts`、`pos.ts`、`stars.ts`、`dates.ts` 及單元測試

- [ ] **T1.6 AI 生成單字** — R2.5–R2.7、R2.10、R2.12、NFR3、NFR6
  - `schemas.ts`、`prompts.ts`、`generateWord.ts`（20 秒逾時、寫入 log）
  - `AI_MOCK` fixtures：`apple`、`run`、`give up`、`aple`、逾時、格式錯誤
  - 完成條件：以 fixtures 測試所有分支

- [ ] **T1.7 `addWord` action** — R2.2–R2.8
  - 正規化 → 查重 → AI → `create_word` RPC；併發衝突回傳 `exists`
  - 完成條件：單元或整合測試涵蓋 4 種回傳狀態

- [ ] **T1.8 新增單字 UI** — R2.1、R2.4、R2.6、R2.9、R2.10
  - 輸入框、格式錯誤提示、載入狀態、拼字建議（可點擊）、重試
  - `exists` 與 `created` 都以 `?word=<id>` 開啟 popup

- [ ] **T1.9 單字列表** — R3.1–R3.4、R3.7、R3.8、NFR4
  - 由 URL search params 驅動的資料庫查詢
  - 列表列元件：單字、詞性 tag、星數（含 aria-label）、important
  - 篩選（星數複選、只看 important）、排序（6 種）、空狀態
  - 完成條件：R3 的 AC 全數通過；2,000 字假資料下符合 NFR4

- [ ] **T1.10 Important 切換** — R3.5
  - `setImportant` action + optimistic update；列表與 popup 共用

- [ ] **T1.11 單字 popup（檢視）** — R4.1、R4.2、R4.8、R4.9、NFR5
  - 顯示所有欄位、Web Speech 發音（不支援時隱藏）
  - 關閉方式：按鈕、Esc、背景、上一頁；手機全螢幕；focus trap

- [ ] **T1.12 編輯模式** — R4.3、R4.4
  - 表單（Zod 驗證）、新增或移除義項（1–3）、`updateWord` → `update_word_content`（既有義項帶 id）

- [ ] **T1.13 重新生成與刪除** — R4.5–R4.7
  - 確認對話框；重新生成失敗時保留原內容
  - R4.7 AC「Dashboard 的歷史答題數不變」需要 review_logs 與 Dashboard，延到 T3.3 一併驗證；Phase 1 只驗證列表立即移除

- [ ] **T1.14 Phase 1 E2E 測試**
  - 登入 → 新增（有效 / 拼錯 / 重複）→ 列表篩選排序 → popup 編輯 → 重新生成 → 刪除

- [ ] **T1.15 部署**
  - Vercel + Supabase Cloud、Google OAuth 正式網域設定、環境變數
  - 正式環境關閉 Email provider（本地為了 E2E 測試保持開啟），符合 R1.2
  - 完成條件：正式網址可登入並新增單字

---

## Phase 2 — 複習（初稿，進入時細化）

- [ ] **T2.1** Migration：`review_logs`、`ai_distractors`、RLS、`apply_review` RPC — R7.3
  - `senses` 的 after update trigger：內容欄位有變動時刪除該義項的 ai_distractors（實作 design §4.3 `update_word_content` 的快取失效）
- [ ] **T2.2** `leitner.ts` + 單元測試（R7.4 的 5 個 AC）— R7.4
- [ ] **T2.3** `selection.ts` + 單元測試 — R5.1
- [ ] **T2.4** `questions.ts`：題型選擇、候選過濾、同詞性優先 + 單元測試 — R6.1–R6.4
- [ ] **T2.5** `generateDistractors.ts` + 快取讀寫；編輯只讓有變動的義項快取失效，重新生成全部失效 — R6.5、R6.6
- [ ] **T2.6** `startReviewSession` action（含 R6.6 遞補；每題由伺服器產生 `questionId`）— R5、R6
- [ ] **T2.7** `submitAnswer` action（伺服器端判定、冪等）— R7.3
- [ ] **T2.8** 複習 UI：題目卡、進度、作答回饋 — R7.1、R7.2
- [ ] **T2.9** 結算畫面 — R7.5
- [ ] **T2.10** 空狀態與 Phase 2 E2E 測試 — R5.2、R7 AC

---

## Phase 3 — Dashboard 與 PWA（初稿，進入時細化）

- [ ] **T3.1** Dashboard 查詢：總數、星數分布、每日答題數（最近 53 週）— R8.1、R8.2、R8.6
- [ ] **T3.2** 總單字數與星數分布長條圖 — R8.1、R8.2
- [ ] **T3.3** `heatmap.ts` + 單元測試；熱力圖元件與 tooltip — R8.3–R8.5
  - 補驗 R4.7 AC：刪除單字後 Dashboard 歷史答題數與熱力圖不變
- [ ] **T3.4** Manifest、圖示、service worker（只快取靜態資源）、離線頁 — R9.1、R9.2
- [ ] **T3.5** Android 與 iOS 安裝實機測試 — R9 AC
