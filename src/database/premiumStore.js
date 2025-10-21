const crypto = require("node:crypto");
const RacheDB = require("rachedb");
const config = require("../config");

const DATABASE_NAME = "filtered_words";
const DATABASE_FOLDER = "database";
const GUILD_KEY_PREFIX = "premium:guild:";
const LICENSE_KEY_PREFIX = "premium:license:";
const LICENSE_PREFIX = "CHATFILTER";
const DAY_IN_MS = 24 * 60 * 60 * 1000;

function normalizeLicenseKey(key) {
  return String(key ?? "")
    .trim()
    .toUpperCase();
}

function getLicensePool() {
  const keys = config.Premium?.LicenseKeys;
  if (!Array.isArray(keys)) {
    return [];
  }

  return keys.map((key) => normalizeLicenseKey(key)).filter((key) => key.length);
}

function formatExpiry(durationDays, fromDate = new Date()) {
  if (!Number.isFinite(durationDays) || durationDays <= 0) {
    return null;
  }

  const base = fromDate instanceof Date ? fromDate.getTime() : Date.now();
  const expiresAt = new Date(base + durationDays * DAY_IN_MS);
  return expiresAt.toISOString();
}

function calculateDurationDays(durationDays) {
  if (!Number.isFinite(durationDays) || durationDays <= 0) {
    return null;
  }

  return Math.round(durationDays);
}

class PremiumStore {
  constructor() {
    this.db = new RacheDB({
      dbName: DATABASE_NAME,
      dbFolder: DATABASE_FOLDER,
      noBlankData: true,
      readable: true,
      language: "en",
    });
  }

  generateKeySegment() {
    return crypto.randomBytes(2).toString("hex").toUpperCase();
  }

  generateLicenseKey() {
    const segments = [
      LICENSE_PREFIX,
      this.generateKeySegment(),
      this.generateKeySegment(),
      this.generateKeySegment(),
    ];

    return segments.join("-");
  }

  createUniqueLicenseKey() {
    const pool = new Set(getLicensePool());
    let attempt = 0;

    while (attempt < 10) {
      const key = this.generateLicenseKey();
      const normalized = normalizeLicenseKey(key);
      const existing = this.db.get(this.getLicenseKey(normalized));

      if (!existing && !pool.has(normalized)) {
        return normalized;
      }

      attempt += 1;
    }

    return null;
  }

  isEnabled() {
    return Boolean(config.Premium?.Enabled);
  }

  getDefaultLimit() {
    const configured = Number(config.Premium?.DefaultLimit);
    if (!Number.isFinite(configured) || configured <= 0) {
      return Infinity;
    }

    return configured;
  }

  getPremiumLimit() {
    const configured = Number(config.Premium?.PremiumLimit);
    if (!Number.isFinite(configured) || configured <= 0) {
      return Infinity;
    }

    return configured;
  }

  getGuildKey(guildId) {
    return `${GUILD_KEY_PREFIX}${guildId}`;
  }

  getLicenseKey(licenseKey) {
    return `${LICENSE_KEY_PREFIX}${licenseKey}`;
  }

  getGuildStatus(guildId) {
    if (!guildId) {
      return {
        isPremium: false,
        licenseKey: null,
        activatedAt: null,
        expiresAt: null,
        expired: false,
      };
    }

    const record = this.db.get(this.getGuildKey(guildId));
    if (!record || typeof record !== "object") {
      return {
        isPremium: false,
        licenseKey: null,
        activatedAt: null,
        expiresAt: null,
        expired: false,
      };
    }

    const expiresAt = record.expiresAt ? new Date(record.expiresAt) : null;
    const now = new Date();

    if (expiresAt && Number.isFinite(expiresAt.getTime()) && expiresAt <= now) {
      const updatedRecord = {
        ...record,
        active: false,
        expiredAt: record.expiredAt ?? now.toISOString(),
      };
      this.db.set(this.getGuildKey(guildId), updatedRecord);

      if (record.licenseKey) {
        const licenseRecord = this.db.get(this.getLicenseKey(record.licenseKey));
        if (licenseRecord && typeof licenseRecord === "object") {
          this.db.set(this.getLicenseKey(record.licenseKey), {
            ...licenseRecord,
            active: false,
            expiredAt: licenseRecord.expiredAt ?? now.toISOString(),
          });
        }
      }

      return {
        isPremium: false,
        licenseKey: record.licenseKey ?? null,
        activatedAt: record.activatedAt ?? null,
        expiresAt: record.expiresAt ?? null,
        expired: true,
      };
    }

    return {
      isPremium: Boolean(record.active),
      licenseKey: record.licenseKey ?? null,
      activatedAt: record.activatedAt ?? null,
      expiresAt: record.expiresAt ?? null,
      expired: false,
    };
  }

  isPremium(guildId) {
    return this.getGuildStatus(guildId).isPremium;
  }

  getWordLimitForGuild(guildId) {
    if (!guildId) {
      return this.getDefaultLimit();
    }

    if (!this.isEnabled()) {
      return this.getDefaultLimit();
    }

    return this.isPremium(guildId)
      ? this.getPremiumLimit()
      : this.getDefaultLimit();
  }

  redeemLicense(guildId, licenseKey) {
    if (!this.isEnabled()) {
      return { success: false, reason: "DISABLED" };
    }

    if (!guildId) {
      return { success: false, reason: "MISSING_GUILD" };
    }

    const normalized = normalizeLicenseKey(licenseKey);
    if (!normalized.length) {
      return { success: false, reason: "INVALID" };
    }

    const licenseKeyRecord = this.db.get(this.getLicenseKey(normalized));
    const availableKeys = getLicensePool();

    if (!licenseKeyRecord && !availableKeys.includes(normalized)) {
      return { success: false, reason: "NOT_FOUND" };
    }

    if (
      licenseKeyRecord &&
      licenseKeyRecord.guildId &&
      licenseKeyRecord.guildId !== guildId &&
      licenseKeyRecord.redeemedAt
    ) {
      return { success: false, reason: "USED" };
    }

    if (
      licenseKeyRecord &&
      licenseKeyRecord.guildId === guildId &&
      licenseKeyRecord.redeemedAt
    ) {
      return { success: false, reason: "USED" };
    }

    const activatedAt = new Date();
    const currentGuildRecord = this.db.get(this.getGuildKey(guildId));
    if (
      currentGuildRecord &&
      currentGuildRecord.licenseKey &&
      currentGuildRecord.licenseKey !== normalized
    ) {
      const currentLicense = this.db.get(
        this.getLicenseKey(currentGuildRecord.licenseKey),
      );
      if (currentLicense && typeof currentLicense === "object") {
        this.db.set(this.getLicenseKey(currentGuildRecord.licenseKey), {
          ...currentLicense,
          active: false,
          revokedAt: currentLicense.revokedAt ?? activatedAt.toISOString(),
        });
      }
    }
    const durationDays = calculateDurationDays(licenseKeyRecord?.durationDays);
    const expiresAt = durationDays ? formatExpiry(durationDays, activatedAt) : null;
    const guildRecord = {
      active: true,
      licenseKey: normalized,
      activatedAt: activatedAt.toISOString(),
      expiresAt,
    };

    this.db.set(this.getGuildKey(guildId), guildRecord);

    const licenseRecord = {
      ...(licenseKeyRecord && typeof licenseKeyRecord === "object"
        ? licenseKeyRecord
        : {}),
      guildId,
      redeemedAt: activatedAt.toISOString(),
      expiresAt,
      active: true,
    };

    this.db.set(this.getLicenseKey(normalized), licenseRecord);

    return {
      success: true,
      licenseKey: normalized,
      activatedAt: activatedAt.toISOString(),
      expiresAt,
    };
  }

  getLicenseMetadata(licenseKey) {
    const normalized = normalizeLicenseKey(licenseKey);

    if (!normalized) {
      return null;
    }

    const record = this.db.get(this.getLicenseKey(normalized));
    if (record && typeof record === "object") {
      return { ...record, licenseKey: normalized };
    }

    const availableKeys = getLicensePool();
    if (!availableKeys.includes(normalized)) {
      return null;
    }

    return {
      licenseKey: normalized,
      durationDays: null,
      createdAt: null,
      createdBy: null,
      redeemedAt: null,
      expiresAt: null,
    };
  }

  generateLicense(durationDays, metadata = {}) {
    if (!this.isEnabled()) {
      return { success: false, reason: "DISABLED" };
    }

    const normalizedDuration = calculateDurationDays(Number(durationDays));

    if (!normalizedDuration) {
      return { success: false, reason: "INVALID_DURATION" };
    }

    const licenseKey = this.createUniqueLicenseKey();

    if (!licenseKey) {
      return { success: false, reason: "FAILED" };
    }

    const createdAt = new Date().toISOString();
    this.db.set(this.getLicenseKey(licenseKey), {
      durationDays: normalizedDuration,
      createdAt,
      createdBy: metadata.createdBy ?? null,
      redeemedAt: null,
      expiresAt: null,
      guildId: null,
    });

    return {
      success: true,
      licenseKey,
      durationDays: normalizedDuration,
      createdAt,
    };
  }
}

module.exports = new PremiumStore();
