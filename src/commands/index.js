const fs = require("fs");
const path = require("path");
const { Collection } = require("discord.js");

function loadCommands(client) {
  const commandsPath = __dirname;
  const commandFiles = fs
    .readdirSync(commandsPath)
    .filter((file) => file.endsWith(".js") && file !== "index.js");

  client.commands = new Collection();
  client.aliases = new Collection();

  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    delete require.cache[require.resolve(filePath)];
    const command = require(filePath);

    if (!command?.name || typeof command.execute !== "function") {
      // eslint-disable-next-line no-console
      console.warn(`[Commands] ${file} geçerli bir komut dışa aktarmıyor.`);
      continue;
    }

    client.commands.set(command.name, command);

    if (Array.isArray(command.aliases)) {
      for (const alias of command.aliases) {
        client.aliases.set(alias, command.name);
      }
    }
  }
}

module.exports = {
  loadCommands,
};
