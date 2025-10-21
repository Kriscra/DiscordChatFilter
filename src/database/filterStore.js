const RacheDB = require("rachedb");
const premiumStore = require("./premiumStore");

const DATABASE_NAME = "filtered_words";
const DATABASE_FOLDER = "database";
const KEY_PREFIX = "filter_words:";

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

  getWords(guildId) {
    if (!guildId) {
      return [];
    }

    const stored = this.db.get(this.getKey(guildId));
    if (!Array.isArray(stored)) {
      return [];
    }

    return stored
      .map((word) => (typeof word === "string" ? word.trim() : ""))
      .filter((word) => word.length > 0);
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

    const existing = this.getWords(guildId);
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
      this.db.set(this.getKey(guildId), updated);
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

    const existing = this.getWords(guildId);
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

    this.db.set(this.getKey(guildId), filtered);

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
