const RacheDB = require("rachedb");

const DATABASE_NAME = "filtered_words";
const DATABASE_FOLDER = "database";
const KEY_PREFIX = "filter_words:";

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

  addWord(guildId, word) {
    if (!guildId) {
      return { added: false, reason: "MISSING_GUILD" };
    }

    const normalized = (word ?? "").trim();
    if (!normalized.length) {
      return { added: false, reason: "EMPTY" };
    }

    if (this.hasWord(guildId, normalized)) {
      return { added: false, reason: "DUPLICATE" };
    }

    const words = this.getWords(guildId);
    words.push(normalized);
    this.db.set(this.getKey(guildId), words);

    return { added: true };
  }

  removeWord(guildId, word) {
    if (!guildId) {
      return { removed: false, reason: "MISSING_GUILD" };
    }

    const normalized = (word ?? "").trim();
    if (!normalized.length) {
      return { removed: false, reason: "EMPTY" };
    }

    const words = this.getWords(guildId);
    const filtered = words.filter(
      (storedWord) => storedWord.toLowerCase() !== normalized.toLowerCase(),
    );

    if (filtered.length === words.length) {
      return { removed: false, reason: "NOT_FOUND" };
    }

    this.db.set(this.getKey(guildId), filtered);
    return { removed: true };
  }
}

module.exports = new FilterStore();
