-- Dashboard 統計（R8.1、R8.2、R8.6；design §4.3、D17）
-- security invoker：受 RLS 約束，另外明確以 auth.uid() 篩選以使用索引。

create function public.get_dashboard_stats(p_since date)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'total',
      (select count(*) from public.words where user_id = auth.uid()),
    'by_box',
      (select jsonb_agg(coalesce(c.n, 0) order by b.box)
       from generate_series(0, 5) as b(box)
       left join (
         select box, count(*) as n from public.words
         where user_id = auth.uid()
         group by box
       ) c on c.box = b.box),
    'daily',
      coalesce(
        (select jsonb_agg(jsonb_build_object('date', d.local_date, 'count', d.n)
                          order by d.local_date)
         from (
           select local_date, count(*) as n from public.review_logs
           where user_id = auth.uid() and local_date >= p_since
           group by local_date
         ) d),
        '[]'::jsonb)
  )
$$;

revoke execute on function public.get_dashboard_stats(date) from public, anon;
grant execute on function public.get_dashboard_stats(date) to authenticated;
