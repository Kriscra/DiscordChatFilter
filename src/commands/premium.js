const { buildPremiumEmbed, buildPremiumComponents } = require("../utils/premium");

module.exports = {
  name: "premium",
  aliases: [],
  description: "Sunucunuzun premium durumunu gösterir.",
  async execute(client, message) {
    const guildId = message.guild?.id;
    if (!guildId) {
      return;
    }

    const embed = buildPremiumEmbed(guildId);
    const components = buildPremiumComponents(guildId);
    const payload = { embeds: [embed] };

    if (components.length) {
      payload.components = components;
    }

    await message.channel.send(payload);
  },
};
