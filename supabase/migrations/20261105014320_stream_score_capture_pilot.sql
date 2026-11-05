create table public.stream_score_scan_claims (
 person_id uuid not null references public.people(id), bucket bigint not null,
 stream_url text, frame_hash text, state text not null default 'claimed', primary key(person_id,bucket)
);
alter table public.stream_score_scan_claims enable row level security;
revoke all on public.stream_score_scan_claims from public,anon,authenticated;
grant all on public.stream_score_scan_claims to service_role;
create index stream_score_scan_hash on public.stream_score_scan_claims(person_id,frame_hash);
create table public.stream_score_candidates (
 id uuid primary key default gen_random_uuid(),
 game_id uuid not null references public.games(id), dynasty_id uuid not null references public.dynasties(id),
 season_id uuid not null references public.seasons(id), person_id uuid not null references public.people(id),
 week_number integer not null, home_score integer not null check(home_score between 0 and 250),
 away_score integer not null check(away_score between 0 and 250), overtime boolean,
 evidence text not null, stream_url text not null, image_data text not null check(length(image_data)<=1400000 and image_data like 'data:image/jpeg;base64,%'),
 frame_hash text not null, captured_at timestamptz not null default now(),
 reported_at timestamptz, accepted_at timestamptz, accepted_by uuid,
 check(home_score<>away_score), unique(game_id,home_score,away_score)
);
create index stream_score_candidate_scope on public.stream_score_candidates(dynasty_id,season_id);
alter table public.stream_score_candidates enable row level security;
revoke all on public.stream_score_candidates from public,anon,authenticated;
grant select on public.stream_score_candidates to authenticated;
grant all on public.stream_score_candidates to service_role;
create policy stream_score_member_read on public.stream_score_candidates for select to authenticated
 using(private.is_dynasty_member(dynasty_id));
