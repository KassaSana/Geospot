const { test } = require('node:test');
const assert = require('node:assert/strict');
const { dayKey, daysBetween, revealTime, pickSpot, currentStreak } = require('../lib/spotClock');

test('days follow Gainesville time, not UTC', () => {
  // 02:00 UTC on Jan 15 is still Jan 14 in Florida
  assert.equal(dayKey(new Date('2026-01-15T02:00:00Z')), '2026-01-14');
  assert.equal(dayKey(new Date('2026-01-15T06:00:00Z')), '2026-01-15');
});

test('the reveal is 9:00 local time in both winter and summer', () => {
  assert.equal(revealTime('2026-01-15').toISOString(), '2026-01-15T14:00:00.000Z'); // EST, UTC-5
  assert.equal(revealTime('2026-07-15').toISOString(), '2026-07-15T13:00:00.000Z'); // EDT, UTC-4
});

test('daysBetween counts calendar days across a DST change', () => {
  assert.equal(daysBetween('2026-03-07', '2026-03-08'), 1);
  assert.equal(daysBetween('2026-03-07', '2026-03-10'), 3);
});

test('pickSpot rotates through locations one per day', () => {
  const spots = ['a', 'b', 'c'];
  const picks = ['2026-05-01', '2026-05-02', '2026-05-03', '2026-05-04'].map(d => pickSpot(spots, d));
  assert.equal(new Set(picks.slice(0, 3)).size, 3);
  assert.equal(picks[3], picks[0]);
  assert.equal(pickSpot([], '2026-05-01'), null);
});

test('a streak survives until the day after the last post', () => {
  assert.equal(currentStreak(4, '2026-05-01', '2026-05-01'), 4);
  assert.equal(currentStreak(4, '2026-05-01', '2026-05-02'), 4);
  assert.equal(currentStreak(4, '2026-05-01', '2026-05-03'), 0);
  assert.equal(currentStreak(4, null, '2026-05-03'), 0);
});
