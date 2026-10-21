-- R3.3 字母排序不分大小寫；PostgREST 無法以運算式排序，改用 generated column。
-- 也用於 R2.4 查重（等值比對可使用索引）。
alter table public.words
  add column text_key text generated always as (lower(text)) stored;

create index words_user_text_key_idx on public.words (user_id, text_key);
create index words_user_box_idx on public.words (user_id, box);  -- 星數篩選與排序
