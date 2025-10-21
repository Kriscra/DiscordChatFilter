const { Events } = require("discord.js");
const config = require("../config");

module.exports = {
  name: Events.ClientReady,
  once: true,
  execute(client) {
    client.user.setActivity(config.Bot.BotDurum);
    client.user.setStatus(config.Bot.DurumTipi);

    console.log(`[Chat Filter] ${client.user.tag} ismiyle Discord API bağlantısı kuruldu!`);
  },
};
