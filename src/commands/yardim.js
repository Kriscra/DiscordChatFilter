const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require("discord.js");

const INVITE_URL = "https://discord.com/api/oauth2/authorize?client_id=1121128528243605657&permissions=8&scope=bot";

module.exports = {
  name: "yardım",
  aliases: ["yardim"],
  description: "Bot komutları hakkında bilgi verir.",
  async execute(client, message) {
    const inviteButton = new ButtonBuilder()
      .setLabel("Davet")
      .setURL(INVITE_URL)
      .setStyle(ButtonStyle.Link);

    const row = new ActionRowBuilder().addComponents(inviteButton);

    const embed = new EmbedBuilder()
      .setColor("#009eff")
      .setTitle("Chat Filter Yardım Menüsü")
      .setDescription(
        [
          "**.yardım** veya **/yardim**: Bu menüyü gösterir.",
          "**.filitre** veya **/filitre**: Filitre menüsünü gösterir.",
          "**.invite** veya **/invite**: Davet bağlantısını gönderir.",
          "**.ping** veya **/ping**: Botun gecikme değerini gösterir.",
        ].join("\n"),
      )
      .setFooter({ text: "Beni davet etmek için butona tıklayabilirsiniz." })
      .setTimestamp();

    await message.channel.send({ embeds: [embed], components: [row] });
  },
};
