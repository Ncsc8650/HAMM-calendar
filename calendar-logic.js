export const ZONE = "Asia/Bangkok";
export const CALENDAR_ID = "ditsadon8650@gmail.com";

export function dayKey(value) {
  const parts = new Intl.DateTimeFormat("en-US", {timeZone: ZONE, year: "numeric", month: "2-digit", day: "2-digit"}).formatToParts(value);
  const get = type => parts.find(part => part.type === type).value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function keyOf(year, month, day) {
  return [year, String(month + 1).padStart(2, "0"), String(day).padStart(2, "0")].join("-");
}

export function monthBounds(year, month) {
  const from = keyOf(year, month, 1);
  const next = new Date(Date.UTC(year, month + 1, 1));
  const to = keyOf(next.getUTCFullYear(), next.getUTCMonth(), 1);
  return {timeMin: `${from}T00:00:00+07:00`, timeMax: `${to}T00:00:00+07:00`};
}

export function category(event) {
  const title = event.summary || "";
  if (/กินยา|รับประทานยา|ทานยา/.test(title)) return "medicine";
  if (/งาน|กกมง|ประชุม|รายงาน|ตรวจ|ส่งเอกสาร/.test(title)) return "work";
  return "personal";
}

// Google Calendar's all-day end.date is exclusive; dateTime end is also exclusive.
export function eventDays(event) {
  if (!event.start || !event.end) return [];
  const start = event.start.date || (event.start.dateTime && dayKey(new Date(event.start.dateTime)));
  const end = event.end.date
    ? event.end.date
    : event.end.dateTime && dayKey(new Date(new Date(event.end.dateTime).getTime() - 1));
  if (!start || !end) return [];
  const result = [];
  let cursor = new Date(`${start}T00:00:00Z`);
  const exclusive = event.end.date ? end : keyAfter(end);
  for (let i = 0; i < 32 && cursor.toISOString().slice(0, 10) < exclusive; i++) {
    result.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return result;
}

function keyAfter(key) {
  const date = new Date(`${key}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

export function groupEvents(events, year, month) {
  const map = new Map();
  const first = keyOf(year, month, 1);
  const afterLast = monthBounds(year, month).timeMax.slice(0, 10);
  for (const event of events) {
    if (event.status === "cancelled") continue;
    if (!event.start || !event.end) continue;
    const start = event.start.date || (event.start.dateTime && dayKey(new Date(event.start.dateTime)));
    const endExclusive = event.end.date || (event.end.dateTime && keyAfter(dayKey(new Date(new Date(event.end.dateTime).getTime() - 1))));
    if (!start || !endExclusive) continue;
    const cursor = new Date(`${start > first ? start : first}T00:00:00Z`);
    const stop = endExclusive < afterLast ? endExclusive : afterLast;
    for (; cursor.toISOString().slice(0, 10) < stop; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
      const key = cursor.toISOString().slice(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(event);
    }
  }
  for (const list of map.values()) list.sort((a, b) => (a.start.dateTime || a.start.date).localeCompare(b.start.dateTime || b.start.date));
  return map;
}
