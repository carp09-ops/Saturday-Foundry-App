const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

test('the crown belongs to the winning program for the following season in its own league', () => {
  const source = fs.readFileSync('assets/graphite/league.js','utf8');
  const ctx = vm.createContext({logo: () => '<img>', model: {}});
  vm.runInContext(source.slice(source.indexOf('function defendingChampionId'),source.indexOf('function logo(')),ctx);
  const seasons = [ ['other',3,'other3'], ['two',3,'s3'], ['two',4,'s4'], ['two',5,'s5'] ]
    .map(([dynasty_id,season_number,season_id])=>({dynasty_id,season_number,season_id}));
  const finals = [
    {season_id:'other3',team_id:'uconn',opponent_team_id:'usc',points_for:20,points_against:10},
    {season_id:'s3',team_id:'army',opponent_team_id:'miami',points_for:50,points_against:17},
    {season_id:'s4',team_id:'army',opponent_team_id:'miami',points_for:14,points_against:21}
  ];
  assert.equal(ctx.defendingChampionId(seasons,seasons[1],finals),null);
  ctx.model.defendingTeamId = ctx.defendingChampionId(seasons,seasons[2],finals);
  assert.equal(ctx.model.defendingTeamId,'army');
  assert.match(ctx.seasonLogo('army','Army'),/Defending national champion/);
  assert.equal(ctx.seasonLogo('miami','Miami'),'<img>');
  assert.equal(ctx.defendingChampionId(seasons,seasons[3],finals),'miami');
  assert.equal(ctx.defendingChampionId(seasons,seasons[3],finals.slice(0,2)),null);
});
