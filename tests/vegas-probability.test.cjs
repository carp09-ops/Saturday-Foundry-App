const {test}=require('node:test'),assert=require('node:assert/strict');
const {model}=require('../assets/vegas-probability.js');
test('probability bar stays away-left and home-right for either stored perspective',()=>{
 const home=model({team_name:'Indiana',opponent_team:'Penn State',home_away:'home'},{teamWinProbability:.65});
 const away=model({team_name:'Penn State',opponent_team:'Indiana',home_away:'away'},{teamWinProbability:.35});
 assert.deepEqual(home,away);assert.equal(home.left.pct,35);assert.equal(home.favorite.name,'Indiana');
});
test('missing and invalid probability never fabricates odds; zero is valid',()=>{
 for(const value of [null,undefined,'',NaN,-1,1.1])assert.equal(model({}, {teamWinProbability:value}),null);
 assert.equal(model({home_away:'home'}, {teamWinProbability:0}).right.pct,0);
 assert.equal(model({}, {teamWinProbability:1}).right.pct,100);
});
test('rounding preserves 100 percent and even matchups have no favorite',()=>{
 const data=model({}, {teamWinProbability:.6349});assert.equal(data.left.pct+data.right.pct,100);
 assert.equal(model({}, {teamWinProbability:.5}).favorite,null);
});
