const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  SlashCommandBuilder,
} = require("discord.js");

const FILTER_MENU_EMOJI_ADD = "<:Plus:1140208783512043743>";
const FILTER_MENU_EMOJI_REMOVE = "<:minus:1140212230588207104>";
const FILTER_MENU_EMOJI_LIST = "<:list:1140213657402347540>";

module.exports = {
  data: new SlashCommandBuilder()
    .setName("filitre")
    .setDescription("Filtre yönetim menüsünü gösterir."),
  async execute(interaction) {
    const addButton = new ButtonBuilder()
      .setCustomId("ekle")
      .setLabel("Filitre Kelime Ekle")
      .setEmoji(FILTER_MENU_EMOJI_ADD)
      .setStyle(ButtonStyle.Success);

    const removeButton = new ButtonBuilder()
      .setCustomId("cikart")
      .setLabel("Filitre Kelime Çıkart")
      .setEmoji(FILTER_MENU_EMOJI_REMOVE)
      .setStyle(ButtonStyle.Danger);

    const listButton = new ButtonBuilder()
      .setCustomId("liste")
      .setLabel("Filitre Kelime Liste")
      .setEmoji(FILTER_MENU_EMOJI_LIST)
      .setStyle(ButtonStyle.Secondary);

    const row = new ActionRowBuilder().addComponents(
      addButton,
      removeButton,
      listButton,
    );

    const embed = new EmbedBuilder()
      .setColor("#009eff")
      .setTitle("Filitre Menüsü")
      .setDescription(
        [
          `${FILTER_MENU_EMOJI_ADD} Butonuna tıklayarak kelime ekleyebilirsiniz.`,
          `${FILTER_MENU_EMOJI_REMOVE} Butonuna tıklayarak kelime çıkartabilirsiniz.`,
          `${FILTER_MENU_EMOJI_LIST} Butonuna tıklayarak kelime listesine bakabilirsiniz.`,
        ].join("\n"),
      )
      .setFooter({
        text: "Aşağıdaki butonlardan seçim yapabilirsiniz.",
      })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], components: [row] });
  },
};
