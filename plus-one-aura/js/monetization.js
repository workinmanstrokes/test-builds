// +1 Aura: monetization skeleton. Pure config + rules (no DOM, no network).
// Decided for the Playtest Retune Update: free, no interstitial during tapping,
// one optional rewarded ad (restores a used daily streak-save), and Halos are
// earned only — they can never be bought. The actual AdMob calls live in
// www/js/ads.js; this module is the single source of truth for the rules.

export const MONETIZATION = Object.freeze({
  plan: 'free',
  // Interstitials: never during tapping. (None are scheduled anywhere else yet
  // either — if one is ever added, it must be between sessions, never mid-run.)
  interstitials: Object.freeze({
    duringTapping: false,
    betweenSessions: false,
  }),
  // The only ad in the game: an optional rewarded ad that restores a streak-save
  // the player already used today. Never forced, never during a tap streak.
  rewarded: Object.freeze({
    streakSaveRestore: true,
    maxRestoresPerDay: 1,
  }),
  // Halos: earned only by Ascending. There is no price, no SKU, no purchase path.
  halos: Object.freeze({
    earnOnly: true,
    purchasable: false,
  }),
});

/** Speed Escape is a 60-second bonus minigame, not a second game. */
export const SPEED_ESCAPE_BONUS = Object.freeze({
  durationSeconds: 60,
  // Capped Aura paid back to the main game when the bonus run ends.
  maxAuraReward: 500,
  rewardPerSecondSurvived: 5,
});

/**
 * Daily hook rules (see README "Status — Playtest Retune Update").
 * Implemented in www/js/game.js (rollGoal / the tap first-tap bonus / the
 * overheat streak-save) and wired to the Daily screen in www/js/app.js
 * openDaily(): the constants here and the code there must agree.
 */
export const DAILY_HOOK = Object.freeze({
  goalResetsUtc: true,
  firstTapMultiplier: 2, // first tap of a new UTC day pays double Aura, once per day
  streakSavesPerDay: 1, // one overheat per day keeps the streak instead of dropping it
});

/**
 * Any attempt to buy Halos is refused by design. Returns the refusal so the UI
 * can explain it instead of opening a store flow that does not exist.
 */
export function haloPurchaseAttempt() {
  return {
    allowed: false,
    reason: 'Halos are earned only by Ascending. They can never be bought.',
  };
}

/** Aura earned from a Speed Escape bonus run, capped so it stays a bonus. */
export function speedEscapeReward(secondsSurvived) {
  const s = Math.max(0, Math.min(SPEED_ESCAPE_BONUS.durationSeconds, secondsSurvived || 0));
  return Math.min(
    SPEED_ESCAPE_BONUS.maxAuraReward,
    Math.floor(s * SPEED_ESCAPE_BONUS.rewardPerSecondSurvived),
  );
}

/**
 * Should the streak-save offer appear? Only when the player has a save left
 * today (or a rewarded restore available) — never as a forced prompt.
 */
export function streakSaveOffer({ savesLeftToday, restoresLeftToday }) {
  if (savesLeftToday > 0) return { offer: 'save', cost: 'free', usesLeft: savesLeftToday };
  if (MONETIZATION.rewarded.streakSaveRestore && restoresLeftToday > 0) {
    return { offer: 'restore', cost: 'rewarded-ad', usesLeft: restoresLeftToday };
  }
  return { offer: 'none', cost: null, usesLeft: 0 };
}
