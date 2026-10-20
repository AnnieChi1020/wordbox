-- Phase 1 triggers 與交易性 RPC（design §4.3、§4.4）

-- 輔助函式放在 private schema，不經由 API 公開 ------------------------------

create schema if not exists private;
grant usage on schema private to authenticated;

-- jsonb 字串陣列 → text[]，保留順序；null 視為空陣列
create function private.jsonb_text_array(j jsonb)
returns text[]
language sql immutable
set search_path = ''
as $$
  select coalesce(
    array(select x from jsonb_array_elements_text(coalesce(j, '[]'::jsonb))
            with ordinality as t(x, i) order by i),
    '{}'
  )
$$;

-- 義項數量必須為 1–3（R2.7、R4.4）
create function private.assert_sense_count(p_senses jsonb)
returns void
language plpgsql immutable
set search_path = ''
as $$
begin
  if jsonb_typeof(p_senses) is distinct from 'array'
     or jsonb_array_length(p_senses) not between 1 and 3 then
    raise exception 'senses must be an array of 1 to 3 items'
      using errcode = '22023';
  end if;
end;
$$;

-- 依陣列順序新增義項（position 1..n）
create function private.insert_senses(p_word_id uuid, p_senses jsonb)
returns void
language sql
set search_path = ''
as $$
  insert into public.senses (word_id, position, pos, def_en, def_zh, synonyms, antonyms, examples)
  select p_word_id, t.ord, (t.s->>'pos')::public.part_of_speech, t.s->>'def_en', t.s->>'def_zh',
         private.jsonb_text_array(t.s->'synonyms'),
         private.jsonb_text_array(t.s->'antonyms'),
         private.jsonb_text_array(t.s->'examples')
  from jsonb_array_elements(p_senses) with ordinality as t(s, ord)
$$;

-- 鎖定使用者自己的 word；RLS 下別人的 word 視為不存在
create function private.lock_own_word(p_word_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
begin
  perform 1 from public.words where id = p_word_id for update;
  if not found then
    raise exception 'word not found' using errcode = 'P0002';
  end if;
end;
$$;

grant execute on all functions in schema private to authenticated;

-- profiles：auth.users 新增時建立（design §4.4） ----------------------------

create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;
revoke execute on function private.handle_new_user() from public, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- words.updated_at -----------------------------------------------------------------

create function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger words_touch_updated_at
  before update on public.words
  for each row execute function private.touch_updated_at();

-- create_word（R2.7、R2.8） ----------------------------------------------------
-- 回傳 {"id": uuid, "existed": boolean}；唯一索引衝突時回傳既有的 word（R2.4）

create function public.create_word(p_text text, p_ipa text, p_senses jsonb, p_today date)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  perform private.assert_sense_count(p_senses);

  insert into public.words (user_id, text, ipa, next_due_on)
  values (auth.uid(), p_text, p_ipa, p_today)
  on conflict (user_id, lower(text)) do nothing
  returning id into v_id;

  if v_id is null then
    select id into v_id from public.words
    where user_id = auth.uid() and lower(text) = lower(p_text);
    return jsonb_build_object('id', v_id, 'existed', true);
  end if;

  perform private.insert_senses(v_id, p_senses);
  return jsonb_build_object('id', v_id, 'existed', false);
end;
$$;

-- update_word_content（R4.3；design §4.3、D9） --------------------------------
-- 編輯用。p_senses 依顯示順序排列：帶 id 者原地更新，沒有 id 者新增，不在清單中的刪除。

create function public.update_word_content(p_word_id uuid, p_ipa text, p_senses jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_sense jsonb;
  v_ord int;
  v_keep uuid[];
begin
  perform private.assert_sense_count(p_senses);
  perform private.lock_own_word(p_word_id);

  select coalesce(array_agg((s->>'id')::uuid), '{}') into v_keep
  from jsonb_array_elements(p_senses) as s
  where s->>'id' is not null;

  if cardinality(v_keep) <> (select count(distinct x) from unnest(v_keep) as x) then
    raise exception 'duplicate sense id' using errcode = '22023';
  end if;

  delete from public.senses
  where word_id = p_word_id and id <> all (v_keep);

  for v_sense, v_ord in
    select s, ord from jsonb_array_elements(p_senses) with ordinality as t(s, ord)
  loop
    if v_sense->>'id' is null then
      insert into public.senses (word_id, position, pos, def_en, def_zh, synonyms, antonyms, examples)
      values (p_word_id, v_ord, (v_sense->>'pos')::public.part_of_speech,
              v_sense->>'def_en', v_sense->>'def_zh',
              private.jsonb_text_array(v_sense->'synonyms'),
              private.jsonb_text_array(v_sense->'antonyms'),
              private.jsonb_text_array(v_sense->'examples'));
    else
      update public.senses set
        position = v_ord,
        pos = (v_sense->>'pos')::public.part_of_speech,
        def_en = v_sense->>'def_en',
        def_zh = v_sense->>'def_zh',
        synonyms = private.jsonb_text_array(v_sense->'synonyms'),
        antonyms = private.jsonb_text_array(v_sense->'antonyms'),
        examples = private.jsonb_text_array(v_sense->'examples')
      where id = (v_sense->>'id')::uuid and word_id = p_word_id;
      if not found then
        raise exception 'sense % does not belong to word', v_sense->>'id'
          using errcode = 'P0002';
      end if;
    end if;
  end loop;

  update public.words set ipa = p_ipa where id = p_word_id;
end;
$$;

-- replace_word_content（R4.5） ----------------------------------------------------
-- 重新生成用：整批取代義項；box、next_due_on、is_important 不變。

create function public.replace_word_content(p_word_id uuid, p_ipa text, p_senses jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform private.assert_sense_count(p_senses);
  perform private.lock_own_word(p_word_id);

  delete from public.senses where word_id = p_word_id;
  perform private.insert_senses(p_word_id, p_senses);
  update public.words set ipa = p_ipa where id = p_word_id;
end;
$$;

revoke execute on function
  public.create_word(text, text, jsonb, date),
  public.update_word_content(uuid, text, jsonb),
  public.replace_word_content(uuid, text, jsonb)
  from public, anon;
grant execute on function
  public.create_word(text, text, jsonb, date),
  public.update_word_content(uuid, text, jsonb),
  public.replace_word_content(uuid, text, jsonb)
  to authenticated;
