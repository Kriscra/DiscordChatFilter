function chunkWords(words, chunkSize = 2000) {
  const sanitized = Array.isArray(words)
    ? words.filter((word) => typeof word === "string" && word.trim().length > 0)
    : [];

  if (!sanitized.length) {
    return [];
  }

  const chunks = [];
  let current = "";

  for (const word of sanitized) {
    const formatted = `**\`${word}\`**`;
    const withSeparator = current.length > 0 ? `, ${formatted}` : formatted;

    if ((current + withSeparator).length > chunkSize && current.length > 0) {
      chunks.push(current);
      current = formatted;
    } else {
      current += withSeparator;
    }
  }

  if (current.length > 0) {
    chunks.push(current);
  }

  return chunks;
}

module.exports = {
  chunkWords,
};
