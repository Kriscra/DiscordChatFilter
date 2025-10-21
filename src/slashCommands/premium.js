const { SlashCommandBuilder } = require("discord.js");
const { buildPremiumEmbed, buildPremiumComponents } = require("../utils/premium");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("premium")
    .setDescription("Sunucunuzun premium durumunu gösterir."),
  async execute(interaction) {
    const guildId = interaction.guildId;
    if (!guildId) {
      await interaction.reply({
        content: "Bu komut yalnızca sunucularda kullanılabilir.",
        ephemeral: true,
      });
      return;
    }

    const embed = buildPremiumEmbed(guildId);
    const components = buildPremiumComponents(guildId);
    const payload = { embeds: [embed], ephemeral: true };

    if (components.length) {
      payload.components = components;
    }

    await interaction.reply(payload);
  },
};
