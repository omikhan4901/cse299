/** "just now", "5 minutes ago", "2 days ago"… */
export const timeAgo = (date) => {
  const s = (Date.now() - new Date(date).getTime()) / 1000;
  if (s < 60) return "just now";
  const units = [[60, "minute"], [24, "hour"], [30, "day"], [12, "month"], [Infinity, "year"]];
  let v = s / 60;
  for (const [n, name] of units) {
    if (v < n) return `${Math.floor(v)} ${name}${Math.floor(v) === 1 ? "" : "s"} ago`;
    v /= n;
  }
  return "";
};
