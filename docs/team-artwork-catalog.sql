-- Shared published editorial artwork; no game, coach or league assignments are changed.
create table public.team_artwork_catalog (
 team_id uuid primary key references public.teams(id) on delete cascade,
 image_url text not null check(length(image_url)<=2048 and image_url ~ '^https://[^[:space:]]+$'),
 alt_text text not null check(length(alt_text) between 1 and 240),
 accent_color text not null default '#303840' check(accent_color ~ '^#[0-9A-Fa-f]{6}$'),
 published boolean not null default false,
 updated_at timestamptz not null default now()
);
alter table public.team_artwork_catalog enable row level security;
revoke all on public.team_artwork_catalog from public,anon,authenticated;
grant select on public.team_artwork_catalog to authenticated;
create policy published_team_art_read on public.team_artwork_catalog for select to authenticated using(published);
-- Catalog writes are administered through the trusted publishing connection, not a browser.
create function private.touch_team_artwork_catalog() returns trigger language plpgsql security invoker set search_path='' as $$
begin new.updated_at=now();return new;end $$;
revoke all on function private.touch_team_artwork_catalog() from public,anon,authenticated;
create trigger team_artwork_catalog_updated before update on public.team_artwork_catalog for each row execute function private.touch_team_artwork_catalog();
