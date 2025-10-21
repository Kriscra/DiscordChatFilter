const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  SlashCommandBuilder,
} = require("discord.js");

const INVITE_URL =
  "https://discord.com/api/oauth2/authorize?client_id=1121128528243605657&permissions=8&scope=bot";

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Botun gecikme değerini gösterir."),
  async execute(interaction) {
    const inviteButton = new ButtonBuilder()
      .setLabel("Davet")
      .setURL(INVITE_URL)
      .setStyle(ButtonStyle.Link);

    const row = new ActionRowBuilder().addComponents(inviteButton);

    const embed = new EmbedBuilder()
      .setColor("#009eff")
      .setTitle("Chat Filter")
      .setDescription(`Benim anlık gecikmem **${interaction.client.ws.ping}ms**.`)
      .setFooter({ text: "Beni davet etmek için butona tıklayabilirsiniz." })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], components: [row] });
  },
};
