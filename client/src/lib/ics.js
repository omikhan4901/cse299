/**
 * Calendar export (.ics, V2): deadlines, interviews and follow-ups of tracked applications,
 * for any calendar app. Deadlines and follow-ups are all-day events; interviews keep their
 * time. Pure; shared by the app and the tests.
 */
const esc = (s) => String(s || "").replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/([,;])/g, "\\$1");
const day = (d) => new Date(d).toISOString().slice(0, 10).replace(/-/g, "");
const stamp = (d) => new Date(d).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const nextDay = (d) => day(new Date(new Date(d).getTime() + 864e5));

/** Lines longer than 75 bytes are folded, as the format requires (never inside a character). */
const bytes = (s) => new TextEncoder().encode(s).length;
function fold(line) {
  const out = [];
  let rest = line;
  while (bytes(rest) > 74) {
    let cut = Math.min(rest.length, 74);
    while (cut > 1 && bytes(rest.slice(0, cut)) > 74) cut--;
    out.push(rest.slice(0, cut));
    rest = ` ${rest.slice(cut)}`;
  }
  out.push(rest);
  return out.join("\r\n");
}

export function calendarFor(apps, { now = new Date(), site = "https://resumex.cc" } = {}) {
  const events = [];
  for (const a of apps || []) {
    if (a.archived) continue;
    const name = [a.job?.title, a.job?.organisation].filter(Boolean).join(" · ") || "Application";
    const link = `${site}/applications?open=${a._id}`;
    if (a.job?.deadline && ["saved", "preparing"].includes(a.status)) events.push({ uid: `${a._id}-deadline`, allDay: a.job.deadline, summary: `Deadline: ${name}`, link });
    if (a.followUpAt && ["applied", "interviewing"].includes(a.status)) events.push({ uid: `${a._id}-followup`, allDay: a.followUpAt, summary: `Follow up: ${name}`, link });
    for (const i of a.interviews || []) {
      if (i.at) events.push({ uid: `${a._id}-interview-${i.id}`, start: i.at, summary: `${i.kind || "Interview"}: ${name}`, link, notes: i.notes });
    }
  }
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//ResumeX//Applications//EN", "CALSCALE:GREGORIAN", "X-WR-CALNAME:ResumeX applications"];
  for (const e of events) {
    lines.push("BEGIN:VEVENT", `UID:${e.uid}@resumex.cc`, `DTSTAMP:${stamp(now)}`);
    if (e.allDay) lines.push(`DTSTART;VALUE=DATE:${day(e.allDay)}`, `DTEND;VALUE=DATE:${nextDay(e.allDay)}`);
    else lines.push(`DTSTART:${stamp(e.start)}`, `DTEND:${stamp(new Date(new Date(e.start).getTime() + 3600e3))}`);
    lines.push(`SUMMARY:${esc(e.summary)}`, `DESCRIPTION:${esc([e.notes, e.link].filter(Boolean).join("\n"))}`, `URL:${e.link}`, "END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return { text: `${lines.map(fold).join("\r\n")}\r\n`, count: events.length };
}
