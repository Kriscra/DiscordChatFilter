const {
  ActionRowBuilder,
  EmbedBuilder,
  Events,
  ModalBuilder,
  PermissionsBitField,
  TextInputBuilder,
  TextInputStyle,
} = require("discord.js");
const filterStore = require("../database/filterStore");
const { chunkWords } = require("../utils/text");

const MODAL_ADD_ID = "modalekle";
const MODAL_REMOVE_ID = "modalcikart";
const INPUT_ADD_ID = "modal_ekle";
const INPUT_REMOVE_ID = "modal_cikart";

function ensureAdministrator(interaction) {
  const member = interaction.member;
  const hasPermission = member?.permissions?.has(
    PermissionsBitField.Flags.Administrator,
  );

  if (!hasPermission) {
    interaction.reply({
      content: "Bu işlemi yapabilmeniz için yönetici olmanız gerekiyor.",
      ephemeral: true,
    });
    return false;
  }

  return true;
}

function showAddModal(interaction) {
  const modal = new ModalBuilder()
    .setCustomId(MODAL_ADD_ID)
    .setTitle("Chat Filter - Kelime Ekle");

  const input = new TextInputBuilder()
    .setCustomId(INPUT_ADD_ID)
    .setLabel("Eklenecek kelimeyi girin")
    .setMaxLength(100)
    .setStyle(TextInputStyle.Short);

  const row = new ActionRowBuilder().addComponents(input);
  modal.addComponents(row);

  return interaction.showModal(modal);
}

function showRemoveModal(interaction) {
  const modal = new ModalBuilder()
    .setCustomId(MODAL_REMOVE_ID)
    .setTitle("Chat Filter - Kelime Çıkart");

  const input = new TextInputBuilder()
    .setCustomId(INPUT_REMOVE_ID)
    .setLabel("Silinecek kelimeyi girin")
    .setMaxLength(100)
    .setStyle(TextInputStyle.Short);

  const row = new ActionRowBuilder().addComponents(input);
  modal.addComponents(row);

  return interaction.showModal(modal);
}

async function listWords(interaction) {
  const words = filterStore.getWords(interaction.guildId);

  if (!words.length) {
    await interaction.reply({
      content: "Sistemde kayıtlı herhangi bir kelime bulunmuyor.",
      ephemeral: true,
    });
    return;
  }

  const chunks = chunkWords(words);

  await interaction.reply({
    content: "Filitredeki kelimeler aşağıda listelenmiştir.",
    ephemeral: true,
  });

  for (const chunk of chunks) {
    const embed = new EmbedBuilder()
      .setColor("#345691")
      .setDescription(chunk);

    await interaction.followUp({ embeds: [embed], ephemeral: true });
  }
}

async function handleAddModal(interaction) {
  if (!ensureAdministrator(interaction)) {
    return;
  }

  const word = interaction.fields.getTextInputValue(INPUT_ADD_ID);
  const result = filterStore.addWord(interaction.guildId, word);

  if (!result.added) {
    const reason =
      result.reason === "DUPLICATE"
        ? "Bu kelime zaten kayıtlı."
        : "Geçerli bir kelime girmelisiniz.";

    await interaction.reply({ content: reason, ephemeral: true });
    return;
  }

  await interaction.reply({
    content: "Kelime başarıyla filtreye eklendi.",
    ephemeral: true,
  });
}

async function handleRemoveModal(interaction) {
  if (!ensureAdministrator(interaction)) {
    return;
  }

  const word = interaction.fields.getTextInputValue(INPUT_REMOVE_ID);
  const result = filterStore.removeWord(interaction.guildId, word);

  if (!result.removed) {
    const message =
      result.reason === "NOT_FOUND"
        ? "Bu kelime sistemde kayıtlı değil."
        : "Geçerli bir kelime girmelisiniz.";

    await interaction.reply({ content: message, ephemeral: true });
    return;
  }

  await interaction.reply({
    content: "Kelime sistemden kaldırıldı.",
    ephemeral: true,
  });
}

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction) {
    if (!interaction.inGuild()) {
      return;
    }

    if (interaction.isButton()) {
      if (interaction.customId === "ekle") {
        await showAddModal(interaction);
        return;
      }

      if (interaction.customId === "cikart") {
        await showRemoveModal(interaction);
        return;
      }

      if (interaction.customId === "liste") {
        await listWords(interaction);
      }

      return;
    }

    if (!interaction.isModalSubmit()) {
      return;
    }

    if (interaction.customId === MODAL_ADD_ID) {
      await handleAddModal(interaction);
      return;
    }

    if (interaction.customId === MODAL_REMOVE_ID) {
      await handleRemoveModal(interaction);
    }
  },
};
