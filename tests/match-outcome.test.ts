import test from 'node:test';
import assert from 'node:assert/strict';
import {rankedOutcome} from '../lib/match-outcome';
test('result sounds distinguish sole winners, tied leaders, losers, forfeits and missing results',()=>{
 const win={rank:1},loss={rank:2};
 assert.equal(rankedOutcome(win,[win,loss]),'win');
 assert.equal(rankedOutcome(win,[win,{rank:1},loss]),'draw');
 assert.equal(rankedOutcome(loss,[win,loss]),'lose');
 assert.equal(rankedOutcome({rank:1,forfeited:true},[win]),'lose');
 assert.equal(rankedOutcome(undefined,[win]),null);
});
