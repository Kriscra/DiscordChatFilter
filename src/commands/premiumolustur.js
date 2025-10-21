const { EmbedBuilder } = require("discord.js");
const premiumStore = require("../database/premiumStore");
const { DAY_IN_MS, formatDurationLabel, parseDurationArgs } = require("../utils/duration");
const { getOwnerIds, isBotOwner } = require("../utils/permissions");

function buildResponseEmbed(result) {
  const expiresAt = new Date(Date.now() + result.durationDays * DAY_IN_MS);
  const formattedExpiry = expiresAt.toLocaleDateString("tr-TR");
  const durationLabel = formatDurationLabel(result.durationDays);

  return new EmbedBuilder()
    .setColor("#facc15")
    .setTitle("Yeni Premium Lisansı")
    .setDescription(
      [
        "Aşağıdaki lisans anahtarını sadece yetkili kişilerle paylaşın.",
        "Anahtar bir kez kullanılabilir ve belirtilen süre boyunca geçerlidir.",
      ].join("\n"),
    )
    .addFields(
      { name: "Lisans Anahtarı", value: `\`${result.licenseKey}\`` },
      {
        name: "Süre",
        value: durationLabel ?? `${result.durationDays} gün`,
        inline: true,
      },
      { name: "Son Kullanma", value: formattedExpiry, inline: true },
    )
    .setFooter({
      text: "Anahtar kullanıldığında otomatik olarak devre dışı kalır.",
    });
}

module.exports = {
  name: "premiumolustur",
  aliases: ["premium-kod", "lisansolustur"],
  description: "Belirli bir süre için premium lisans anahtarı oluşturur.",
  async execute(client, message, args) {
    if (!isBotOwner(message.author?.id)) {
      const owners = getOwnerIds();
      const guidance = owners.length
        ? "Bu komutu yalnızca bot sahipleri kullanabilir."
        : "Bu komutu kullanabilmek için config.js dosyasındaki Bot.OwnerIds listesine Discord kullanıcı ID'nizi ekleyin.";
      await message.reply({
        content: guidance,
      });
      return;
    }

    if (!premiumStore.isEnabled()) {
      await message.reply({
        content: "Premium sistemi şu anda etkin değil.",
      });
      return;
    }

    const durationDays = parseDurationArgs(args);

    if (!durationDays || durationDays <= 0) {
      await message.reply({
        content:
          "Lütfen geçerli bir süre belirtin. Örnek kullanım: `.premiumolustur 30`, `.premiumolustur 6 ay`, `.premiumolustur 1y`.",
      });
      return;
    }

    const result = premiumStore.generateLicense(durationDays, {
      createdBy: message.author.id,
    });

    if (!result.success) {
      let content = "Lisans anahtarı oluşturulamadı.";

      if (result.reason === "INVALID_DURATION") {
        content = "Geçerli bir süre değeri belirtmeniz gerekiyor.";
      } else if (result.reason === "DISABLED") {
        content = "Premium sistemi şu anda etkin değil.";
      }

      await message.reply({ content });
      return;
    }

    const embed = buildResponseEmbed(result);

    await message.reply({ embeds: [embed] });
  },
};
