const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require("discord.js");

const INVITE_URL = "https://discord.com/api/oauth2/authorize?client_id=1121128528243605657&permissions=8&scope=bot";

module.exports = {
  name: "invite",
  aliases: [],
  description: "Bot davet bağlantısını paylaşır.",
  async execute(client, message) {
    const inviteButton = new ButtonBuilder()
      .setLabel("Davet")
      .setURL(INVITE_URL)
      .setStyle(ButtonStyle.Link);

    const row = new ActionRowBuilder().addComponents(inviteButton);

    const embed = new EmbedBuilder()
      .setColor("#009eff")
      .setTitle("Chat Filter")
      .setDescription(
        "Botu sunucunuza eklemek için aşağıdaki butona tıklayabilirsiniz.",
      )
      .setFooter({ text: "Destek olduğunuz için teşekkürler!" })
      .setTimestamp();

    await message.channel.send({ embeds: [embed], components: [row] });
  },
};
