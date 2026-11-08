import assert from 'node:assert/strict';
import test from 'node:test';
import {SEASON_EVENTS} from '../lib/season-calendar';
import {SEASON_CATEGORIES,seasonPreviewItems} from '../constants/season-catalog';
import {AVATAR_CATALOG,COSMETIC_CATALOG} from '../shared/cosmetics';

test('each event has five distinct items in every category and preview keys cannot collide with inventory',()=>{
 const inventory=new Set<string>([...AVATAR_CATALOG,...COSMETIC_CATALOG].map(item=>item.id));
 const all=SEASON_EVENTS.flatMap(event=>{
  const items=seasonPreviewItems(event.id);assert.equal(items.length,30);
  for(const {kind} of SEASON_CATEGORIES){const category=items.filter(item=>item.kind===kind);assert.equal(category.length,5);assert.equal(new Set(category.map(item=>item.name)).size,5);assert.deepEqual(category.map(item=>item.variant),[0,1,2,3,4]);}
  return items;
 });
 assert.equal(all.length,150);assert.equal(new Set(all.map(item=>item.key)).size,150);
 for(const item of all){assert.ok(item.key.startsWith('preview:2027:'));assert.ok(!inventory.has(item.key));}
});
