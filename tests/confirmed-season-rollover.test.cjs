const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {PGlite}=require('@electric-sql/pglite');
const id=n=>'00000000-0000-0000-0000-'+String(n).padStart(12,'0');
const migration=fs.readFileSync(path.join(__dirname,'../docs/atomic-program-rollover.sql'),'utf8');
const choose=(person,team,confirmed=true)=>({person_id:id(person),team_id:id(team),confirmed});
test('WSB coach-confirmed rollover is atomic and preserves history',async t=>{
 const db=new PGlite();t.after(()=>db.close());
 await db.exec([
  'create role anon; create role authenticated; create schema auth; create schema private;',
  "create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('test.uid',true),'')::uuid $$;",
  'create table public.dynasty_members(dynasty_id uuid,user_id uuid,active boolean,role text);',
  "create function private.can_manage_dynasty(d uuid) returns boolean language sql as $$ select exists(select 1 from public.dynasty_members where dynasty_id=d and user_id=auth.uid() and active and role='commissioner') $$;",
  'create table public.teams(id uuid primary key,active boolean default true,selectable boolean default true,conference text);',
  'create table public.seasons(id uuid primary key default gen_random_uuid(),dynasty_id uuid not null,season_number int not null,year int,name text,status text not null,started_at timestamptz,completed_at timestamptz,unique(dynasty_id,season_number));',
  'create table public.season_programs(id uuid primary key default gen_random_uuid(),dynasty_id uuid,season_id uuid references public.seasons(id),team_id uuid references public.teams(id),active boolean default true,conference_override text,unique(season_id,team_id));',
  'create table public.program_memberships(id uuid primary key default gen_random_uuid(),season_program_id uuid references public.season_programs(id),person_id uuid,role text,dynasty_id uuid,season_id uuid,unique(season_program_id,person_id));',
  'create table public.dynasty_settings(dynasty_id uuid primary key,settings jsonb,updated_at timestamptz);'
 ].join('\n'));
 await db.exec(migration);
 await db.query("insert into dynasty_members values($1,$2,true,'commissioner'),($1,$3,true,'member'),($4,$5,true,'commissioner')",[id(1),id(10),id(11),id(2),id(20)]);
 for(let n=101;n<=108;n++)await db.query('insert into teams(id,active,selectable,conference) values($1,$2,$2,$3)',[id(n),n!==108,n===103?'Independent':'SEC']);
 for(const [s,d,num,status] of [[105,1,5,'completed'],[106,1,6,'active'],[203,2,3,'active']])
  await db.query('insert into seasons(id,dynasty_id,season_number,year,name,status) values($1,$2,$3,2031,$4,$5)',[id(s),id(d),num,'Season '+num,status]);
 for(const [sp,d,s,team,conf] of [[301,1,106,101,null],[302,1,106,102,null],[303,1,106,103,'American'],[304,1,106,106,'Big 12'],[305,1,105,101,null],[306,2,203,101,'ACC']])
  await db.query('insert into season_programs(id,dynasty_id,season_id,team_id,active,conference_override) values($1,$2,$3,$4,true,$5)',[id(sp),id(d),id(s),id(team),conf]);
 for(const [sp,person,d,s] of [[301,401,1,106],[302,402,1,106],[303,403,1,106],[305,401,1,105],[306,501,2,203]])
  await db.query("insert into program_memberships(season_program_id,person_id,role,dynasty_id,season_id) values($1,$2,'owner',$3,$4)",[id(sp),id(person),id(d),id(s)]);
 await db.query('insert into dynasty_settings(dynasty_id,settings) values($1,$2)',[id(1),JSON.stringify({active_week:20,keep:'yes'})]);
 const actor=n=>db.query("select set_config('test.uid',$1,false)",[n?id(n):'']);
 const roll=(a,expected=id(106),dyn=id(1))=>db.query('select create_next_season_with_programs($1,$2,2032,$3::jsonb) new_id',[dyn,expected,JSON.stringify(a)]);
 const valid=[choose(401,104),choose(402,105),choose(403,103)];
 const counts=async()=>({
  seasons:(await db.query('select dynasty_id,season_number,status from seasons order by dynasty_id,season_number')).rows,
  memberships:(await db.query('select dynasty_id,season_id,person_id from program_memberships order by dynasty_id,season_id,person_id')).rows
 });
 const isolated=(name,fn)=>t.test(name,async()=>{
  await db.exec('begin');try{await actor(10);await fn()}finally{await db.exec('rollback')}
 });
 await isolated('Corey moves to Florida, Saif moves to West Virginia, third coach stays',async()=>{
  const next=(await roll(valid)).rows[0].new_id;
  const rows=(await db.query('select pm.person_id,sp.team_id from program_memberships pm join season_programs sp on sp.id=pm.season_program_id where pm.season_id=$1 order by pm.person_id',[next])).rows;
  assert.deepEqual(rows,[{person_id:id(401),team_id:id(104)},{person_id:id(402),team_id:id(105)},{person_id:id(403),team_id:id(103)}]);
  const conference=(await db.query('select conference_override from season_programs where season_id=$1 and team_id=$2',[next,id(103)])).rows[0].conference_override;
  assert.equal(conference,'American');
  assert.equal((await db.query('select status from seasons where id=$1',[id(106)])).rows[0].status,'completed');
  assert.equal((await db.query('select status from seasons where id=$1',[id(203)])).rows[0].status,'active');
  assert.equal((await db.query('select count(*)::int n from program_memberships where season_id=$1',[id(106)])).rows[0].n,3);
  const settings=(await db.query('select settings from dynasty_settings where dynasty_id=$1',[id(1)])).rows[0].settings;
  assert.equal(settings.active_week,1);assert.equal(settings.keep,'yes');
  await assert.rejects(roll(valid),/active season changed/i);
 });
 for(const [name,choices,message] of [
  ['missing coach',valid.slice(0,2),/confirm one program/i],
  ['duplicate destination',[choose(401,104),choose(402,104),choose(403,103)],/duplicate/i],
  ['unconfirmed choice',[choose(401,104,false),choose(402,105),choose(403,103)],/explicitly confirm/i],
  ['wrong coach',[choose(401,104),choose(402,105),choose(999,103)],/invalid coach/i],
  ['disabled school',[choose(401,104),choose(402,108),choose(403,103)],/invalid coach/i]
 ])await t.test(name,async()=>{await actor(10);const before=await counts();await assert.rejects(roll(choices),message);assert.deepEqual(await counts(),before)});
 await t.test('regular league member cannot start a season',async()=>{
  await actor(11);const before=await counts();await assert.rejects(roll(valid),/commissioner/i);assert.deepEqual(await counts(),before);
 });
 await t.test('stale season guard blocks an accidental second rollover',async()=>{
  await actor(10);const before=await counts();await assert.rejects(roll(valid,id(105)),/active season changed/i);assert.deepEqual(await counts(),before);
 });
 await t.test('anonymous requests are denied',async()=>{
  await actor(null);const before=await counts();await assert.rejects(roll(valid),/authentication/i);assert.deepEqual(await counts(),before);
 });
});
test('UI explicitly selects active coaches and intercepts legacy rollover',()=>{
 const js=fs.readFileSync(path.join(__dirname,'../assets/graphite/league-tools.js'),'utf8');
 assert.match(js,/String\(c.current_season_id\)===String\(S.season_id\)/);
 assert.match(js,/stopImmediatePropagation/);
 assert.match(js,/\},true\);/);
 assert.match(js,/p_expected_season_id:S.season_id/);
 assert.match(js,/Select Stay or Change for every active coach/);
});
