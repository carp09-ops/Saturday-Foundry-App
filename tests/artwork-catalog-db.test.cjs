const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{PGlite}=require('@electric-sql/pglite');
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
test('artwork catalog exposes only published metadata and reserves publishing to the trusted connection',async()=>{
 const db=new PGlite();try{
  await db.exec(`create role anon;create role authenticated;create schema private;create table public.teams(id uuid primary key);insert into public.teams values('${id(1)}'),('${id(2)}'),('${id(3)}');`);
  await db.exec(fs.readFileSync(__dirname+'/../docs/team-artwork-catalog.sql','utf8'));
  await db.exec(`insert into public.team_artwork_catalog(team_id,image_url,alt_text,published,updated_at) values('${id(1)}','https://art.test/one.webp','Team one',true,'2020-01-01'),('${id(2)}','https://art.test/two.webp','Team two',false,'2020-01-01')`);
  await db.exec('set role authenticated');
  assert.deepEqual((await db.query('select team_id from public.team_artwork_catalog')).rows,[{team_id:id(1)}]);
  for(const sql of [`insert into public.team_artwork_catalog(team_id,image_url,alt_text) values('${id(3)}','https://art.test/three.webp','Team three')`,`update public.team_artwork_catalog set published=false`,`delete from public.team_artwork_catalog`])await assert.rejects(()=>db.exec(sql),/permission denied/);
  await db.exec('reset role;set role anon');await assert.rejects(()=>db.query('select * from public.team_artwork_catalog'),/permission denied/);
  await db.exec('reset role');
  for(const [url,color] of [['http://art.test/a.webp','#112233'],['javascript:alert(1)','#112233'],['https://art.test/a.webp','red']])await assert.rejects(()=>db.query('insert into public.team_artwork_catalog(team_id,image_url,alt_text,accent_color) values($1,$2,$3,$4)',[id(3),url,'Test',color]),/check constraint/);
  await db.exec(`update public.team_artwork_catalog set image_url='https://art.test/one-v2.webp' where team_id='${id(1)}'`);
  assert((await db.query('select updated_at from public.team_artwork_catalog where team_id=$1',[id(1)])).rows[0].updated_at>new Date('2020-01-02'));
  await db.exec(`update public.team_artwork_catalog set published=true where team_id='${id(2)}';set role authenticated`);assert.equal((await db.query('select * from public.team_artwork_catalog')).rows.length,2);
 }finally{await db.close()}
});
