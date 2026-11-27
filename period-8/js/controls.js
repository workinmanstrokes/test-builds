// Documented control scheme for Period 8 — touch, mouse and keyboard.
// Single source of truth for the How to Play screen, the README and the
// real-device playtest log (docs/playtest-log.md). Every binding lists its
// wiring status against www/js/view.js so a playtester can tell at a glance
// what is already in the build and what is still to wire.
//
// Design rule behind the scheme: a wrong call costs your streak (see game.js
// decide()), so the turn-back action must be deliberate but forgiving. The
// decision is always two steps — open the prompt, then confirm — and a tap
// anywhere else, or pressing Escape, cancels it with no penalty. No single
// accidental tap or keypress can ever end a run.

// --- Touch (phone) — implemented in view.js (pointer events, touchAction none) ---
export const TOUCH = [
  { gesture: 'Drag', action: 'Look around the panorama', status: 'implemented' },
  { gesture: 'Pinch (two fingers)', action: 'Zoom in / out', status: 'implemented' },
  { gesture: 'Double-tap', action: 'Zoom in on that spot', status: 'implemented' },
  { gesture: 'Tap an anomaly', action: 'Mark what looks wrong (opens the turn-back prompt)', status: 'implemented' },
  { gesture: 'Tap KEEP GOING', action: 'Say the room is normal and walk on (forward)', status: 'implemented' },
  { gesture: 'Tap TURN BACK', action: 'Open the turn-back prompt to report an anomaly', status: 'implemented' },
  { gesture: 'Tap outside the prompt / ✕', action: 'Cancel the decision, keep looking — no penalty', status: 'implemented' },
  { gesture: '◉ button', action: 'Screenshot tool (full view or 9:16 frame)', status: 'implemented' },
];

// --- Mouse / trackpad (desktop browser) — implemented in view.js (wheel) ---
export const MOUSE = [
  { gesture: 'Drag', action: 'Look around the panorama', status: 'implemented' },
  { gesture: 'Mouse wheel', action: 'Zoom in / out at the cursor', status: 'implemented' },
  { gesture: 'Shift + wheel / horizontal scroll', action: 'Pan sideways', status: 'implemented' },
  { gesture: 'Click an anomaly', action: 'Mark what looks wrong (opens the turn-back prompt)', status: 'implemented' },
  { gesture: 'Click KEEP GOING / TURN BACK', action: 'Decide forward or back (prompt confirms first)', status: 'implemented' },
];

// --- Keyboard (desktop browser) ---
// ArrowLeft / ArrowRight look is implemented in view.js (velocity pan).
// The decision keys below are bound in www/js/app.js (web keyboard handler),
// to the same KEEP GOING / TURN BACK buttons the touch UI uses. The two-step
// turn-back prompt (open, then confirm) is still to be wired: choose('back')
// decides on one press for now, and the Playwright smoke test depends on that,
// so the prompt change needs a test run first (see BUILD-PLAN.md milestone 5).
export const KEYBOARD = [
  { key: 'ArrowLeft / ArrowRight', action: 'Look left / right', status: 'implemented' },
  { key: 'Enter', action: 'KEEP GOING — the room is normal (forward)', status: 'implemented in app.js' },
  { key: 'Backspace or B', action: 'TURN BACK — open the report prompt', status: 'implemented in app.js' },
  { key: 'H', action: 'Use a hint (rewarded highlight of the anomaly region)', status: 'implemented in app.js' },
  { key: 'Escape', action: 'Cancel the open prompt / pause menu — never decides for you', status: 'implemented in app.js' },
];

export const TURN_BACK_KEYS = ['Backspace', 'b', 'B'];
export const FORWARD_KEYS = ['Enter'];
export const HINT_KEYS = ['h', 'H'];
export const CANCEL_KEYS = ['Escape'];

export const isTurnBackKey = e => TURN_BACK_KEYS.includes(e.key);
export const isForwardKey = e => FORWARD_KEYS.includes(e.key);
export const isHintKey = e => HINT_KEYS.includes(e.key);
export const isCancelKey = e => CANCEL_KEYS.includes(e.key);

// The forgiving turn-back rule, in one place so the prompt, the How to Play
// screen and the README can never disagree:
//  1. TURN BACK only opens the report prompt; nothing is decided yet.
//  2. Confirming with an anomaly present is a correct call (streak +1).
//  3. Confirming with no anomaly present is a false alarm: streak resets,
//     misses +1 — the same penalty as missing a real anomaly (game.js).
//  4. Cancelling (tap outside, ✕, Escape) costs nothing and the loop continues.
//  5. After any wrong call, the rewarded "keep your streak" offer can restore
//     the lost streak once per miss, only if the lost streak was 2+ (game.js
//     canKeepStreak / keepStreak).
export const TURN_BACK_RULE = [
  'TURN BACK opens a prompt; it never decides on its own.',
  'Confirm with a real anomaly present: correct call, streak +1.',
  'Confirm with no anomaly present: false alarm — streak resets, misses +1.',
  'Cancel (tap outside, ✕, Escape): free, the loop continues.',
  'After a wrong call, a rewarded ad can restore a lost streak of 2+ once per miss.',
];

export const CONTROL_SCHEME = { touch: TOUCH, mouse: MOUSE, keyboard: KEYBOARD };
