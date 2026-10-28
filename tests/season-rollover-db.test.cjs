const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');

const id = n => '00000000-0000-0000-0000-' + String(n).padStart(12, '0');
const sql = fs.readFileSync(path.join(__dirname, '../docs/season-rollover.sql'), 'utf8');

test('season rollover preserves conference assignments and existing behavior', async t => {
  const db = new PGlite();
  t.after(() => db.close());
  // Isolated PostgreSQL fixture: no production seasons are advanced by this test.
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth; create schema private;
    create function auth.uid() returns uuid language sql as $$
      select nullif(current_setting('test.uid', true), '')::uuid
    $$;
    create table public.dynasty_members(dynasty_id uuid, user_id uuid, active boolean, role text);
    create function private.can_manage_dynasty(d uuid) returns boolean language sql as $$
      select exists(select 1 from public.dynasty_members
        where dynasty_id=d and user_id=auth.uid() and active and role='commissioner')
    $$;
    create table public.teams(id uuid primary key, conference text);
    create table public.seasons(
      id uuid primary key default gen_random_uuid(), dynasty_id uuid not null,
      season_number integer not null, year integer, name text, status text,
      started_at timestamptz, completed_at timestamptz,
      unique(dynasty_id, season_number)
    );
    create table public.season_programs(
      id uuid primary key default gen_random_uuid(), dynasty_id uuid not null,
      season_id uuid references public.seasons(id), team_id uuid references public.teams(id),
      active boolean not null default true, conference_override text,
      unique(season_id, team_id)
    );
    create table public.program_memberships(
      season_program_id uuid references public.season_programs(id), person_id uuid,
      role text, dynasty_id uuid, season_id uuid references public.seasons(id),
      unique(season_program_id, person_id)
    );
    create table public.dynasty_settings(dynasty_id uuid primary key, settings jsonb, updated_at timestamptz);
    create function public.create_next_season(uuid, integer default null, boolean default true)
      returns uuid language sql as $$select null::uuid$$;
    revoke all on function public.create_next_season(uuid,integer,boolean) from public,anon;
    grant execute on function public.create_next_season(uuid,integer,boolean) to authenticated,service_role;
  `);
  await db.exec(sql);
  await db.query('insert into dynasty_members values ($1,$2,true,\'commissioner\'),($1,$3,true,\'member\'),($4,$5,true,\'commissioner\')',
    [id(1), id(10), id(11), id(2), id(20)]);
  await db.query('insert into teams values ($1,\'Independent\'),($2,\'American\'),($3,\'Big 12\')', [id(100), id(101), id(102)]);
  for (const [season, dynasty, number, status] of [[200,1,2,'completed'],[201,1,3,'active'],[202,2,3,'active']]) {
    await db.query('insert into seasons(id,dynasty_id,season_number,year,name,status) values($1,$2,$3,2028,$4,$5)',
      [id(season), id(dynasty), number, 'Season ' + number, status]);
  }
  for (const [program, dynasty, season, team, active, conference] of [
    [300,1,200,100,true,'Big 12'],
    [301,1,201,100,true,'American'],
    [302,1,201,101,true,null],
    [303,1,201,102,false,'SEC'],
    [304,2,202,100,true,'ACC']
  ]) {
    await db.query('insert into season_programs values($1,$2,$3,$4,$5,$6)',
      [id(program), id(dynasty), id(season), id(team), active, conference]);
    await db.query('insert into program_memberships values($1,$2,\'owner\',$3,$4)',
      [id(program), id(program + 100), id(dynasty), id(season)]);
  }
  await db.query('insert into dynasty_settings values($1,$2,now())',
    [id(1), JSON.stringify({active_week:5, keep_setting:'preserved'})]);
  const actor = n => db.query("select set_config('test.uid',$1,false)", [n ? id(n) : '']);
  const roll = async (carry = true) => (await db.query(
    'select public.create_next_season($1,2029,$2) id', [id(1), carry])).rows[0].id;
  const programs = async season => (await db.query(
    'select team_id,conference_override,active from season_programs where season_id=$1 order by team_id', [season])).rows;
  const isolated = async (name, fn) => t.test(name, async () => {
    await db.exec('begin');
    try { await actor(10); await fn(); } finally { await db.exec('rollback'); }
  });

  await isolated('copies exact overrides and keeps NULL catalog defaults, coach links and league boundaries', async () => {
    const oldPrograms = await programs(id(201));
    const next = await roll();
    assert.deepEqual(await programs(next), [
      {team_id:id(100),conference_override:'American',active:true},
      {team_id:id(101),conference_override:null,active:true}
    ]);
    const effective = (await db.query(`select coalesce(sp.conference_override,t.conference) conference
      from season_programs sp join teams t on t.id=sp.team_id where sp.season_id=$1 order by sp.team_id`, [next])).rows;
    assert.deepEqual(effective, [{conference:'American'}, {conference:'American'}]);
    const members = (await db.query(`select pm.person_id,pm.role,pm.dynasty_id,sp.team_id
      from program_memberships pm join season_programs sp on sp.id=pm.season_program_id
      where pm.season_id=$1 order by sp.team_id`, [next])).rows;
    assert.deepEqual(members, [
      {person_id:id(401),role:'owner',dynasty_id:id(1),team_id:id(100)},
      {person_id:id(402),role:'owner',dynasty_id:id(1),team_id:id(101)}
    ]);
    assert.deepEqual(await programs(id(201)), oldPrograms);
    assert.deepEqual(await programs(id(202)), [{team_id:id(100),conference_override:'ACC',active:true}]);
    assert.equal((await db.query('select status from seasons where id=$1', [id(202)])).rows[0].status, 'active');
  });

  await isolated('continues to complete the old season and preserve unrelated settings', async () => {
    const next = await roll();
    const old = (await db.query('select status,completed_at from seasons where id=$1', [id(201)])).rows[0];
    assert.equal(old.status, 'completed');
    assert.ok(old.completed_at);
    assert.deepEqual((await db.query('select season_number,year,status from seasons where id=$1', [next])).rows[0],
      {season_number:4,year:2029,status:'active'});
    assert.deepEqual((await db.query('select settings from dynasty_settings where dynasty_id=$1', [id(1)])).rows[0].settings,
      {active_week:1,keep_setting:'preserved'});
  });

  await isolated('later rollovers copy the latest assignment instead of stale history', async () => {
    const fourth = await roll();
    await db.query('update season_programs set conference_override=\'ACC\' where season_id=$1 and team_id=$2', [fourth,id(100)]);
    const fifth = await roll();
    assert.equal((await programs(fifth))[0].conference_override, 'ACC');
    assert.equal((await programs(id(201)))[0].conference_override, 'American');
  });

  await isolated('carry-programs false starts without programs or memberships', async () => {
    const next = await roll(false);
    assert.deepEqual(await programs(next), []);
    assert.equal((await db.query('select count(*)::integer n from program_memberships where season_id=$1', [next])).rows[0].n, 0);
    assert.equal((await programs(id(201)))[0].conference_override, 'American');
  });

  await isolated('default arguments still carry active programs', async () => {
    const next = (await db.query('select public.create_next_season($1) id', [id(1)])).rows[0].id;
    assert.equal((await programs(next))[0].conference_override, 'American');
    assert.equal((await db.query('select year from seasons where id=$1', [next])).rows[0].year, null);
  });

  await isolated('a league without a prior season starts empty', async () => {
    await db.query('insert into dynasty_members values($1,$2,true,\'commissioner\')', [id(3),id(10)]);
    const next = (await db.query('select public.create_next_season($1,2030) id', [id(3)])).rows[0].id;
    assert.deepEqual(await programs(next), []);
    assert.equal((await db.query('select season_number from seasons where id=$1', [next])).rows[0].season_number, 1);
  });

  await t.test('authentication and commissioner checks reject unauthorized rollovers without changing seasons', async () => {
    const before = (await db.query('select * from seasons order by id')).rows;
    await actor(null); await assert.rejects(roll(), /Authentication required/);
    await actor(11); await assert.rejects(roll(), /Commissioner access required/);
    await actor(20); await assert.rejects(roll(), /Commissioner access required/);
    assert.deepEqual((await db.query('select * from seasons order by id')).rows, before);
  });

  await t.test('replacing the function preserves its restricted execution grants', async () => {
    for (const [role, expected] of [['anon',false],['authenticated',true],['service_role',true]]) {
      const row = (await db.query("select has_function_privilege($1,'public.create_next_season(uuid,integer,boolean)','execute') allowed", [role])).rows[0];
      assert.equal(row.allowed, expected);
    }
  });
});
