const {test}=require('node:test');const assert=require('node:assert/strict');const {audit}=require('../assets/cpu-load-tracker.js');
const game={id:'a',week_number:0,team_id:'cpu1',opponent_team_id:'cpu2',status:'scheduled'};
test('flags Week 0, ignores humans and byes, and deduplicates views',()=>{
 const result=audit([game,{...game},{...game,id:'human',team_id:'u'},{...game,id:'bye',is_bye:true}], [{team_id:'u',person_id:'p'}],1);
 assert.equal(result[0].total,1);assert.equal(result[0].missing.length,1);assert.equal(result[1].status,'verify');
});
test('requires final status and both scores, accepts zero, excludes future weeks',()=>{
 let result=audit([{...game,status:'completed',points_for:0,points_against:7},{...game,id:'b',status:'completed',points_for:3,points_against:null},{...game,id:'future',week_number:2}],[],0);
 assert.equal(result[0].loaded,1);assert.equal(result[0].missing.length,1);
 assert.equal(audit([{...game,status:'completed',points_for:0,points_against:7}],[],0)[0].status,'loaded');
});
test('human opponent, cancelled rows, null weeks and reversed perspectives are handled',()=>{
 const result=audit([game,{...game,team_id:'cpu2',opponent_team_id:'cpu1',status:'completed',points_for:7,points_against:0},{...game,id:'x',opponent_person_id:'p'},{...game,id:'y',status:'cancelled'},{...game,id:'z',week_number:null}],[],0);
 assert.equal(result[0].total,1);assert.equal(result[0].status,'loaded');
});
