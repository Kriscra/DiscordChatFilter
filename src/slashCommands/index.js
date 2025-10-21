const fs = require("fs");
const path = require("path");
const { Collection } = require("discord.js");

function loadSlashCommands(client) {
  const commandsPath = __dirname;
  const commandFiles = fs
    .readdirSync(commandsPath)
    .filter((file) => file.endsWith(".js") && file !== "index.js");

  client.slashCommands = new Collection();
  const slashData = [];

  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    delete require.cache[require.resolve(filePath)];
    const command = require(filePath);

    if (!command?.data || typeof command.execute !== "function") {
      // eslint-disable-next-line no-console
      console.warn(`[SlashCommands] ${file} geçerli bir komut dışa aktarmıyor.`);
      continue;
    }

    client.slashCommands.set(command.data.name, command);
    slashData.push(command.data.toJSON());
  }

  client.slashCommandsData = slashData;
  return slashData;
}

module.exports = {
  loadSlashCommands,
};
