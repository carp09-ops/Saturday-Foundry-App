const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {PGlite}=require('@electric-sql/pglite');
test('H2H database lifecycle, authorization, duplicate saves and stale-score safety',async t=>{
 const db=new PGlite();t.after(()=>db.close());
 await db.exec(`create role anon;create role authenticated;create schema auth;create schema private;
 create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
 create type public.game_status as enum('scheduled','completed','cancelled');
 create table public.people(id uuid primary key,display_name text);create table public.profiles(id uuid primary key,person_id uuid);
 create table public.dynasty_members(dynasty_id uuid,user_id uuid,active boolean,role text);
 create table public.games(id uuid primary key,dynasty_id uuid,season_id uuid,week_number integer,status public.game_status,is_bye boolean default false,source text,overtime boolean,network text,event_name text,data_quality_flag text,updated_at timestamptz);
 create table public.game_participants(id uuid primary key,game_id uuid references public.games(id),team_id uuid,season_program_id uuid,person_id uuid,side text,score integer,rank integer,result char(1),is_primary boolean);
 create table public.program_memberships(season_program_id uuid,person_id uuid);
 create function private.is_dynasty_member(d uuid) returns boolean language sql as $$select exists(select 1 from public.dynasty_members where dynasty_id=d and user_id=auth.uid() and active)$$;
 create function private.can_manage_dynasty(d uuid) returns boolean language sql as $$select exists(select 1 from public.dynasty_members where dynasty_id=d and user_id=auth.uid() and active and role='commissioner')$$;
 create function private.maybe_auto_advance_active_week(uuid,uuid,integer) returns void language sql as $$select null::void$$;`);
 const id=n=>'00000000-0000-0000-0000-'+String(n).padStart(12,'0');
 for(const [n,name] of [[1,'Corey'],[2,'Pete'],[3,'Commissioner'],[4,'Other']])await db.query('insert into people values($1,$2);',[id(n),name]);
 for(let n=1;n<=4;n++){await db.query('insert into profiles values($1,$2)',[id(10+n),id(n)]);await db.query('insert into dynasty_members values($1,$2,true,$3)',[id(50),id(10+n),n===3?'commissioner':'member']);}
 await db.query('insert into games values($1,$2,$3,0,\'scheduled\',false,null,false,null,null,null,now())',[id(100),id(50),id(60)]);
 for(const n of [1,2]){await db.query('insert into program_memberships values($1,$2)',[id(20+n),id(n)]);await db.query('insert into game_participants values($1,$2,$3,$4,$5,$6,null,null,null,$7)',[id(30+n),id(100),id(40+n),id(20+n),id(n),n===1?'home':'away',n===1]);}
 await db.exec(fs.readFileSync(path.join(__dirname,'../docs/h2h-validation.sql'),'utf8'));
 const actor=async n=>db.query("select set_config('test.uid',$1,false)",[n?id(10+n):'']);
 const submit=(a,b)=>db.query('select * from submit_game_result($1,$2,$3)',[id(100),a,b]);
 const validation=async()=> (await db.query('select * from private.h2h_results')).rows[0];
 const validate=(v,confirm,note=null)=>db.query('select validate_h2h_result($1,$2,$3,$4,$5,$6)',[id(100),v.version,v.home_score,v.away_score,confirm,note]);
 await actor(4);await assert.rejects(submit(28,21),/own team/);
 await actor(1);await submit(28,21);let v=await validation();assert.equal(v.status,'pending');assert.equal(v.submitted_by,id(1));
 await assert.rejects(validate(v,true),/opposing user/);
 await actor(2);await assert.rejects(submit(22,28),/Final already entered/);await submit(21,28);assert.equal((await validation()).status,'pending');
 await assert.rejects(validate({...v,version:0},true),/Score changed/);
 await assert.rejects(validate(v,false,''),/Describe/);
 await validate(v,true);await validate(v,true);assert.equal((await validation()).status,'confirmed');
 await assert.rejects(db.query('update game_participants set score=99 where id=$1',[id(32)]),/commissioner/);
 await actor(3);await db.query('update game_participants set score=22 where id=$1',[id(32)]);v=await validation();assert.equal(v.status,'disputed');assert(v.version>1);
 await actor(2);await assert.rejects(validate({...v,version:1},true),/Score changed/);await assert.rejects(db.query('select resolve_h2h_result($1,$2,28,22,\'Reviewed\')',[id(100),v.version]),/Commissioner required/);
 await actor(3);await db.query('select resolve_h2h_result($1,$2,28,22,\'Screenshot reviewed\')',[id(100),v.version]);v=await validation();assert.equal(v.status,'resolved');assert.equal(v.away_score,22);assert.equal(v.reviewed_by,id(3));
 await actor(null);await assert.rejects(db.query('select get_h2h_results($1,$2)',[id(50),id(60)]),/membership/);
 const privileges=await db.query("select has_function_privilege('anon','public.validate_h2h_result(uuid,integer,integer,integer,boolean,text)','execute') allowed");assert.equal(privileges.rows[0].allowed,false);
 await actor(1);const read=(await db.query('select get_h2h_results($1,$2) data',[id(50),id(60)])).rows[0].data;assert(read.ready);assert.equal(read.results[0].submitted_name,'Corey');
 // New game to exercise a dispute without changing the accepted scoreboard.
 await db.query("insert into games select $1,dynasty_id,season_id,1,'scheduled',false,null,false,null,null,null,now() from games where id=$2",[id(101),id(100)]);
 for(const n of [1,2])await db.query('insert into game_participants select $1,$2,team_id,season_program_id,person_id,side,null,null,null,is_primary from game_participants where id=$3',[id(130+n),id(101),id(30+n)]);
 await db.query('select * from submit_game_result($1,0,7)',[id(101)]);await actor(2);
 const dv=(await db.query('select * from private.h2h_results where game_id=$1',[id(101)])).rows[0];
 await db.query('select validate_h2h_result($1,$2,0,7,false,\'Wrong score\')',[id(101),dv.version]);assert.equal((await db.query('select score from game_participants where id=$1',[id(132)])).rows[0].score,7);
 // Serialized concurrent saves share a single final and create only one ledger.
 await db.query("insert into games select $1,dynasty_id,season_id,2,'scheduled',false,null,false,null,null,null,now() from games where id=$2",[id(102),id(100)]);
 for(const n of [1,2])await db.query('insert into game_participants select $1,$2,team_id,season_program_id,person_id,side,null,null,null,is_primary from game_participants where id=$3',[id(230+n),id(102),id(30+n)]);
 await actor(1);const concurrent=await Promise.allSettled([db.query('select * from submit_game_result($1,35,14)',[id(102)]),db.query('select * from submit_game_result($1,42,14)',[id(102)])]);assert.equal(concurrent.filter(r=>r.status==='fulfilled').length,1);assert.equal((await db.query('select count(*)::integer n from private.h2h_results where game_id=$1',[id(102)])).rows[0].n,1);
});
