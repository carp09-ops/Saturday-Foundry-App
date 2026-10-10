const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM}=require('jsdom');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const source=html.match(/<script id="conference-race-v79-runtime">([\s\S]*?)<\/script>/)[1];
function render(records,conf='American'){
 const dom=new JSDOM('<div id="confRaceBoards"></div>',{runScripts:'outside-only'}),w=dom.window;
 const games=[];
 for(const [name,cw,cl,wins,losses] of records){
  for(let i=0;i<wins+losses;i++){
   const won=i<wins,conference=won?i<cw:i-wins<cl;
   games.push({id:name+i,team_id:name,team_name:name,team_conference:conf,opponent_team_id:name+i,opponent_team:name+' opponent '+i,opponent_conference:'Other',is_conference_game:conference,status:'completed',points_for:won?21:7,points_against:won?7:21});
  }
 }
 const state={scheduleGames:games,programs:records.map(([name])=>({team_id:name,team_name:name,conference:conf})),standings:[]};
 w.CDHQ_RUNTIME={getState:()=>state,esc:String,currentWeek:()=>12};w.eval(source);
 const names=[...w.document.querySelectorAll('.conf-row .conf-team strong')].map(e=>e.textContent).filter(n=>records.some(r=>r[0]===n));
 return {dom,names,preview:w.document.querySelector('.conf-champ-preview')?.textContent};
}
test('American Race matches all twelve visible game standings',()=>{
 const records=[['Army',6,0,9,0],['Memphis',6,1,9,1],['UConn',7,1,9,2],['Charlotte',5,1,8,2],['UAB',5,2,8,3],['East Carolina',4,2,5,5],['North Texas',3,3,5,5],['Tulane',3,3,4,6],['Florida Atlantic',3,3,3,7],['Temple',3,4,5,6],['UTSA',2,5,5,6],['South Florida',1,5,1,9]];
 const result=render([...records].reverse());
 try{assert.deepEqual(result.names,records.map(r=>r[0]));assert.match(result.preview,/Army/);assert.match(result.preview,/Memphis/);assert.doesNotMatch(result.preview,/UConn/);}finally{result.dom.window.close();}
});
test('American equal-loss order uses overall percentage rather than total wins',()=>{
 const result=render([['More wins',7,1,10,3],['Higher percentage',6,1,9,1]]);
 try{assert.deepEqual(result.names,['Higher percentage','More wins']);}finally{result.dom.window.close();}
});
test('other conferences retain conference percentage ordering',()=>{
 const result=render([['Memphis',6,1,9,1],['UConn',7,1,9,2]],'ACC');
 try{assert.deepEqual(result.names,['UConn','Memphis']);}finally{result.dom.window.close();}
});
