-- Phase 2 schema 與 RPC（design §4.1–§4.3）

-- review_logs（R7.3、R8.6） ---------------------------------------------------------

create table public.review_logs (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  question_id uuid not null unique,                          -- 冪等（R7.3）
  word_id uuid references public.words on delete set null,   -- 刪字保留紀錄（R4.7）
  sense_id uuid references public.senses on delete set null, -- 重新生成保留紀錄（R4.5）
  question_type text not null
    check (question_type in ('word_to_zh','word_to_synonym','zh_to_word')),
  is_correct boolean not null,
  was_due boolean not null,
  box_before smallint not null check (box_before between 0 and 5),
  box_after smallint not null check (box_after between 0 and 5),
  answered_at timestamptz not null default now(),
  local_date date not null                                   -- R8.6
);
create index review_logs_user_date_idx on public.review_logs (user_id, local_date);
-- 刪除單字或義項時 set null 需要以這兩欄查詢
create index review_logs_word_idx on public.review_logs (word_id);
create index review_logs_sense_idx on public.review_logs (sense_id);

-- ai_distractors（R6.5） ------------------------------------------------------------

create table public.ai_distractors (
  sense_id uuid not null references public.senses on delete cascade,
  question_type text not null
    check (question_type in ('word_to_zh','word_to_synonym','zh_to_word')),
  options text[] not null check (cardinality(options) = 3),
  created_at timestamptz not null default now(),
  primary key (sense_id, question_type)
);

-- 權限與 RLS（R1.4） ----------------------------------------------------------------

revoke all on public.review_logs, public.ai_distractors from anon, authenticated;
grant select, insert on public.review_logs to authenticated;
grant select, insert, update, delete on public.ai_distractors to authenticated;

alter table public.review_logs enable row level security;
create policy own on public.review_logs
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

alter table public.ai_distractors enable row level security;
create policy own on public.ai_distractors
  using (exists (
    select 1 from public.senses s join public.words w on w.id = s.word_id
    where s.id = sense_id and w.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.senses s join public.words w on w.id = s.word_id
    where s.id = sense_id and w.user_id = (select auth.uid())
  ));

-- 義項內容變動時讓干擾快取失效（R6.5、D9） -------------------------------------------
-- update_word_content 會更新清單中的每個義項；只改 position 的不算變動。

create function private.invalidate_sense_distractors()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  delete from public.ai_distractors where sense_id = new.id;
  return null;
end;
$$;

create trigger senses_invalidate_distractors
  after update on public.senses
  for each row
  when ((old.pos, old.def_en, old.def_zh, old.synonyms, old.antonyms, old.examples)
        is distinct from
        (new.pos, new.def_en, new.def_zh, new.synonyms, new.antonyms, new.examples))
  execute function private.invalidate_sense_distractors();

grant execute on function private.invalidate_sense_distractors() to authenticated;

-- apply_review（R7.3、R7.4；design §4.3、D13） ------------------------------------
-- Leitner 規則由呼叫端計算；這裡只負責原子寫入、冪等與樂觀鎖。

create function public.apply_review(
  p_question_id uuid,
  p_word_id uuid,
  p_sense_id uuid,
  p_question_type text,
  p_is_correct boolean,
  p_was_due boolean,
  p_box_before int,
  p_due_before date,
  p_box_after int,
  p_due_after date,
  p_local_date date
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_log public.review_logs;
  v_word public.words;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  -- 重送：回傳第一次的結果（字已被刪除也一樣）
  select * into v_log from public.review_logs where question_id = p_question_id;
  if found then
    return private.review_result(v_log, true);
  end if;

  perform private.lock_own_word(p_word_id);

  -- 同一題併發送出：取得鎖之後再檢查一次
  select * into v_log from public.review_logs where question_id = p_question_id;
  if found then
    return private.review_result(v_log, true);
  end if;

  perform 1 from public.senses where id = p_sense_id and word_id = p_word_id;
  if not found then
    raise exception 'sense does not belong to word' using errcode = 'P0002';
  end if;

  select * into v_word from public.words where id = p_word_id;
  if v_word.box <> p_box_before or v_word.next_due_on <> p_due_before then
    raise exception 'word review state changed' using errcode = '40001';
  end if;

  insert into public.review_logs (
    question_id, word_id, sense_id, question_type, is_correct, was_due,
    box_before, box_after, local_date
  ) values (
    p_question_id, p_word_id, p_sense_id, p_question_type, p_is_correct, p_was_due,
    p_box_before, p_box_after, p_local_date
  )
  returning * into v_log;

  update public.words set box = p_box_after, next_due_on = p_due_after
  where id = p_word_id;

  return private.review_result(v_log, false);
end;
$$;

create function private.review_result(p_log public.review_logs, p_duplicate boolean)
returns jsonb
language sql immutable
set search_path = ''
as $$
  select jsonb_build_object(
    'is_correct', p_log.is_correct,
    'box_before', p_log.box_before,
    'box_after', p_log.box_after,
    'duplicate', p_duplicate
  )
$$;
grant execute on function private.review_result(public.review_logs, boolean) to authenticated;

revoke execute on function public.apply_review(
  uuid, uuid, uuid, text, boolean, boolean, int, date, int, date, date
) from public, anon;
grant execute on function public.apply_review(
  uuid, uuid, uuid, text, boolean, boolean, int, date, int, date, date
) to authenticated;
