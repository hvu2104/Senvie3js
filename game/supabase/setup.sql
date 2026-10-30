-- Sen Quest leaderboard. Paste the whole file into Supabase > SQL Editor and press Run (safe to run again).
-- The browser only ever calls the 4 functions at the bottom; the table itself is closed to the public.

create table if not exists public.players (
  code          text primary key,                       -- 5 chars, shown as SEN-XXXXX
  nickname      text not null check (char_length(nickname) between 2 and 20),
  school        text not null default '' check (char_length(school) <= 40),
  device_id     text not null,
  referred_by   text references public.players(code),
  credited      boolean not null default false,         -- referral already evaluated for this player
  referrals     int not null default 0,
  best_points   int not null default 0,
  best_time_ms  int,
  games         int not null default 0,
  created_at    timestamptz not null default now()
);
create index if not exists players_device_idx on public.players (device_id);
alter table public.players enable row level security;   -- no policies on purpose: direct reads/writes are refused
revoke all on public.players from anon, authenticated;

-- Game constants. Keep in sync with questions.js (MAX_SCORE, POINTS.referral), backend.js (MIN_TIME_MS) and config.js.
create or replace function public._cfg(k text) returns text language sql immutable as $$
  select case k when 'max_score' then '1300' when 'per_referral' then '5'
                when 'min_time_ms' then '60000'
                when 'referral_credit' then 'finish'   -- 'finish' or 'register'
         end $$;

-- Give the referrer +1 once per referred player, never for self-referral or a second account on the same phone.
create or replace function public._credit(p public.players) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p.referred_by is null or p.credited then return; end if;
  if p.referred_by <> p.code
     and not exists (select 1 from players r where r.code = p.referred_by and r.device_id = p.device_id)
     and not exists (select 1 from players x where x.code <> p.code and x.device_id = p.device_id and x.credited and x.referred_by is not null)
  then
    update players set referrals = referrals + 1 where code = p.referred_by;
  end if;
  update players set credited = true where code = p.code;
end $$;

create or replace function public.get_leaderboard(p_code text) returns json
language sql stable security definer set search_path = public as $$
  with r as (
    select code, nickname, school, best_points, best_time_ms, referrals,
           best_points + _cfg('per_referral')::int * referrals as total,
           row_number() over (order by best_points + _cfg('per_referral')::int * referrals desc, best_time_ms asc nulls last, created_at asc) as rank
    from players
  )
  select json_build_object(
    'top', coalesce((select json_agg(json_build_object('rank', rank, 'nickname', nickname, 'school', school, 'total', total,
                     'best_points', best_points, 'best_time_ms', best_time_ms, 'referrals', referrals) order by rank)
                     from r where rank <= 10), '[]'::json),
    'me', (select json_build_object('rank', rank, 'nickname', nickname, 'school', school, 'total', total,
           'best_points', best_points, 'best_time_ms', best_time_ms, 'referrals', referrals) from r where code = upper(p_code)),
    'players', (select count(*) from r))
$$;

create or replace function public.register_player(p_nickname text, p_school text, p_device text, p_ref text) returns json
language plpgsql security definer set search_path = public as $$
declare
  alph text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code text; v_ref text; v_nick text; v_school text; p players;
begin
  v_nick := btrim(regexp_replace(coalesce(p_nickname, ''), '\s+', ' ', 'g'));
  if char_length(v_nick) < 2 or char_length(v_nick) > 20 then raise exception 'Biệt danh cần từ 2 đến 20 ký tự.'; end if;
  v_school := left(btrim(coalesce(p_school, '')), 40);
  if coalesce(p_device, '') = '' or char_length(p_device) > 64 then raise exception 'Thiếu mã thiết bị.'; end if;
  loop
    v_code := '';
    for i in 1..5 loop v_code := v_code || substr(alph, 1 + floor(random() * 32)::int, 1); end loop;
    exit when not exists (select 1 from players where code = v_code);
  end loop;
  select code into v_ref from players where code = upper(coalesce(p_ref, ''));
  insert into players (code, nickname, school, device_id, referred_by)
    values (v_code, v_nick, v_school, p_device, v_ref) returning * into p;
  if v_ref is not null and _cfg('referral_credit') = 'register' then perform _credit(p); end if;
  return json_build_object('code', v_code, 'nickname', v_nick, 'school', v_school, 'referred_by', v_ref);
end $$;

create or replace function public.get_player(p_code text) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object('code', code, 'nickname', nickname, 'school', school, 'best_points', best_points,
                           'best_time_ms', best_time_ms, 'referrals', referrals)
  from players where code = upper(coalesce(p_code, ''))
$$;

drop function if exists public.submit_result(text, int, int);  -- parameter renamed from p_correct
create or replace function public.submit_result(p_code text, p_score int, p_time_ms int) returns json
language plpgsql security definer set search_path = public as $$
declare p players; v_pts int; v_t int; v_improved boolean;
begin
  select * into p from players where code = upper(coalesce(p_code, '')) for update;
  if not found then raise exception 'Không tìm thấy mã người chơi.'; end if;
  v_pts := greatest(0, least(coalesce(p_score, 0), _cfg('max_score')::int));
  v_t := greatest(coalesce(p_time_ms, 0), _cfg('min_time_ms')::int);
  v_improved := v_pts > p.best_points or (v_pts = p.best_points and (p.best_time_ms is null or v_t < p.best_time_ms));
  update players set
    best_points = case when v_improved then v_pts else best_points end,
    best_time_ms = case when v_improved then v_t else best_time_ms end,
    games = games + 1
  where code = p.code;
  perform _credit(p);
  return ((get_leaderboard(p.code) -> 'me')::jsonb || jsonb_build_object('improved', v_improved))::json;
end $$;

-- Only the 4 game functions are callable from the browser.
revoke execute on function public._credit(public.players) from public, anon, authenticated;
grant execute on function public.register_player(text, text, text, text), public.get_player(text),
                          public.submit_result(text, int, int), public.get_leaderboard(text) to anon;
