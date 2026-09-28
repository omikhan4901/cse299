/**
 * AI requests in flight, so one status card can reassure people when the AI is slow
 * (see components/AiStatus.jsx). lib/api.js adds and removes entries.
 */
const listeners = new Set();
let active = [];

const emit = () => listeners.forEach((fn) => fn(active));

/** Adds a request ({ path, startedAt, budgetMs, cancel }); returns a function that removes it. */
export function trackAi(entry) {
  active = [...active, entry];
  emit();
  return () => {
    active = active.filter((e) => e !== entry);
    emit();
  };
}

export function subscribeAi(fn) {
  listeners.add(fn);
  fn(active);
  return () => listeners.delete(fn);
}
