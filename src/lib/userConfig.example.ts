/**
 * TEMPLATE — commit this file, NOT userConfig.ts.
 * To set up: copy this file to userConfig.ts and fill in your details.
 *
 *   cp src/lib/userConfig.example.ts src/lib/userConfig.ts
 */

/** Injected verbatim into every coach prompt as the athlete context block. */
export const ATHLETE_PROFILE = `
ATHLETE PROFILE:
- [Sex, age, height, weight, body fat %]
- Sleep: [typical hours/night]
- [Any current injuries or notes]

GOALS BY [target date]:
- [Goal 1] → Currently: [baseline]
- [Goal 2] → Currently: [baseline]
- [Goal 3] → Currently: [baseline]

TRAINING STRUCTURE:
- [Describe your weekly split]
- [Any sport/activity you play regularly]
- [Any tendencies the coach should know about]

LOAD MANAGEMENT RULES:
- [Any hard rules you want enforced, e.g. no back-to-back hard days]
- [Deload schedule if applicable]
`.trim();

/** Displayed on the home page goals bar. Up to 4 entries shown. */
export const DASHBOARD_GOALS = [
  {
    label: "Goal 1",
    value: "Target",
    current: "Baseline",
    color: "text-accent-purple",
  },
  {
    label: "Goal 2",
    value: "Target",
    current: "Baseline",
    color: "text-accent-blue",
  },
  {
    label: "Goal 3",
    value: "Target",
    current: "Baseline",
    color: "text-accent-green",
  },
  {
    label: "Goal 4",
    value: "Target",
    current: "Baseline",
    color: "text-accent-orange",
  },
];
