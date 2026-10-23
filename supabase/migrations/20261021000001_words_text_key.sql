-- R3.3 alphabetical sorting ignores case; PostgREST cannot sort by an expression, so use a generated column.
-- Also used for the R2.4 duplicate check (equality comparisons can use the index).
alter table public.words
  add column text_key text generated always as (lower(text)) stored;

create index words_user_text_key_idx on public.words (user_id, text_key);
create index words_user_box_idx on public.words (user_id, box);  -- star filtering and sorting
