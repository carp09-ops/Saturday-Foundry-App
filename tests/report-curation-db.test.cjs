const assert=require('node:assert/strict'),fs=require('node:fs');
const {test}=require('node:test');const {PGlite}=require('@electric-sql/pglite');
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
test('report editing works without private-schema usage and preserves commissioner authorization',async()=>{
 const db=new PGlite();try{
 await db.exec(`
 create role anon;create role authenticated;create schema auth;create schema private;
 create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
 create table public.seasons(id uuid primary key,dynasty_id uuid);
 insert into public.seasons values('${id(1)}','${id(10)}'),('${id(2)}','${id(20)}');
 create table public.dynasty_members(dynasty_id uuid,user_id uuid,role text,active boolean);
 insert into public.dynasty_members values
 ('${id(10)}','${id(100)}','commissioner',true),
 ('${id(10)}','${id(101)}','member',true),
 ('${id(10)}','${id(103)}','co_commissioner',true),
 ('${id(10)}','${id(104)}','commissioner',false);
 grant usage on schema auth to authenticated;
 grant select on public.seasons,public.dynasty_members to authenticated;
 create function private.is_dynasty_member(d uuid) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.dynasty_members where dynasty_id=d and user_id=auth.uid() and active)$$;
 create function private.can_manage_dynasty(d uuid) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.dynasty_members where dynasty_id=d and user_id=auth.uid() and active and role in ('commissioner','co_commissioner'))$$;
 revoke all on function private.is_dynasty_member(uuid),private.can_manage_dynasty(uuid) from public;
 grant execute on function private.is_dynasty_member(uuid),private.can_manage_dynasty(uuid) to authenticated;
 alter table public.dynasty_members enable row level security;
 create policy members_read on public.dynasty_members for select to authenticated using(private.is_dynasty_member(dynasty_id));
 `);
 await db.exec(fs.readFileSync(__dirname+'/../docs/preview-report-curation.sql','utf8'));
 const actor=async n=>db.exec(`reset role;set role authenticated;select set_config('test.uid','${id(n)}',false)`);
 const action=(action,story,revision,season=id(1))=>db.query('select public.set_preview_report_story($1,7,$2,$3,$4) result',[season,action,story,revision]);
 await actor(100);
 assert.equal((await db.query("select has_schema_privilege('authenticated','private','USAGE') allowed")).rows[0].allowed,false);
 await assert.rejects(()=>db.query('select private.can_manage_dynasty($1)',[id(10)]),/permission denied for schema private/);
 let r=(await action('pin','game:'+id(50),0)).rows[0].result;
 assert.equal(r.revision,2);assert.equal(r.pinned_id,'game:'+id(50));
 await assert.rejects(()=>action('hide','game:'+id(50),0),/changed/);
 r=(await action('hide','game:'+id(50),2)).rows[0].result;
 assert.equal(r.pinned_id,null);assert.deepEqual(r.hidden_ids,['game:'+id(50)]);
 await assert.rejects(()=>action('pin','game:'+id(50),0,id(2)),/Commissioner/);
 await actor(101);
 assert.equal((await db.query('select * from public.preview_report_curation')).rows.length,1);
 await assert.rejects(()=>action('auto',null,3),/Commissioner/);
 assert.equal((await db.query('update public.preview_report_curation set pinned_id=$1 returning *',['game:'+id(51)])).rows.length,0);
 await actor(103);r=(await action('restore','game:'+id(50),3)).rows[0].result;assert.deepEqual(r.hidden_ids,[]);
 for(const n of [102,104]){await actor(n);assert.equal((await db.query('select * from public.preview_report_curation')).rows.length,0);await assert.rejects(()=>action('auto',null,4),/Commissioner/);}
 await db.exec('reset role;set role anon');
 await assert.rejects(()=>db.query('select * from public.preview_report_curation'),/permission denied/);
 await assert.rejects(()=>action('auto',null,4),/permission denied/);
 await db.exec('reset role');
 await db.exec(fs.readFileSync(__dirname+'/../docs/fix-report-curation-permissions.sql','utf8'));
 await actor(100);r=(await action('auto',null,4)).rows[0].result;assert.equal(r.revision,5);
 assert.equal((await db.query("select has_schema_privilege('authenticated','private','USAGE') allowed")).rows[0].allowed,false);
 assert.equal((await db.query("select prosecdef from pg_proc where oid='public.set_preview_report_story(uuid,integer,text,text,integer)'::regprocedure")).rows[0].prosecdef,false);
 }finally{await db.close()}
});
