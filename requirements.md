# 英文單字記憶 App — Requirements

> 版本：v0.2（2026-10-21）
> v0.2 變更：R2.7 新增單字以字典標準寫法儲存（含 AC）；R4.5 註明單字本身不變。
> 格式：需求採 EARS 語法（WHEN / IF / WHILE … THE SYSTEM SHALL …），每節附驗收條件（AC）。
> 階段：Phase 1 單字管理 → Phase 2 複習 → Phase 3 Dashboard 與 PWA。

---

## 0. 概述

使用者輸入英文單字或片語，系統以 AI 生成英文解釋、中文解釋、同義詞、反義詞、例句與音標；使用者透過選擇題複習，系統以 Leitner 盒子演算法計算熟悉度並安排複習時間。

### 0.1 名詞定義

| 名詞 | 定義 |
|---|---|
| Word（單字） | 使用者新增的一個英文單字或片語，屬於單一使用者 |
| Sense（義項） | 單字的一個意思，含詞性、英解、中解、同義詞、反義詞、例句；每個單字 1–3 個 |
| Box | Leitner 盒子等級，整數 0–5；**熟悉度星數 = Box** |
| 到期 (due) | `next_due_on` ≤ 使用者當地的今天 |
| 複習輪 (session) | 一次複習，最多 8 題 |
| 當地日期 (local date) | 依使用者 profile 時區、以午夜換日所得的日期 |

### 0.2 不在範圍內（Out of scope）

離線使用、批次新增、Google 以外的登入方式、AI 使用量限制（僅預留紀錄）、克漏字題型、OpenAI TTS、分享與匯入匯出、時區設定頁。

---

## Phase 1 — 帳號與單字管理

### R1 帳號

- **R1.1** WHEN 未登入的使用者造訪任何應用頁面，THE SYSTEM SHALL 導向登入頁。
- **R1.2** THE SYSTEM SHALL 在登入頁提供「使用 Google 登入」，且只提供這種登入方式。
- **R1.3** WHEN 使用者第一次登入，THE SYSTEM SHALL 建立 profile，並以瀏覽器回報的 IANA 時區作為 `timezone`。
- **R1.4** THE SYSTEM SHALL 確保使用者只能讀取與修改自己的資料（資料庫層 Row Level Security）。
- **R1.5** THE SYSTEM SHALL 提供登出功能；WHEN 登出完成，THE SYSTEM SHALL 導向登入頁。
- **R1.6** WHEN 已登入使用者造訪登入頁或根路徑 `/`，THE SYSTEM SHALL 導向單字列表頁。

**AC**
- [ ] 未登入直接開 `/words`、`/review`、`/dashboard` 都會被導到 `/login`。
- [ ] A 使用者無法以任何 API 或 Supabase client 查詢到 B 使用者的 words。
- [ ] 首次登入後 `profiles.timezone` 等於瀏覽器時區（例：`America/Boise`）。

### R2 新增單字

- **R2.1** THE SYSTEM SHALL 在單字列表頁頂端提供輸入框，一次新增一個單字或片語。
- **R2.2** THE SYSTEM SHALL 在送出前正規化輸入：去除前後空白、連續空白合併為一個。
- **R2.3** IF 正規化後的輸入不符合「1–64 字元，以英文字母開頭，只包含英文字母、空白、連字號 `-`、撇號 `'`」，THE SYSTEM SHALL 不送出，並顯示格式錯誤訊息。
- **R2.4** WHEN 使用者送出的字與自己已有的單字相同（不分大小寫），THE SYSTEM SHALL 不呼叫 AI，直接開啟該單字的 popup，並顯示「這個字已經在你的列表裡」。
- **R2.5** WHEN 使用者送出新字，THE SYSTEM SHALL 呼叫 AI 驗證並生成內容。
- **R2.6** IF AI 判定輸入不是有效的英文單字或片語，THE SYSTEM SHALL 不儲存，顯示「找不到這個字」，並列出最多 3 個拼字建議；WHEN 使用者點選建議，THE SYSTEM SHALL 以該建議重新送出（仍適用 R2.4）。
- **R2.7** WHEN AI 判定有效，THE SYSTEM SHALL 儲存：
  - 單字本身，以字典標準寫法（headword）儲存：一般為小寫；英文本身需要大寫的保留大寫（星期、月份、語言、國籍、代名詞 I、縮寫如 DNA）。IF AI 回傳的寫法與輸入不只是大小寫不同（例如改成原形），THE SYSTEM SHALL 改以輸入的全小寫儲存
  - 音標 IPA（美式，可為空）
  - 1–3 個義項，依常用程度排序，每個義項包含：
    - 詞性（見 R2.11）
    - 英文解釋（給學習者的簡明定義）
    - 中文解釋（繁體中文、台灣用語）
    - 同義詞 0–5 個、反義詞 0–5 個（皆對應該義項）
    - 例句 1–2 句
- **R2.8** WHEN 單字儲存成功，THE SYSTEM SHALL 設定 `box = 0`、`next_due_on = 當地今天`、`is_important = false`，並開啟該單字的 popup。
- **R2.9** WHILE AI 生成中，THE SYSTEM SHALL 顯示載入狀態，並停用送出按鈕。
- **R2.10** IF AI 呼叫失敗、逾時（20 秒）或回傳格式不符，THE SYSTEM SHALL 不儲存任何資料，顯示錯誤訊息，並提供「重試」。
- **R2.11** 詞性 SHALL 為以下其中之一，並以縮寫顯示：
  `noun (n.)`、`verb (v.)`、`adjective (adj.)`、`adverb (adv.)`、`pronoun (pron.)`、`preposition (prep.)`、`conjunction (conj.)`、`interjection (interj.)`、`determiner (det.)`、`phrase (phr.)`
- **R2.12** THE SYSTEM SHOULD 記錄每次 AI 呼叫（使用者、類型、成功與否、時間），供日後實作用量限制。

**AC**
- [ ] 輸入 `  Give   up ` 會以 `Give up` 處理。
- [ ] 已有 `apple` 時輸入 `Apple`：不呼叫 AI，直接開啟 `apple` 的 popup。
- [ ] 輸入 `aple`：不儲存，顯示含 `apple` 的建議；點擊後成功新增 `apple`。
- [ ] 輸入 `run`：儲存 1–3 個義項，詞性 tag 至少包含 `v.`。
- [ ] 輸入 `Conventional` 存為 `conventional`、`GIVE UP` 存為 `give up`；輸入 `monday` 存為 `Monday`、`dna` 存為 `DNA`。
- [ ] 模擬 AI 逾時：資料庫沒有新增任何 word 或 sense。

### R3 單字列表頁

- **R3.1** THE SYSTEM SHALL 列出使用者所有單字，每列顯示：單字、詞性 tag（各義項詞性去除重複，依義項順序）、熟悉度星數（5 顆星，實心數 = box，唯讀）、important 標記。
- **R3.2** THE SYSTEM SHALL 提供篩選：
  - 星數（可複選 0–5）
  - 只看 important
- **R3.3** THE SYSTEM SHALL 提供排序：
  - 新增日期（新→舊，**預設**；舊→新）
  - 字母（A→Z；Z→A，不分大小寫）
  - 星數（低→高；高→低，同星數時依新增日期新→舊）
- **R3.4** THE SYSTEM SHALL 將篩選與排序狀態反映在 URL query string，重新整理後保留。
- **R3.5** WHEN 使用者點擊列表中的 important 標記，THE SYSTEM SHALL 切換該單字的 important 狀態，且不開啟 popup。
- **R3.6** WHEN 使用者點擊單字列的其他區域，THE SYSTEM SHALL 開啟該單字的 popup。
- **R3.7** IF 使用者還沒有任何單字，THE SYSTEM SHALL 顯示空狀態與新增引導。
- **R3.8** IF 篩選後沒有結果，THE SYSTEM SHALL 顯示「沒有符合條件的單字」，並提供清除篩選。

**AC**
- [ ] box 為 3 的字顯示 3 顆實心星、2 顆空心星。
- [ ] 篩選「0 星 + 1 星」與「只看 important」可同時生效。
- [ ] 選擇「字母 A→Z」後重新整理，排序仍保留。

### R4 單字 popup

- **R4.1** THE SYSTEM SHALL 在 popup 中顯示：單字、IPA、發音按鈕、星數、important 切換，以及每個義項的詞性、英解、中解、同義詞、反義詞、例句。
- **R4.2** WHEN 使用者點擊發音按鈕，THE SYSTEM SHALL 以瀏覽器語音合成（en-US）朗讀單字；IF 瀏覽器不支援語音合成，THE SYSTEM SHALL 隱藏發音按鈕。
- **R4.3** THE SYSTEM SHALL 提供編輯模式，可修改 IPA 及各義項的所有欄位，並可新增或移除義項（維持 1–3 個）；單字本身不可修改。
- **R4.4** IF 編輯內容不合規則（英解或中解為空、同義詞或反義詞超過 5 個、例句超過 2 句、義項數不在 1–3），THE SYSTEM SHALL 阻止儲存並標示錯誤欄位。
- **R4.5** WHEN 使用者選擇「重新生成」並確認，THE SYSTEM SHALL 以 AI 重新生成 IPA 與所有義項並取代舊內容，同時保留 box、next_due_on、is_important 與複習紀錄；單字本身不變（R4.3）。
- **R4.6** IF 重新生成失敗，THE SYSTEM SHALL 保留原內容並顯示錯誤。
- **R4.7** WHEN 使用者選擇「刪除」並確認，THE SYSTEM SHALL 刪除該單字與其義項、關閉 popup，並從列表移除；複習紀錄保留，以維持 Dashboard 的歷史數據。
- **R4.8** THE SYSTEM SHALL 允許以關閉按鈕、Esc 鍵、點擊背景、瀏覽器「上一頁」關閉 popup；手機寬度下 popup 以全螢幕顯示。
- **R4.9** WHILE popup 開啟，THE SYSTEM SHALL 在 URL 中保留單字識別碼，使重新整理後 popup 仍開啟。

**AC**
- [ ] 編輯並儲存同義詞後重新開啟，顯示新內容。
- [ ] 重新生成後 box 與 important 不變。
- [ ] 刪除後列表立即移除該字，Dashboard 的歷史答題數不變。
- [ ] 手機寬度（375px）下 popup 為全螢幕且可捲動。

---

## Phase 2 — 複習

### R5 選字

- **R5.1** WHEN 使用者開始一輪複習，THE SYSTEM SHALL 選出最多 8 個不重複的單字：
  1. 先選到期的字，依 `next_due_on` 由舊到新排序，同日期隨機；
  2. IF 到期的字不足 8 個，THE SYSTEM SHALL 以未到期的字補足，依 box 由低到高、再依 `next_due_on` 由近到遠排序；
  3. IF 單字總數少於 8 個，THE SYSTEM SHALL 使用全部單字。
- **R5.2** IF 使用者沒有任何單字，THE SYSTEM SHALL 顯示空狀態，並引導使用者去新增單字。

### R6 題目

- **R6.1** THE SYSTEM SHALL 對每個選出的字隨機選一個義項，再從該義項可用的題型中隨機選一種：

  | 題型 | 題目 | 正確選項 | 條件 |
  |---|---|---|---|
  | `word_to_zh` | 單字（加詞性） | 該義項的中文解釋 | 永遠可用 |
  | `word_to_synonym` | 單字（加詞性） | 該義項其中一個同義詞 | 該義項至少有 1 個同義詞 |
  | `zh_to_word` | 中文解釋（加詞性） | 單字 | 永遠可用 |

- **R6.2** THE SYSTEM SHALL 為每題提供 4 個選項（1 個正確、3 個干擾），以隨機順序顯示。
- **R6.3** THE SYSTEM SHALL 優先從使用者自己的字庫取干擾選項，且 SHOULD 優先選擇與題目同詞性的候選。
- **R6.4** THE SYSTEM SHALL 確保干擾選項：彼此不重複、不等於正確選項（不分大小寫）、不是題目單字本身、不是題目單字任一義項的同義詞；`zh_to_word` 的干擾單字不得有與題目相同的中文解釋。
- **R6.5** IF 字庫中符合 R6.4 的候選少於 3 個，THE SYSTEM SHALL 以 AI 生成不足的干擾選項並快取；之後同一義項、同一題型重複使用快取。WHEN 該義項被編輯或重新生成，THE SYSTEM SHALL 讓快取失效。
- **R6.6** IF 某題的 AI 干擾選項生成失敗，THE SYSTEM SHALL 改用該字的其他題型；IF 所有題型都無法出題，THE SYSTEM SHALL 略過該字並依 R5.1 遞補。

### R7 作答與熟悉度

- **R7.1** THE SYSTEM SHALL 一次顯示一題，並顯示進度（例：3 / 8）。
- **R7.2** WHEN 使用者選擇一個選項，THE SYSTEM SHALL 鎖定該題、以綠色標示正確選項；IF 選錯，同時以紅色標示使用者的選項；接著顯示「下一題」按鈕。
- **R7.3** WHEN 使用者作答，THE SYSTEM SHALL 立即在伺服器端判定對錯、儲存複習紀錄並更新熟悉度（中途離開也保留已作答的結果）；同一題重複送出 SHALL 只計一次。
- **R7.4** 熟悉度更新規則（今天 = 當地今天）：

  | 情況 | box | next_due_on |
  |---|---|---|
  | 答錯 | 設為 1 | 今天 + 1 天 |
  | 答對且該字到期 | `min(box + 1, 5)` | 今天 + 間隔(新 box) |
  | 答對但該字未到期（補位字） | 不變 | 不變 |

  間隔（天）：

  | Box | 1 | 2 | 3 | 4 | 5 |
  |---|---|---|---|---|---|
  | 一般 | 1 | 2 | 4 | 8 | 16 |
  | Important | 1 | 1 | 2 | 4 | 8 |

  （Important 間隔 = `max(1, ceil(一般間隔 / 2))`；切換 important 不會改變已排定的 `next_due_on`，在下次答題時才套用新的間隔。）

- **R7.5** WHEN 一輪的所有題目作答完畢，THE SYSTEM SHALL 顯示結算：答對題數、每個字的對錯與星數變化，以及「再來一輪」和「回單字列表」按鈕；IF 已沒有到期的字，THE SYSTEM SHALL 顯示「今天到期的字都複習完了」。

**AC**
- [ ] box 2、到期、一般字答對 → box 3，next_due_on = 今天 + 4。
- [ ] box 2、到期、important 答對 → box 3，next_due_on = 今天 + 2。
- [ ] box 5、到期答對 → box 5，next_due_on = 今天 + 16。
- [ ] box 4 答錯 → box 1，next_due_on = 明天。
- [ ] 未到期的補位字答對 → box 與 next_due_on 都不變。
- [ ] 沒有同義詞的義項不會出現 `word_to_synonym` 題。
- [ ] 字庫只有 2 個字時仍可完成一輪（干擾選項由 AI 補足）。
- [ ] 作答到第 4 題時關閉頁面，前 3 題已寫入紀錄。

---

## Phase 3 — Dashboard 與 PWA

### R8 Dashboard

- **R8.1** THE SYSTEM SHALL 顯示使用者的總單字數。
- **R8.2** THE SYSTEM SHALL 以長條圖顯示 0–5 星各有幾個字。
- **R8.3** THE SYSTEM SHALL 顯示 GitHub 風格的熱力圖，涵蓋最近 53 週（含本週），每欄一週、每列一天（週日在最上方），每格代表該當地日期的答題數。
- **R8.4** THE SYSTEM SHALL 依答題數將熱力圖格子分成 5 種深淺：`0`、`1–8`、`9–16`、`17–32`、`33+`。
- **R8.5** WHEN 使用者將游標移到格子上（或在手機上點擊格子），THE SYSTEM SHALL 顯示該日期與答題數。
- **R8.6** THE SYSTEM SHALL 以作答當下的使用者時區計算每筆複習紀錄的當地日期，並以午夜換日。

**AC**
- [ ] 今天答 10 題，今天的格子為第 3 級（9–16）。
- [ ] 刪除一個單字後，總單字數減 1，熱力圖不變。

### R9 PWA

- **R9.1** THE SYSTEM SHALL 提供 Web App Manifest（名稱、圖示、主題色、`display: standalone`），讓使用者可安裝到主畫面。
- **R9.2** THE SYSTEM SHALL 只快取靜態資源；IF 裝置離線，THE SYSTEM SHALL 顯示「需要網路連線」頁面。

**AC**
- [ ] Chrome（Android）與 Safari（iOS）可將 app 加入主畫面並以獨立視窗開啟。
- [ ] 開啟飛航模式後重新整理，顯示離線提示頁面。

---

## 非功能需求

- **NFR1 響應式**：支援 360px–1440px 寬度，手機優先；手機以底部分頁列導覽（單字 / 複習 / 統計），桌面以頂部導覽。
- **NFR2 語言**：介面使用繁體中文。
- **NFR3 安全**：OpenAI API key 只存在伺服器端，不得出現在瀏覽器端程式碼中。
- **NFR4 效能**：單字列表在 2,000 個字以內時，篩選與排序應在 300ms 內完成。
- **NFR5 無障礙**：所有操作可用鍵盤完成；星數提供文字替代（例：「熟悉度 3 / 5」）；popup 開啟時鎖定焦點於其中。
- **NFR6 可測試性**：AI 呼叫可透過環境變數切換成假資料模式，供自動化測試使用。
