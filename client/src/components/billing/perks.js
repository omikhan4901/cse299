/**
 * A plan's perks as shown to people. Perks that state an AI credit amount are left out:
 * the credits line next to them comes from the plan's real allowance, so an old perk
 * ("10 AI credits a day") can't contradict it after an admin changes the numbers.
 */
export const perksOf = (plan) => (plan?.perks || []).filter((perk) => !/\d[\d,]*\s+(ai\s+)?credits?\b/i.test(perk));
