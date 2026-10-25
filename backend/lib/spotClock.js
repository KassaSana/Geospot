// Day boundaries, the daily reveal and streaks all follow Gainesville time.
const SPOT_TIME_ZONE = 'America/New_York';
const REVEAL_HOUR = 9;
const DAY_MS = 24 * 60 * 60 * 1000;

// Calendar day in Gainesville as "YYYY-MM-DD"
const dayKey = (date = new Date()) => date.toLocaleDateString('en-CA', { timeZone: SPOT_TIME_ZONE });

const daysBetween = (fromKey, toKey) => Math.round((Date.parse(toKey) - Date.parse(fromKey)) / DAY_MS);

const offsetFromUtc = (timestamp) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: SPOT_TIME_ZONE,
    hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(timestamp));
  const v = Object.fromEntries(parts.map((p) => [p.type, Number(p.value)]));
  return Date.UTC(v.year, v.month - 1, v.day, v.hour, v.minute, v.second) - timestamp;
};

// The instant the day's spot is revealed (REVEAL_HOUR:00 Gainesville time)
const revealTime = (key) => {
  const [year, month, day] = key.split('-').map(Number);
  const asIfUtc = Date.UTC(year, month - 1, day, REVEAL_HOUR);
  return new Date(asIfUtc - offsetFromUtc(asIfUtc));
};

// Every phone gets the same spot: rotate through active locations by day
const pickSpot = (locations, key) => {
  if (!locations.length) return null;
  const dayNumber = Math.round(Date.parse(key) / DAY_MS);
  return locations[dayNumber % locations.length];
};

// A streak survives until the end of the day after the last post
const currentStreak = (streak, lastPostDay, today = dayKey()) =>
  lastPostDay && daysBetween(lastPostDay, today) <= 1 ? streak : 0;

module.exports = { dayKey, daysBetween, revealTime, pickSpot, currentStreak };
