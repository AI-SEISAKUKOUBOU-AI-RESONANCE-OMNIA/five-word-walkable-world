import test from 'node:test';
import assert from 'node:assert/strict';
import {TYPES,validateInput,buildWorld,canOccupy,canStand,movementDelta} from './app.mjs';

const words=['橋','森','星','水','塔'];

test('requires exactly five nonempty words, one supported ban, and a 20-character limit',() => {
  assert.equal(validateInput(words,'岩').ok,true);
  assert.equal(validateInput(['あ'.repeat(20),...words.slice(1)],'岩').ok,true);
  assert.equal(validateInput(['あ'.repeat(21),...words.slice(1)],'岩').ok,false);
  assert.equal(validateInput(['',...words.slice(1)],'岩').ok,false);
  assert.equal(validateInput(words.slice(1),'岩').ok,false);
  assert.equal(validateInput(words,'雲').ok,false);
  assert.equal(validateInput(words,'').ok,false);
});

test('builds two rows of four deterministic 3D districts from five words',() => {
  const a=buildWorld(words,'岩');
  const b=buildWorld(words,'岩');
  assert.deepEqual(a,b);
  assert.equal(a.tiles.length,8);
  assert.deepEqual(a.tiles.map(tile => [tile.row,tile.col]),[[0,0],[0,1],[0,2],[0,3],[1,0],[1,1],[1,2],[1,3]]);
  assert.equal(a.map.length,8);
  assert.equal(a.landmark.tile,2);
  for (const tile of a.tiles) {
    assert.ok(TYPES.includes(tile.type));
    assert.ok(tile.height>0);
    assert.ok(Math.abs(tile.objectX-tile.x)>2);
    assert.ok(Math.abs(tile.objectZ-tile.z)>2);
  }
});

test('changing a word changes its districts while leaving unrelated districts stable',() => {
  const before=buildWorld(words,'岩');
  const after=buildWorld(['橋','塔','星','水','塔'],'岩');
  assert.notEqual(before.tiles[1].type,after.tiles[1].type);
  assert.notEqual(before.tiles[6].type,after.tiles[6].type);
  assert.deepEqual(before.tiles[3],after.tiles[3]);
});

test('every supported banned object is excluded from shapes and generated descriptions',() => {
  const terms=[['橋','bridge'],['塔','tower'],['樹','tree'],['岩','rock'],['灯','lamp'],['水','water']];
  const all=['橋','塔','樹','岩','灯'];
  for (const [term,type] of terms) {
    const model=buildWorld(all,term);
    assert.ok(model.tiles.every(tile => tile.type!==type));
    assert.ok(model.tiles.every(tile => !tile.name.includes(term)));
    assert.ok(!model.landmark.title.includes(term));
    assert.ok(!model.landmark.text.includes(term));
  }
});

test('HTML-special characters remain literal text data within the input limit',() => {
  const literal='<b>&</b>';
  assert.ok([...literal].length<=20);
  const model=buildWorld([literal,'森','星','川','塔'],'岩');
  assert.equal(model.tiles[0].label,literal);
  assert.ok(model.tiles[0].name.includes(literal));
  assert.equal(validateInput([literal,'森','星','川','塔'],'岩').ok,true);
});

test('the central corridor and branches reach every district from the spawn',() => {
  assert.equal(canOccupy(-8,0),true);
  for (const x of [-24,-8,8,24]) {
    for (let step=0;step<=18;step++) assert.equal(canOccupy(x,-9+step),true);
    assert.equal(canOccupy(x,-9),true);
    assert.equal(canOccupy(x,9),true);
  }
  for (let step=-31;step<=31;step++) assert.equal(canOccupy(step,0),true);
  assert.equal(canOccupy(100,100),false);
  assert.equal(canOccupy(Number.NaN,0),false);
});

test('walkers can approach a landmark without entering its solid tower',() => {
  const model=buildWorld(['橋','森','塔','水','塔'],'岩');
  const tower=model.tiles[2];
  assert.equal(tower.type,'tower');
  assert.equal(canStand(tower.objectX,tower.objectZ,model.tiles),false);
  assert.equal(canStand(tower.x,0,model.tiles),true);
  assert.equal(canStand(tower.x,-2.5,model.tiles),true);
  for(const x of [-24,-8,8,24])assert.equal(canStand(x,0,model.tiles),true);
});

test('forward and side movement follow the camera view',() => {
  assert.ok(Math.abs(movementDelta(1,0,0,1).dx)<1e-12);
  assert.equal(movementDelta(1,0,0,1).dz,-1);
  assert.ok(Math.abs(movementDelta(1,0,Math.PI/2,1).dx+1)<1e-12);
  assert.ok(Math.abs(movementDelta(0,1,Math.PI/2,1).dz+1)<1e-12);
});
