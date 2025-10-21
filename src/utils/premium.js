const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} = require("discord.js");
const filterStore = require("../database/filterStore");
const premiumStore = require("../database/premiumStore");

const BUTTON_REDEEM = "premium:redeem";

function formatLimit(limit) {
  if (limit === Infinity) {
    return "Sınırsız";
  }

  return `${limit} kelime`;
}

function buildPremiumEmbed(guildId) {
  const { isPremium, licenseKey, activatedAt } = premiumStore.getGuildStatus(
    guildId,
  );
  const words = filterStore.getWords(guildId);
  const wordLimit = filterStore.getWordLimit(guildId);
  const defaultLimit = premiumStore.getDefaultLimit();
  const premiumLimit = premiumStore.getPremiumLimit();

  const planDescription = isPremium
    ? "Premium sayesinde artırılmış kelime kotası, öncelikli tasarımlar ve gelişmiş yönetim özelliklerine erişiminiz var."
    : "Standart planda kelime kotanız sınırlıdır. Premium anahtarınızı kullanarak kapasitenizi artırabilir ve yeni özelliklerin kilidini açabilirsiniz.";

  const embed = new EmbedBuilder()
    .setColor(isPremium ? "#facc15" : "#5f86ff")
    .setTitle("Chat Filter Premium")
    .setDescription(planDescription)
    .addFields(
      {
        name: "Plan",
        value: isPremium ? "💎 Premium" : "⚪ Standart",
        inline: true,
      },
      {
        name: "Kelime Kotası",
        value: `\`${words.length}\` / ${formatLimit(wordLimit)}`,
        inline: true,
      },
      {
        name: "Premium Avantajları",
        value: [
          `• Kelime kotası: ${formatLimit(premiumLimit)}`,
          "• Modern panel temaları ve istatistikler",
          "• Yakında: ayrıntılı ihlal raporları",
        ].join("\n"),
      },
    );

  if (!isPremium) {
    embed.addFields({
      name: "Standart Plan Sınırı",
      value: formatLimit(defaultLimit),
      inline: true,
    });
  }

  if (isPremium && licenseKey) {
    const activatedLabel = activatedAt
      ? new Date(activatedAt).toLocaleDateString("tr-TR")
      : "Bilinmiyor";
    embed.addFields({
      name: "Lisans Anahtarı",
      value: `🔐 \`${licenseKey}\` (Aktifleşme: ${activatedLabel})`,
    });
  }

  embed.setFooter({
    text: "Yalnızca yönetici yetkisi olan kullanıcılar lisans anahtarı kullanabilir.",
  });

  return embed;
}

function buildPremiumComponents(guildId) {
  if (!premiumStore.isEnabled()) {
    return [];
  }

  const { isPremium } = premiumStore.getGuildStatus(guildId);
  const button = new ButtonBuilder()
    .setCustomId(BUTTON_REDEEM)
    .setStyle(ButtonStyle.Primary)
    .setLabel(isPremium ? "Premium Aktif" : "Premium Anahtarı Kullan");

  if (isPremium) {
    button.setDisabled(true);
  }

  return [new ActionRowBuilder().addComponents(button)];
}

module.exports = {
  BUTTON_REDEEM,
  buildPremiumEmbed,
  buildPremiumComponents,
};
