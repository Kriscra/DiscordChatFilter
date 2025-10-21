const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const premiumStore = require("../database/premiumStore");
const {
  DAY_IN_MS,
  daysFromValue,
  formatDurationLabel,
} = require("../utils/duration");
const { getOwnerIds, isBotOwner } = require("../utils/permissions");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("premiumkod")
    .setDescription("Belirli bir süre için premium lisans anahtarı oluşturur.")
    .addIntegerOption((option) =>
      option
        .setName("sure")
        .setDescription("Süre değeri (ör. 30)")
        .setRequired(true)
        .setMinValue(1),
    )
    .addStringOption((option) =>
      option
        .setName("birim")
        .setDescription("Süre birimi")
        .setRequired(true)
        .addChoices(
          { name: "Gün", value: "gün" },
          { name: "Hafta", value: "hafta" },
          { name: "Ay", value: "ay" },
          { name: "Yıl", value: "yıl" },
        ),
    ),
  async execute(interaction) {
    if (!isBotOwner(interaction.user?.id)) {
      const owners = getOwnerIds();
      await interaction.reply({
        content: owners.length
          ? "Bu komutu yalnızca bot sahipleri kullanabilir."
          : "Bu komutu kullanabilmek için config.js dosyasındaki Bot.OwnerIds listesine Discord kullanıcı ID'nizi ekleyin.",
        ephemeral: true,
      });
      return;
    }

    if (!premiumStore.isEnabled()) {
      await interaction.reply({
        content: "Premium sistemi şu anda etkin değil.",
        ephemeral: true,
      });
      return;
    }

    const value = interaction.options.getInteger("sure", true);
    const unit = interaction.options.getString("birim", true);
    const durationDays = daysFromValue(value, unit);

    if (!durationDays || durationDays <= 0) {
      await interaction.reply({
        content: "Geçerli bir süre değeri belirtmeniz gerekiyor.",
        ephemeral: true,
      });
      return;
    }

    const result = premiumStore.generateLicense(durationDays, {
      createdBy: interaction.user.id,
    });

    if (!result.success) {
      let content = "Lisans anahtarı oluşturulamadı.";

      if (result.reason === "INVALID_DURATION") {
        content = "Geçerli bir süre değeri belirtmeniz gerekiyor.";
      } else if (result.reason === "DISABLED") {
        content = "Premium sistemi şu anda etkin değil.";
      }

      await interaction.reply({ content, ephemeral: true });
      return;
    }

    const expiresAt = new Date(Date.now() + result.durationDays * DAY_IN_MS);
    const embed = new EmbedBuilder()
      .setColor("#facc15")
      .setTitle("Yeni Premium Lisansı")
      .setDescription("Anahtar bir kez kullanılabilir ve belirtilen süre boyunca geçerlidir.")
      .addFields(
        { name: "Lisans Anahtarı", value: `\`${result.licenseKey}\`` },
        {
          name: "Süre",
          value: formatDurationLabel(result.durationDays) ?? `${result.durationDays} gün`,
          inline: true,
        },
        {
          name: "Son Kullanma",
          value: expiresAt.toLocaleDateString("tr-TR"),
          inline: true,
        },
      )
      .setFooter({
        text: "Anahtar kullanıldığında otomatik olarak devre dışı kalır.",
      });

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
