-- Phase 1 schema（design §4.1、§4.2）

-- profiles ----------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  timezone text,                  -- null = not initialized yet (design §4.4); treated as 'UTC' for date math
  created_at timestamptz not null default now()
);

-- words / senses ------------------------------------------------------------

create type public.part_of_speech as enum (
  'noun','verb','adjective','adverb','pronoun',
  'preposition','conjunction','interjection','determiner','phrase'
);

create table public.words (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  text text not null check (text ~ '^[A-Za-z][A-Za-z '' -]{0,63}$'),  -- R2.3
  ipa text,
  is_important boolean not null default false,
  box smallint not null default 0 check (box between 0 and 5),
  next_due_on date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index words_user_text_uniq on public.words (user_id, lower(text));  -- R2.4
create index words_user_due_idx on public.words (user_id, next_due_on);
create index words_user_created_idx on public.words (user_id, created_at desc);     -- default sort (R3.3)

create table public.senses (
  id uuid primary key default gen_random_uuid(),
  word_id uuid not null references public.words on delete cascade,
  position smallint not null check (position between 1 and 3),
  pos public.part_of_speech not null,
  def_en text not null check (length(def_en) > 0),
  def_zh text not null check (length(def_zh) > 0),
  synonyms text[] not null default '{}' check (cardinality(synonyms) <= 5),
  antonyms text[] not null default '{}' check (cardinality(antonyms) <= 5),
  examples text[] not null default '{}' check (cardinality(examples) <= 2),
  constraint senses_word_position_uniq
    unique (word_id, position) deferrable initially deferred  -- positions are reordered while editing (design §4.3)
);

-- ai_generation_logs（R2.12） ------------------------------------------------

create table public.ai_generation_logs (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  kind text not null check (kind in ('generate','regenerate','distractors')),
  input text not null,
  success boolean not null,
  created_at timestamptz not null default now()
);
create index ai_generation_logs_user_created_idx
  on public.ai_generation_logs (user_id, created_at);

-- Permissions: granted only to signed-in users; RLS limits which rows they see --------------------------

revoke all on public.profiles, public.words, public.senses, public.ai_generation_logs
  from anon, authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.words, public.senses to authenticated;
grant select, insert on public.ai_generation_logs to authenticated;

-- RLS（R1.4） -------------------------------------------------------------------

alter table public.profiles enable row level security;
create policy own on public.profiles
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

alter table public.words enable row level security;
create policy own on public.words
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

alter table public.senses enable row level security;
create policy own on public.senses
  using (exists (
    select 1 from public.words w where w.id = word_id and w.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.words w where w.id = word_id and w.user_id = (select auth.uid())
  ));

alter table public.ai_generation_logs enable row level security;
create policy own on public.ai_generation_logs
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
