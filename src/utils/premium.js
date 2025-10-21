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

function formatDate(iso) {
  if (!iso) {
    return null;
  }

  const parsed = new Date(iso);
  if (!Number.isFinite(parsed.getTime())) {
    return null;
  }

  return parsed.toLocaleDateString("tr-TR");
}

function formatRemaining(expiresAt) {
  if (!expiresAt) {
    return null;
  }

  const expiry = new Date(expiresAt);
  if (!Number.isFinite(expiry.getTime())) {
    return null;
  }

  const now = new Date();
  const diff = expiry.getTime() - now.getTime();

  if (diff <= 0) {
    return "Süresi doldu";
  }

  const remainingDays = Math.ceil(diff / (1000 * 60 * 60 * 24));
  return `${remainingDays} gün`;
}

function buildPremiumEmbed(guildId) {
  const { isPremium, licenseKey, activatedAt, expiresAt, expired } =
    premiumStore.getGuildStatus(guildId);
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

  if (licenseKey) {
    const activatedLabel = formatDate(activatedAt) ?? "Bilinmiyor";
    const expiresLabel = expiresAt ? formatDate(expiresAt) : "Süresiz";
    const remaining = formatRemaining(expiresAt);
    const licenseMetadata = premiumStore.getLicenseMetadata(licenseKey);
    const durationLabel = licenseMetadata?.durationDays
      ? `${licenseMetadata.durationDays} gün`
      : "Süresiz";

    const details = [
      `🔐 \`${licenseKey}\``,
      `• Başlangıç: ${activatedLabel}`,
      `• Süre: ${durationLabel}`,
      `• Bitiş: ${expiresLabel}`,
    ];

    if (remaining) {
      details.push(`• Kalan: ${remaining}`);
    }

    embed.addFields({
      name: isPremium ? "Aktif Lisans" : expired ? "Süresi Dolan Lisans" : "Lisans Bilgisi",
      value: details.join("\n"),
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

  const { isPremium, expired } = premiumStore.getGuildStatus(guildId);
  const button = new ButtonBuilder()
    .setCustomId(BUTTON_REDEEM)
    .setStyle(ButtonStyle.Primary)
    .setLabel(
      isPremium && !expired ? "Yeni Lisans Kullan" : "Premium Anahtarı Kullan",
    );

  return [new ActionRowBuilder().addComponents(button)];
}

module.exports = {
  BUTTON_REDEEM,
  buildPremiumEmbed,
  buildPremiumComponents,
};
