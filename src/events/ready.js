const { Events } = require("discord.js");
const config = require("../config");

module.exports = {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    client.user.setActivity(config.Bot.BotDurum);
    client.user.setStatus(config.Bot.DurumTipi);

    console.log(`[Chat Filter] ${client.user.tag} ismiyle Discord API bağlantısı kuruldu!`);

    if (Array.isArray(client.slashCommandsData)) {
      try {
        await client.application.commands.set(client.slashCommandsData);
        console.log(
          `[SlashCommands] ${client.slashCommandsData.length} komut başarıyla kaydedildi.`,
        );
      } catch (error) {
        console.error(
          "[SlashCommands] Komutlar Discord API'ye kaydedilirken bir hata oluştu.",
          error,
        );
      }
    }
  },
};
