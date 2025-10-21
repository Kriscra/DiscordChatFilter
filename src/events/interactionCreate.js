const {
  ActionRowBuilder,
  EmbedBuilder,
  Events,
  ModalBuilder,
  PermissionsBitField,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require("discord.js");
const filterStore = require("../database/filterStore");
const premiumStore = require("../database/premiumStore");
const { chunkWords, normalizeWordInput } = require("../utils/text");
const {
  BUTTON_REDEEM,
  buildPremiumComponents,
  buildPremiumEmbed,
} = require("../utils/premium");

const BUTTON_ADD = "filter:add";
const BUTTON_REMOVE = "filter:remove";
const BUTTON_LIST = "filter:list";
const MODAL_ADD_ID = "filter:add:modal";
const INPUT_ADD_ID = "filter_add_words";
const SELECT_REMOVE_ID = "filter:remove:select";
const MODAL_PREMIUM_ID = "premium:modal";
const INPUT_PREMIUM_KEY = "premium_key";

function formatWordLimit(limit) {
  return limit === Infinity ? "sınırsız" : `${limit} kelime`;
}

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
  if (!ensureAdministrator(interaction)) {
    return;
  }

  const modal = new ModalBuilder()
    .setCustomId(MODAL_ADD_ID)
    .setTitle("Chat Filter - Kelime Ekle");

  const input = new TextInputBuilder()
    .setCustomId(INPUT_ADD_ID)
    .setLabel("Eklenecek kelimeleri girin")
    .setPlaceholder("Her satıra bir kelime yazabilir veya virgül ile ayırabilirsiniz.")
    .setMaxLength(400)
    .setStyle(TextInputStyle.Paragraph);

  const row = new ActionRowBuilder().addComponents(input);
  modal.addComponents(row);

  return interaction.showModal(modal);
}

function showRemoveMenu(interaction) {
  if (!ensureAdministrator(interaction)) {
    return;
  }

  const words = filterStore.getWords(interaction.guildId);

  if (!words.length) {
    interaction.reply({
      content: "Silinecek kelime bulunmuyor.",
      ephemeral: true,
    });
    return;
  }

  const options = words.slice(0, 25).map((word) => {
    const label = word.length > 100 ? `${word.slice(0, 97)}...` : word;
    return {
      label,
      value: word,
    };
  });

  const menu = new StringSelectMenuBuilder()
    .setCustomId(SELECT_REMOVE_ID)
    .setPlaceholder("Silmek istediğiniz kelimeleri seçin")
    .setMinValues(1)
    .setMaxValues(Math.min(options.length, 25))
    .addOptions(options);

  const content =
    words.length > 25
      ? "İlk 25 kelime gösteriliyor. Lütfen kaldırmak istediğiniz kelimeleri seçin."
      : "Kaldırmak istediğiniz kelimeleri seçin.";

  return interaction.reply({
    content,
    components: [new ActionRowBuilder().addComponents(menu)],
    ephemeral: true,
  });
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
    content: "Filtredeki kelimeler aşağıda listelenmiştir.",
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

  const rawInput = interaction.fields.getTextInputValue(INPUT_ADD_ID);
  const words = normalizeWordInput(rawInput);

  if (!words.length) {
    await interaction.reply({
      content: "Lütfen en az bir kelime girin.",
      ephemeral: true,
    });
    return;
  }

  const result = filterStore.addWords(interaction.guildId, words);

  if (!result.added.length) {
    let message = "Kelime eklenemedi. Lütfen girdilerinizi kontrol edin.";

    if (result.reason === "MISSING_GUILD") {
      message = "Sunucu bilgisi alınamadı.";
    } else if (result.limitReached) {
      const limitLabel = formatWordLimit(result.limit);
      if (premiumStore.isEnabled() && !premiumStore.isPremium(interaction.guildId)) {
        message = `Kelime kotanız ${limitLabel} ile sınırlı. Premium anahtarı kullanarak kapasitenizi ${formatWordLimit(premiumStore.getPremiumLimit())} seviyesine yükseltebilirsiniz.`;
      } else {
        message = `Kelime kotanız ${limitLabel} seviyesine ulaştı.`;
      }
    } else if (result.duplicates.length) {
      message = "Girdiğiniz tüm kelimeler zaten kayıtlı.";
    }

    await interaction.reply({ content: message, ephemeral: true });
    return;
  }

  const summary = [];
  const addedPreview = result.added
    .slice(0, 5)
    .map((word) => `\`${word}\``)
    .join(", ");

  if (result.added.length > 5) {
    summary.push(`➕ ${result.added.length} kelime eklendi (${addedPreview}...)`);
  } else {
    summary.push(`➕ Eklenen kelimeler: ${addedPreview}`);
  }

  if (result.duplicates.length) {
    const duplicatePreview = result.duplicates
      .slice(0, 5)
      .map((word) => `\`${word}\``)
      .join(", ");
    summary.push(
      result.duplicates.length > 5
        ? `⚠️ Zaten kayıtlı olan ${result.duplicates.length} kelime atlandı (${duplicatePreview}...)`
        : `⚠️ Zaten kayıtlı: ${duplicatePreview}`,
    );
  }

  if (result.limitReached) {
    const limitLabel = formatWordLimit(result.limit);
    if (premiumStore.isEnabled() && !premiumStore.isPremium(interaction.guildId)) {
      summary.push(
        `ℹ️ Kelime kotanız ${limitLabel} seviyesine ulaştı. Premium ile kapasitenizi ${formatWordLimit(premiumStore.getPremiumLimit())} seviyesine yükseltebilirsiniz.`,
      );
    } else {
      summary.push(`ℹ️ Kelime kotanız ${limitLabel} seviyesine ulaştı.`);
    }
  }

  await interaction.reply({
    content: summary.join("\n"),
    ephemeral: true,
  });
}

async function handleRemoveSelect(interaction) {
  if (!ensureAdministrator(interaction)) {
    return;
  }

  const selections = Array.isArray(interaction.values)
    ? interaction.values
    : [];

  if (!selections.length) {
    await interaction.update({
      content: "Hiçbir kelime seçilmedi.",
      components: [],
    });
    return;
  }

  const result = filterStore.removeWords(interaction.guildId, selections);
  const summary = [];

  if (result.removed.length) {
    const removedPreview = result.removed
      .slice(0, 5)
      .map((word) => `\`${word}\``)
      .join(", ");

    summary.push(
      result.removed.length > 5
        ? `🗑️ ${result.removed.length} kelime kaldırıldı (${removedPreview}...)`
        : `🗑️ Kaldırılan kelimeler: ${removedPreview}`,
    );
  }

  if (result.notFound.length) {
    const notFoundPreview = result.notFound
      .slice(0, 5)
      .map((word) => `\`${word}\``)
      .join(", ");

    summary.push(
      result.notFound.length > 5
        ? `⚠️ ${result.notFound.length} kelime bulunamadı (${notFoundPreview}...)`
        : `⚠️ Bulunamayan kelimeler: ${notFoundPreview}`,
    );
  }

  if (!summary.length) {
    summary.push("Herhangi bir kelime kaldırılamadı.");
  }

  await interaction.update({
    content: summary.join("\n"),
    components: [],
  });
}

async function showPremiumRedeemModal(interaction) {
  if (!ensureAdministrator(interaction)) {
    return;
  }

  if (!premiumStore.isEnabled()) {
    await interaction.reply({
      content: "Premium sistemi şu anda etkin değil.",
      ephemeral: true,
    });
    return;
  }

  const modal = new ModalBuilder()
    .setCustomId(MODAL_PREMIUM_ID)
    .setTitle("Chat Filter - Premium Anahtarı");

  const input = new TextInputBuilder()
    .setCustomId(INPUT_PREMIUM_KEY)
    .setLabel("Premium lisans anahtarınızı girin")
    .setPlaceholder("CHATFILTER-XXXX-XXXX")
    .setMaxLength(120)
    .setRequired(true)
    .setStyle(TextInputStyle.Short);

  modal.addComponents(new ActionRowBuilder().addComponents(input));

  return interaction.showModal(modal);
}

async function handlePremiumRedeemModal(interaction) {
  if (!ensureAdministrator(interaction)) {
    return;
  }

  if (!premiumStore.isEnabled()) {
    await interaction.reply({
      content: "Premium sistemi şu anda etkin değil.",
      ephemeral: true,
    });
    return;
  }

  const licenseKey = interaction.fields.getTextInputValue(INPUT_PREMIUM_KEY);
  const result = premiumStore.redeemLicense(interaction.guildId, licenseKey);

  if (!result.success) {
    let message = "Lisans anahtarı doğrulanamadı.";

    switch (result.reason) {
      case "INVALID":
        message = "Lütfen geçerli bir lisans anahtarı girin.";
        break;
      case "NOT_FOUND":
        message = "Bu lisans anahtarı geçerli değil.";
        break;
      case "USED":
        message = "Bu lisans anahtarı başka bir sunucuda kullanılmış.";
        break;
      case "MISSING_GUILD":
        message = "Sunucu bilgisi alınamadı.";
        break;
      case "DISABLED":
        message = "Premium sistemi şu anda etkin değil.";
        break;
      default:
        break;
    }

    await interaction.reply({ content: message, ephemeral: true });
    return;
  }

  const embed = buildPremiumEmbed(interaction.guildId);
  const components = buildPremiumComponents(interaction.guildId);

  const payload = {
    content: "💎 Premium başarıyla etkinleştirildi!",
    embeds: [embed],
    ephemeral: true,
  };

  if (components.length) {
    payload.components = components;
  }

  await interaction.reply(payload);
}

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction) {
    if (!interaction.inGuild()) {
      return;
    }

    if (interaction.isChatInputCommand()) {
      const command = interaction.client.slashCommands?.get(
        interaction.commandName,
      );

      if (!command) {
        await interaction.reply({
          content:
            "Bu komut artık kullanılamıyor. Lütfen komutları yeniden deneyin.",
          ephemeral: true,
        });
        return;
      }

      try {
        await command.execute(interaction, interaction.client);
      } catch (error) {
        console.error(
          `[SlashCommands] ${interaction.commandName} yürütülürken bir hata oluştu.`,
          error,
        );

        const response = {
          content:
            "Komut çalıştırılırken bir hata oluştu. Lütfen daha sonra tekrar deneyin.",
          ephemeral: true,
        };

        if (interaction.deferred || interaction.replied) {
          await interaction.followUp(response);
        } else {
          await interaction.reply(response);
        }
      }

      return;
    }

    if (interaction.isButton()) {
      if (interaction.customId === BUTTON_ADD) {
        await showAddModal(interaction);
        return;
      }

      if (interaction.customId === BUTTON_REMOVE) {
        await showRemoveMenu(interaction);
        return;
      }

      if (interaction.customId === BUTTON_LIST) {
        await listWords(interaction);
        return;
      }

      if (interaction.customId === BUTTON_REDEEM) {
        await showPremiumRedeemModal(interaction);
      }

      return;
    }

    if (interaction.isStringSelectMenu()) {
      if (interaction.customId === SELECT_REMOVE_ID) {
        await handleRemoveSelect(interaction);
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

    if (interaction.customId === MODAL_PREMIUM_ID) {
      await handlePremiumRedeemModal(interaction);
    }
  },
};
