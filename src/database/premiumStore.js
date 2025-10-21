const RacheDB = require("rachedb");
const config = require("../config");

const DATABASE_NAME = "filtered_words";
const DATABASE_FOLDER = "database";
const GUILD_KEY_PREFIX = "premium:guild:";
const LICENSE_KEY_PREFIX = "premium:license:";

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
      return { isPremium: false, licenseKey: null, activatedAt: null };
    }

    const record = this.db.get(this.getGuildKey(guildId));
    if (!record || typeof record !== "object") {
      return { isPremium: false, licenseKey: null, activatedAt: null };
    }

    return {
      isPremium: Boolean(record.active),
      licenseKey: record.licenseKey ?? null,
      activatedAt: record.activatedAt ?? null,
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

    const availableKeys = getLicensePool();
    if (!availableKeys.includes(normalized)) {
      return { success: false, reason: "NOT_FOUND" };
    }

    const usageRecord = this.db.get(this.getLicenseKey(normalized));
    if (usageRecord && usageRecord.guildId && usageRecord.guildId !== guildId) {
      return { success: false, reason: "USED" };
    }

    const activatedAt = new Date().toISOString();
    this.db.set(this.getLicenseKey(normalized), {
      guildId,
      redeemedAt: activatedAt,
    });
    this.db.set(this.getGuildKey(guildId), {
      active: true,
      licenseKey: normalized,
      activatedAt,
    });

    return { success: true, licenseKey: normalized, activatedAt };
  }
}

module.exports = new PremiumStore();
