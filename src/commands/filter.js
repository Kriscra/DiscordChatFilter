const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} = require("discord.js");

const FILTER_MENU_EMOJI_ADD = "➕";
const FILTER_MENU_EMOJI_REMOVE = "🗑️";
const FILTER_MENU_EMOJI_LIST = "📋";

const BUTTON_ADD = "filter:add";
const BUTTON_REMOVE = "filter:remove";
const BUTTON_LIST = "filter:list";

module.exports = {
  name: "filtre",
  aliases: ["filitre"],
  description: "Filtre yönetim menüsünü gösterir.",
  async execute(client, message) {
    const addButton = new ButtonBuilder()
      .setCustomId(BUTTON_ADD)
      .setLabel("Kelime Ekle")
      .setEmoji(FILTER_MENU_EMOJI_ADD)
      .setStyle(ButtonStyle.Success);

    const removeButton = new ButtonBuilder()
      .setCustomId(BUTTON_REMOVE)
      .setLabel("Kelime Sil")
      .setEmoji(FILTER_MENU_EMOJI_REMOVE)
      .setStyle(ButtonStyle.Danger);

    const listButton = new ButtonBuilder()
      .setCustomId(BUTTON_LIST)
      .setLabel("Kelime Listesi")
      .setEmoji(FILTER_MENU_EMOJI_LIST)
      .setStyle(ButtonStyle.Secondary);

    const row = new ActionRowBuilder().addComponents(
      addButton,
      removeButton,
      listButton,
    );

    const embed = new EmbedBuilder()
      .setColor("#5f86ff")
      .setTitle("Chat Filter — Filtre Yönetimi")
      .setDescription(
        [
          `${FILTER_MENU_EMOJI_ADD} Birden fazla kelimeyi aynı anda eklemek için butona tıklayın.`,
          `${FILTER_MENU_EMOJI_REMOVE} Kayıtlı kelimeleri listeden seçerek saniyeler içinde silin.`,
          `${FILTER_MENU_EMOJI_LIST} Güncel filtre listenizi gizliden görüntüleyin.`,
        ].join("\n"),
      )
      .setFooter({
        text: "Yalnızca yöneticiler değişiklik yapabilir.",
      })
      .setTimestamp();

    await message.channel.send({ embeds: [embed], components: [row] });
  },
};
