const { Events } = require("discord.js");
const config = require("../config");
const filterStore = require("../database/filterStore");

function runCommand(message, client) {
  const content = message.content ?? "";

  if (!content.startsWith(config.Bot.Prefix)) {
    return;
  }

  const args = content.slice(config.Bot.Prefix.length).trim().split(/\s+/);
  const commandName = args.shift()?.toLowerCase();

  if (!commandName) {
    return;
  }

  const aliasTarget = client.aliases?.get(commandName);
  const command = client.commands.get(commandName) ||
    (aliasTarget ? client.commands.get(aliasTarget) : undefined);

  if (!command) {
    return;
  }

  Promise.resolve(command.execute(client, message, args)).catch((error) => {
    console.error(`[Commands] ${command.name} yürütülürken bir hata oluştu.`, error);
  });
}

function enforceFilter(message) {
  const guildId = message.guild?.id;
  if (!guildId) {
    return;
  }

  const words = filterStore.getWords(guildId);
  if (!words.length) {
    return;
  }

  const lowered = (message.content ?? "").toLowerCase();
  const matched = words.find((word) => lowered.includes(word.toLowerCase()));

  if (!matched) {
    return;
  }

  message.delete().catch((error) => {
    console.error("Filtrelenmiş mesaj silinirken bir hata oluştu.", error);
  });
}

module.exports = {
  name: Events.MessageCreate,
  execute(message, client) {
    if (!message.guild || message.author.bot) {
      return;
    }

    enforceFilter(message);
    runCommand(message, client);
  },
};
