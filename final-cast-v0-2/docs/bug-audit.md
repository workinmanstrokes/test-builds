# Final Cast v0.1 bug list — audit against the v0.2 build

**Status: audit scaffold only.** The design review was written against the earlier v0.1 prototype and some listed bugs were already fixed — but what remains unfixed is **unverified**, and no real-phone playtest is recorded. Do not ship on the claim that "some were already fixed."

## How to use this file

1. Paste the authoritative v0.1 bug list below, one row per bug.
2. For each row, retest against the current build and set Status to `fixed/verified`, `still open`, or `cannot reproduce`.
3. Evidence must name the build, device, and date — "claimed fixed" without a retest is not evidence.
4. Retest every `still open` item before release; the release notes list the open items that remain.

| # | Bug (v0.1 wording) | Status | Evidence (build / device / date) | Retest notes |
|---|---|---|---|---|
| — | _No authoritative v0.1 bug list has been located yet — see open question below._ | _pending import_ | — | Import the list before any tuning changes. |

## Audit rules

- A bug is `fixed/verified` only after a retest on the current build passes.
- A bug is `still open` until a fix lands **and** a retest passes.
- `cannot reproduce` needs the exact steps tried and the build they were tried on.

## Open question

Where is the authoritative v0.1 bug list stored, and is there existing evidence for any items already claimed fixed? Until that is answered, this audit is a scaffold, not a verdict.
