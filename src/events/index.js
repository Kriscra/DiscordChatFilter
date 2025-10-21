const fs = require("fs");
const path = require("path");

function registerEvents(client) {
  const eventsPath = __dirname;
  const eventFiles = fs
    .readdirSync(eventsPath)
    .filter((file) => file.endsWith(".js") && file !== "index.js");

  for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    delete require.cache[require.resolve(filePath)];
    const event = require(filePath);

    if (!event?.name || typeof event.execute !== "function") {
      // eslint-disable-next-line no-console
      console.warn(`[Events] ${file} geçerli bir etkinlik dışa aktarmıyor.`);
      continue;
    }

    if (event.once) {
      client.once(event.name, (...args) => event.execute(...args, client));
    } else {
      client.on(event.name, (...args) => event.execute(...args, client));
    }
  }
}

module.exports = {
  registerEvents,
};
