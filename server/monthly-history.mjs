const round = (value, digits = 2) => Number(value.toFixed(digits));
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

// Extend the same monthly input model, retaining the supplied September/October anchors.
export function extendMonthlyHistory(entry, context) {
  const index = entry.periods.findIndex((row) => row[0] === "2026-09");
  const anchor = entry.periods[index];
  const baseline = context.months[index];
  const seasons = [0.3, -0.5, 0.6, -0.7, 0.2, 0.8, -0.4, 0.7, -0.3, 0.4];
  const periods = [],
    observations = [];
  for (let i = 0; i < 10; i++) {
    const ordinal = 2025 * 12 + 10 + i;
    const period =
      Math.floor(ordinal / 12) +
      "-" +
      String((ordinal % 12) + 1).padStart(2, "0");
    const age = 10 - i,
      season = seasons[i];
    const purchase = round(anchor[3] * (0.78 + i * 0.02 + season * 0.03));
    const localRate = clamp(
      anchor[4] / anchor[3] - age * 0.006 + season * 0.015,
      0.2,
      0.95,
    );
    const local = round(purchase * localRate);
    const ranks = anchor[6].map((value) =>
      round(
        ((value * purchase) / anchor[3]) * (1 + age * 0.004 + season * 0.02),
      ),
    );
    periods.push([
      period,
      clamp(
        anchor[1] - Math.ceil(age / 4) + (season > 0.5 ? 1 : 0),
        1,
        anchor[2],
      ),
      anchor[2],
      purchase,
      local,
      round(anchor[5] * (0.78 + i * 0.02 + season * 0.025)),
      ranks,
      round(clamp(anchor[7] + age * 0.003 - season * 0.008, 0.05, 0.75), 3),
    ]);
    observations.push([
      round(baseline[0] + age * 0.18 - season * 0.9, 1),
      Math.round(clamp(baseline[1] - age * 0.55 + season * 1.4, 50, 99)),
      Math.round(clamp(baseline[2] - age * 0.42 + season * 1.2, 50, 99)),
      clamp(
        baseline[3] + Math.ceil(age / 4) - (season > 0.5 ? 1 : 0),
        0,
        baseline[4],
      ),
      baseline[4],
      round(clamp(baseline[5] + age * 0.001 - season * 0.002, 0.03, 0.18), 3),
      round(baseline[6] * (0.78 + i * 0.02 + season * 0.02)),
      round(baseline[7] * (0.78 + i * 0.02 + season * 0.015)),
      round(baseline[8] - age * 0.25 + season * 0.5, 1),
    ]);
  }
  entry.periods.push(...periods.reverse());
  context.months.push(...observations.reverse());
}
