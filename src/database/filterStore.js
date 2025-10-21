const RacheDB = require("rachedb");
const premiumStore = require("./premiumStore");

const DATABASE_NAME = "filtered_words";
const DATABASE_FOLDER = "database";
const KEY_PREFIX = "filter_words:";

function normalizeSnowflake(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeSnowflakeList(values) {
  if (!Array.isArray(values)) {
    return [];
  }

  const normalized = values
    .map((value) => normalizeSnowflake(value))
    .filter((value) => value.length > 0);

  return Array.from(new Set(normalized));
}

function normalizeWord(word) {
  return typeof word === "string" ? word.trim() : "";
}

function normalizeWordList(words) {
  if (!Array.isArray(words)) {
    return [];
  }

  const normalized = words
    .map((word) => normalizeWord(word))
    .filter((word) => word.length > 0);

  return Array.from(new Set(normalized));
}

class FilterStore {
  constructor() {
    this.db = new RacheDB({
      dbName: DATABASE_NAME,
      dbFolder: DATABASE_FOLDER,
      noBlankData: true,
      readable: true,
      language: "en",
    });
  }

  getKey(guildId) {
    return `${KEY_PREFIX}${guildId}`;
  }

  getSettings(guildId) {
    if (!guildId) {
      return {
        words: [],
        exemptChannels: [],
        exemptRoles: [],
      };
    }

    const stored = this.db.get(this.getKey(guildId));

    if (!stored) {
      return {
        words: [],
        exemptChannels: [],
        exemptRoles: [],
      };
    }

    if (Array.isArray(stored)) {
      return {
        words: stored
          .map((word) => (typeof word === "string" ? word.trim() : ""))
          .filter((word) => word.length > 0),
        exemptChannels: [],
        exemptRoles: [],
      };
    }

    const words = normalizeWordList(stored.words ?? stored.wordList ?? []);
    const exemptChannels = normalizeSnowflakeList(
      stored.exemptChannels ?? [],
    );
    const exemptRoles = normalizeSnowflakeList(stored.exemptRoles ?? []);

    return { words, exemptChannels, exemptRoles };
  }

  saveSettings(guildId, settings) {
    if (!guildId) {
      return;
    }

    const payload = {
      words: normalizeWordList(settings.words ?? []),
      exemptChannels: normalizeSnowflakeList(settings.exemptChannels ?? []),
      exemptRoles: normalizeSnowflakeList(settings.exemptRoles ?? []),
    };

    this.db.set(this.getKey(guildId), payload);
  }

  getWords(guildId) {
    return this.getSettings(guildId).words;
  }

  hasWord(guildId, word) {
    if (!guildId || !word) {
      return false;
    }

    const normalized = word.trim().toLowerCase();
    return this.getWords(guildId).some(
      (storedWord) => storedWord.toLowerCase() === normalized,
    );
  }

  getExemptChannels(guildId) {
    return this.getSettings(guildId).exemptChannels;
  }

  setExemptChannels(guildId, channelIds) {
    if (!guildId) {
      return { updated: false, channels: [] };
    }

    const settings = this.getSettings(guildId);
    const normalized = normalizeSnowflakeList(channelIds);

    this.saveSettings(guildId, {
      ...settings,
      exemptChannels: normalized,
    });

    return { updated: true, channels: normalized };
  }

  getExemptRoles(guildId) {
    return this.getSettings(guildId).exemptRoles;
  }

  setExemptRoles(guildId, roleIds) {
    if (!guildId) {
      return { updated: false, roles: [] };
    }

    const settings = this.getSettings(guildId);
    const normalized = normalizeSnowflakeList(roleIds);

    this.saveSettings(guildId, {
      ...settings,
      exemptRoles: normalized,
    });

    return { updated: true, roles: normalized };
  }

  isChannelExempt(guildId, channelId) {
    if (!guildId || !channelId) {
      return false;
    }

    const channels = this.getExemptChannels(guildId);
    return channels.includes(channelId);
  }

  isRoleExempt(guildId, roleId) {
    if (!guildId || !roleId) {
      return false;
    }

    const roles = this.getExemptRoles(guildId);
    return roles.includes(roleId);
  }

  getWordLimit(guildId) {
    return premiumStore.getWordLimitForGuild(guildId);
  }

  addWords(guildId, words) {
    if (!guildId) {
      return { added: [], duplicates: [], limitReached: false, reason: "MISSING_GUILD" };
    }

    const normalizedList = normalizeWordList(words);
    if (!normalizedList.length) {
      return { added: [], duplicates: [], limitReached: false, reason: "EMPTY" };
    }

    const settings = this.getSettings(guildId);
    const existing = settings.words;
    const existingLower = new Set(existing.map((word) => word.toLowerCase()));
    const duplicates = normalizedList.filter((word) =>
      existingLower.has(word.toLowerCase()),
    );

    const uniqueToAdd = normalizedList.filter(
      (word) => !existingLower.has(word.toLowerCase()),
    );

    const limit = this.getWordLimit(guildId);
    const availableSlots =
      limit === Infinity ? Infinity : Math.max(limit - existing.length, 0);
    const canAdd =
      availableSlots === Infinity
        ? uniqueToAdd
        : uniqueToAdd.slice(0, availableSlots);

    const added = [];

    if (canAdd.length) {
      const updated = existing.concat(canAdd);
      this.saveSettings(guildId, {
        ...settings,
        words: updated,
      });
      added.push(...canAdd);
    }

    return {
      added,
      duplicates,
      limitReached:
        (limit !== Infinity && added.length < uniqueToAdd.length) ||
        (limit !== Infinity && availableSlots === 0),
      limit,
    };
  }

  addWord(guildId, word) {
    const result = this.addWords(guildId, [word]);
    if (!result.added.length) {
      return {
        added: false,
        reason: result.reason ||
          (result.limitReached ? "LIMIT" : result.duplicates.length ? "DUPLICATE" : "EMPTY"),
      };
    }

    return { added: true };
  }

  removeWords(guildId, words) {
    if (!guildId) {
      return { removed: [], notFound: [], reason: "MISSING_GUILD" };
    }

    const normalizedList = normalizeWordList(words);
    if (!normalizedList.length) {
      return { removed: [], notFound: [], reason: "EMPTY" };
    }

    const settings = this.getSettings(guildId);
    const existing = settings.words;
    if (!existing.length) {
      return { removed: [], notFound: normalizedList };
    }

    const existingLower = new Set(existing.map((word) => word.toLowerCase()));
    const removed = [];
    const notFound = [];

    for (const word of normalizedList) {
      if (existingLower.has(word.toLowerCase())) {
        removed.push(word);
      } else {
        notFound.push(word);
      }
    }

    if (!removed.length) {
      return { removed: [], notFound };
    }

    const removedLower = new Set(removed.map((word) => word.toLowerCase()));
    const filtered = existing.filter(
      (storedWord) => !removedLower.has(storedWord.toLowerCase()),
    );

    this.saveSettings(guildId, {
      ...settings,
      words: filtered,
    });

    return { removed, notFound };
  }

  removeWord(guildId, word) {
    const result = this.removeWords(guildId, [word]);
    if (!result.removed.length) {
      return {
        removed: false,
        reason: result.reason || (result.notFound.length ? "NOT_FOUND" : "EMPTY"),
      };
    }

    return { removed: true };
  }
}

module.exports = new FilterStore();
