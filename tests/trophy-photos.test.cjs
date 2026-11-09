const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

test('Trophy Case selects the specific photographed honor and never substitutes another trophy', () => {
  const context = vm.createContext({esc: String, uid: String, $: () => ({addEventListener() {}}), window: {addEventListener() {}}});
  vm.runInContext(fs.readFileSync('assets/graphite/league.js', 'utf8'), context);
  const cases = [
    ['National Championship', 'national_championship', 'cfp'],
    ['Heisman Trophy', 'heisman', 'heisman'],
    ['C-USA Championship', 'conference_championship', 'cusa'],
    ['Conference USA Championship', 'conference_championship', 'cusa'],
    ['Roof Claim Boca Raton Bowl', 'bowl_championship', 'boca-raton'],
    ['Edge Rusher of the Year', 'player_award', null],
    ['Bowl Game', 'bowl_championship', null]
  ];
  for (const [name, type, photo] of cases) {
    const honor = {name, type, id: 'example', season_number: 3};
    assert.equal(context.trophyPhoto(honor), photo);
    const card = context.trophyGrid([honor]);
    assert.ok(card.includes(name));
    if (photo) assert.ok(card.includes('assets/trophy-photos/' + photo + '.webp'));
    else assert.doesNotMatch(card, /<img/);
  }
  const sources = JSON.parse(fs.readFileSync('assets/trophy-photos/sources.json'));
  for (const id of vm.runInContext('Object.keys(TROPHY_PHOTOS)', context)) {
    assert.ok(sources[id].sourcePage && sources[id].sourceImage, id);
    const image = fs.readFileSync('assets/trophy-photos/' + id + '.webp');
    assert.equal(image.toString('ascii', 8, 12), 'WEBP', id);
  }
});
