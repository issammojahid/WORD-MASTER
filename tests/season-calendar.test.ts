import assert from 'node:assert/strict';
import test from 'node:test';
import {SEASON_EVENTS,eventPhase,initialSeasonIndex} from '../lib/season-calendar';

test('season windows have no gaps or overlaps, including the year change',()=>{
 for(let i=0;i<SEASON_EVENTS.length;i++){
  const event=SEASON_EVENTS[i],start=Date.parse(event.start),end=Date.parse(event.end);
  assert.ok(start<end);
  assert.equal(eventPhase(event,start-1),'upcoming');
  assert.equal(eventPhase(event,start),'active');
  assert.equal(eventPhase(event,end-1),'active');
  assert.equal(eventPhase(event,end),'ended');
  assert.equal(initialSeasonIndex(start),i);
  if(i+1<SEASON_EVENTS.length)assert.equal(end,Date.parse(SEASON_EVENTS[i+1].start));
 }
 assert.equal(initialSeasonIndex(Date.parse('2027-01-01T12:00:00+01:00')),4);
 assert.equal(eventPhase(SEASON_EVENTS[4],Date.parse('2027-01-04T00:00:00+01:00')),'ended');
});
