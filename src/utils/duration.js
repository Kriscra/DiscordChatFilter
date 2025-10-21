const DAY_IN_MS = 24 * 60 * 60 * 1000;

const UNIT_ALIASES = {
  d: "day",
  day: "day",
  days: "day",
  gun: "day",
  gün: "day",
  gunluk: "day",
  günlük: "day",
  g: "day",
  hafta: "week",
  haftalik: "week",
  haftalık: "week",
  w: "week",
  week: "week",
  weeks: "week",
  ay: "month",
  aylik: "month",
  aylık: "month",
  m: "month",
  month: "month",
  months: "month",
  yil: "year",
  yıl: "year",
  yillik: "year",
  yıllık: "year",
  y: "year",
  year: "year",
  years: "year",
};

const UNIT_TO_DAYS = {
  day: 1,
  week: 7,
  month: 30,
  year: 365,
};

function normalizeUnit(unit) {
  if (!unit) {
    return null;
  }

  const cleaned = String(unit)
    .toLowerCase()
    .replace(/[^a-zçğıöşü]/g, "");

  return UNIT_ALIASES[cleaned] ?? null;
}

function daysFromValue(value, unit) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return null;
  }

  const normalizedUnit = normalizeUnit(unit);

  if (!normalizedUnit) {
    return numericValue;
  }

  const multiplier = UNIT_TO_DAYS[normalizedUnit];
  return numericValue * multiplier;
}

function parseDurationToken(token) {
  if (!token) {
    return null;
  }

  const match = String(token)
    .trim()
    .toLowerCase()
    .match(/^(\d+)([a-zçğıöşü]*)$/i);

  if (!match) {
    return null;
  }

  const [, value, unit] = match;
  return daysFromValue(value, unit);
}

function parseDurationArgs(args) {
  if (!Array.isArray(args) || !args.length) {
    return null;
  }

  const raw = String(args[0] ?? "").trim().toLowerCase();
  const match = raw.match(/^(\d+)([a-zçğıöşü]*)$/i);

  if (match) {
    const [, value, unit] = match;

    if (unit?.length) {
      return daysFromValue(value, unit);
    }

    if (args.length >= 2) {
      const combined = daysFromValue(value, args[1]);
      if (combined) {
        return combined;
      }
    }

    return daysFromValue(value);
  }

  if (args.length >= 2) {
    return daysFromValue(args[0], args[1]);
  }

  return parseDurationToken(args[0]);
}

function formatDurationLabel(days) {
  const value = Number(days);

  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }

  if (value % 365 === 0) {
    const years = value / 365;
    return `${years} yıl`;
  }

  if (value % 30 === 0) {
    const months = value / 30;
    return `${months} ay`;
  }

  if (value % 7 === 0) {
    const weeks = value / 7;
    return `${weeks} hafta`;
  }

  return `${value} gün`;
}

module.exports = {
  DAY_IN_MS,
  daysFromValue,
  formatDurationLabel,
  parseDurationArgs,
  parseDurationToken,
};
