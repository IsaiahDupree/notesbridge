-- NotesBridge storage schema.
-- A Redis-shaped KV + FIFO-list surface on Supabase Postgres, exposed to the
-- server through PostgREST RPC (called with the service-role key). RLS is on so
-- the anon key can't reach the tables; only the service role (server) can.
--
-- Apply once to your Supabase project (SQL editor or `supabase db push`), then
-- set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY on the server.

create table if not exists notesbridge_kv (
  k text primary key,
  v text not null,
  expires_at timestamptz
);

create table if not exists notesbridge_list (
  id bigserial primary key,
  k text not null,
  v text not null,
  expires_at timestamptz
);

create index if not exists notesbridge_list_k_id on notesbridge_list (k, id);
create index if not exists notesbridge_kv_expires on notesbridge_kv (expires_at) where expires_at is not null;

alter table notesbridge_kv enable row level security;
alter table notesbridge_list enable row level security;

create or replace function nb_get(p_k text) returns text
language sql as $$
  select v from notesbridge_kv where k = p_k and (expires_at is null or expires_at > now());
$$;

create or replace function nb_set(p_k text, p_v text, p_ttl_sec int default null) returns void
language plpgsql as $$
begin
  delete from notesbridge_kv where expires_at is not null and expires_at <= now();
  insert into notesbridge_kv (k, v, expires_at)
  values (p_k, p_v, case when p_ttl_sec is null then null else now() + make_interval(secs => p_ttl_sec) end)
  on conflict (k) do update set v = excluded.v, expires_at = excluded.expires_at;
end $$;

create or replace function nb_del(p_k text) returns void
language plpgsql as $$
begin
  delete from notesbridge_kv where k = p_k;
  delete from notesbridge_list where k = p_k;
end $$;

create or replace function nb_lpush(p_k text, p_v text) returns int
language plpgsql as $$
declare cnt int;
begin
  delete from notesbridge_list where expires_at is not null and expires_at <= now();
  insert into notesbridge_list (k, v) values (p_k, p_v);
  select count(*) into cnt from notesbridge_list where k = p_k;
  return cnt;
end $$;

-- lpush + rpop = FIFO: rpop returns the earliest-pushed surviving item.
create or replace function nb_rpop(p_k text) returns text
language plpgsql as $$
declare out_v text;
begin
  delete from notesbridge_list
  where id = (
    select id from notesbridge_list
    where k = p_k and (expires_at is null or expires_at > now())
    order by id asc
    limit 1
    for update skip locked
  )
  returning v into out_v;
  return out_v;
end $$;

create or replace function nb_expire(p_k text, p_ttl_sec int) returns int
language plpgsql as $$
declare n1 int := 0; n2 int := 0;
begin
  update notesbridge_kv set expires_at = now() + make_interval(secs => p_ttl_sec) where k = p_k;
  get diagnostics n1 = row_count;
  update notesbridge_list set expires_at = now() + make_interval(secs => p_ttl_sec) where k = p_k;
  get diagnostics n2 = row_count;
  return case when n1 + n2 > 0 then 1 else 0 end;
end $$;
