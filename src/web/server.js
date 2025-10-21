const path = require("path");
const express = require("express");
const session = require("express-session");
const passport = require("passport");
const { Strategy: DiscordStrategy } = require("passport-discord");
const { ChannelType } = require("discord.js");
const config = require("../config");
const filterStore = require("../database/filterStore");
const premiumStore = require("../database/premiumStore");
const { DAY_IN_MS, formatDurationLabel } = require("../utils/duration");
const { normalizeWordInput } = require("../utils/text");

const ADMINISTRATOR_PERMISSION = BigInt(0x00000008);
let isStarted = false;

const FEATURE_SPOTLIGHTS = [
  {
    icon: "🛡️",
    title: "Dinamik filtre çekirdeği",
    description:
      "Kelime listelerinizi tek panelden yönetin, bot ve dashboard arasında saniyeler içinde eşitleyin.",
    bullets: [
      "Toplu kelime ekleme ve temizleme işlemleri",
      "Otomatik kural eşleştirme ve ihlal silme",
      "Premium limitlerle genişleyen kapasite",
    ],
  },
  {
    icon: "#️⃣",
    title: "Muafiyet katmanı",
    description:
      "Belirli kanallar ve rolleri filtrelemeyi atlayarak ekip sohbetlerini özgür bırakın.",
    bullets: [
      "Kanal bazlı filtre kapatma",
      "Rol tabanlı yetkili muafiyetleri",
      "Tek tıkla yönetim ve gerçek zamanlı kayıt",
    ],
  },
  {
    icon: "🗂️",
    title: "Profesyonel dashboard",
    description:
      "Modern ve erişilebilir arayüz ile tüm sunucu yapılandırmalarınızı tek yerde toplayın.",
    bullets: [
      "OAuth2 tabanlı güvenli giriş",
      "Şeffaf premium durum kartları",
      "Detaylı kullanım rehberleri ve komut katalogları",
    ],
  },
];

const FEATURE_SCHEMATICS = [
  {
    title: "Filtreleme akış şeması",
    lead:
      "Bir mesaj gönderildiğinde Chat Filter üç aşamalı kontrol uygular ve sonuçları anında yansıtır.",
    steps: [
      {
        label: "1",
        title: "Giriş tespiti",
        description:
          "Mesaj içeriği, gönderildiği kanal ve kullanıcının rolleri gerçek zamanlı olarak okunur.",
      },
      {
        label: "2",
        title: "Muafiyet katmanı",
        description:
          "Kanal veya role özel muafiyet listeleri değerlendirilir; kayıtlı eşleşmeler varsa filtreleme atlanır.",
      },
      {
        label: "3",
        title: "Kelime eşleştirme",
        description:
          "Normalleştirilmiş kelime listesi ile içerik karşılaştırılır; eşleşme varsa mesaj güvenli şekilde kaldırılır.",
      },
    ],
  },
  {
    title: "Dashboard veri akışı",
    lead:
      "Panelde yaptığınız her değişiklik kalıcı depoya yazılır ve bot ile anında senkron edilir.",
    steps: [
      {
        label: "A",
        title: "Yetki denetimi",
        description:
          "Discord OAuth oturumu doğrulanır, yalnızca yönetici yetkisine sahip sunucular listelenir.",
      },
      {
        label: "B",
        title: "Form gönderimi",
        description:
          "Kelime, kanal veya rol formları gönderildiğinde girdiler temizlenir ve güvenli sınırlara çekilir.",
      },
      {
        label: "C",
        title: "Kalıcı kayıt",
        description:
          "Güncel yapılandırma RacheDB üzerine yazılır, bot olay dinleyicileri yeni ayarları anında kullanır.",
      },
    ],
  },
  {
    title: "Premium lisans süreci",
    lead:
      "Premium anahtar oluşturma ve kullanım akışı takip edilerek süre sonlarına kadar koruma sağlanır.",
    steps: [
      {
        label: "I",
        title: "Lisans üretimi",
        description:
          "Sahip komutları süreli anahtarlar üretir, geçerlilik ve kullanım limitleri meta veriye kaydedilir.",
      },
      {
        label: "II",
        title: "Aktivasyon",
        description:
          "Anahtar panel veya komut ile kullanıldığında sunucunun kotası yükseltilir ve zamanlayıcı başlatılır.",
      },
      {
        label: "III",
        title: "Gözetim",
        description:
          "Süre bitimine kadar kalan günler takip edilir, sona erdiğinde plan otomatik olarak standart seviyeye iner.",
      },
    ],
  },
];

const PREMIUM_FEATURES = [
  {
    icon: "💎",
    title: "Genişletilmiş kelime kotası",
    description:
      "Standart plan sınırlarını aşarak yüzlerce kelimeyi tek panelde yönetebilirsiniz.",
  },
  {
    icon: "📈",
    title: "Detaylı raporlar",
    description:
      "Yakında gelecek istatistikler ve ihlal raporları ile moderasyon kararlarınızı güçlendirin.",
  },
  {
    icon: "🎨",
    title: "Özel tema seçenekleri",
    description:
      "Dashboard üzerinde premium temaları ve özelleştirilmiş görünümü etkinleştirin.",
  },
];

const COMMAND_DETAILS = [
  {
    name: "!filtre /filtre",
    type: "Mesaj & Slash",
    usage: "!filtre",
    description:
      "Kelime listesini, muaf kanalları ve muaf rolleri yönetmek için etkileşimli menü açar.",
    notes: [
      "Toplu kelime ekleme & silme modalları",
      "#️⃣ kanal ve 🛡️ rol muafiyet seçimleri",
      "Güncel listeyi gizli olarak görüntüleme",
    ],
  },
  {
    name: "!yardım /yardım",
    type: "Mesaj & Slash",
    usage: "!yardım",
    description:
      "Tüm komutların açıklamalarını, kullanım örneklerini ve destek bağlantılarını listeler.",
    notes: [
      "Slash ve mesaj komutlarının ayrıntılı dökümü",
      "Premium avantajları hakkında kısa özet",
    ],
  },
  {
    name: "!premium /premium",
    type: "Mesaj & Slash",
    usage: "!premium",
    description:
      "Sunucunun premium durumunu, lisans geçerlilik tarihlerini ve kalan gün sayısını gösterir.",
    notes: [
      "Aktif lisans bilgisi ve statü rozetleri",
      "Geçersiz anahtarlar için yönlendirici uyarılar",
    ],
  },
  {
    name: "!premiumolustur /premiumkod",
    type: "Mesaj & Slash",
    usage: "!premiumolustur 30d",
    description:
      "Bot sahiplerinin belirli gün sayısı kadar geçerli premium anahtar üretmesine izin verir.",
    notes: [
      "Otomatik süre hesaplama ve tek kullanımlık anahtarlar",
      "Aktarım geçmişi ve kullanım denetimi",
    ],
  },
  {
    name: "!ping /ping",
    type: "Mesaj & Slash",
    usage: "!ping",
    description:
      "Botun gecikme süresini ölçerek API durumunu ve dashboard senkronizasyonunu doğrular.",
    notes: ["API ping, websocket gecikmesi ve hazır olma kontrolleri"],
  },
  {
    name: "!invite /invite",
    type: "Mesaj & Slash",
    usage: "!invite",
    description:
      "Botu yeni bir sunucuya eklemek için davet bağlantısı sağlar ve gerekli izinleri açıklar.",
    notes: ["OAuth yetkilendirme bağlantısı", "Önerilen izinler listesi"],
  },
];

const COMMAND_CATALOG = COMMAND_DETAILS.map(({ name, type, description }) => ({
  name,
  type,
  description,
}));

const COMMAND_WORKFLOWS = [
  {
    title: "Filtre komutu etkileşim akışı",
    steps: [
      {
        title: "Komutu çalıştır",
        description:
          "!filtre komutunu gönderin veya slash komutundan seçin; etkileşimli kontrol paneli anında açılır.",
      },
      {
        title: "Kelime ve muafiyetleri düzenle",
        description:
          "Eklemek için formu doldurun, kaldırmak için listedeki kelimeleri seçin, kanal ve rol muafiyetlerini seçicilerden işaretleyin.",
      },
      {
        title: "Sonuçları doğrula",
        description:
          "Bot her işlem sonrası özet mesaj gönderir ve yeni yapılandırmayı tüm sunucuya uygular.",
      },
    ],
  },
  {
    title: "Premium yönetim süreci",
    steps: [
      {
        title: "Durumu kontrol et",
        description:
          "!premium komutu aktif lisans, kalan gün ve kotayı gösterir.",
      },
      {
        title: "Anahtar oluştur",
        description:
          "Sahipler !premiumolustur komutu ile örneğin 30 gün geçerli anahtar üretir.",
      },
      {
        title: "Anahtarı kullan",
        description:
          "Yetkili yöneticiler !premium komutundaki buton ile veya panelden anahtarı girerek yükseltmeyi tamamlar.",
      },
    ],
  },
];

function hasAdministratorPermission(guild) {
  if (!guild) {
    return false;
  }

  const permissions = guild.permissions
    ? BigInt(guild.permissions)
    : BigInt(0);

  return (permissions & ADMINISTRATOR_PERMISSION) === ADMINISTRATOR_PERMISSION;
}

function getAdminGuilds(user, client) {
  const guilds = Array.isArray(user?.guilds) ? user.guilds : [];

  return guilds
    .filter((guild) => hasAdministratorPermission(guild))
    .filter((guild) => client.guilds.cache.has(guild.id));
}

function formatWordLimitLabel(limit) {
  return limit === Infinity ? "sınırsız" : `${limit} kelime`;
}

function summarizeAddResult(guildId, result) {
  const parts = [];
  let type = result.added.length ? "success" : "error";

  if (result.added.length) {
    const preview = result.added
      .slice(0, 5)
      .map((word) => `\`${word}\``)
      .join(", ");

    parts.push(
      result.added.length > 5
        ? `${result.added.length} kelime eklendi (${preview}...)`
        : `Eklenen kelimeler: ${preview}`,
    );
  }

  if (result.duplicates.length) {
    const preview = result.duplicates
      .slice(0, 5)
      .map((word) => `\`${word}\``)
      .join(", ");

    parts.push(
      result.duplicates.length > 5
        ? `${result.duplicates.length} kelime zaten kayıtlı (${preview}...)`
        : `Zaten kayıtlı olanlar: ${preview}`,
    );
  }

  if (result.limitReached) {
    const limitLabel = formatWordLimitLabel(result.limit);
    const premiumHint =
      premiumStore.isEnabled() && !premiumStore.isPremium(guildId)
        ? ` Premium ile kapasitenizi ${formatWordLimitLabel(premiumStore.getPremiumLimit())} seviyesine yükseltebilirsiniz.`
        : "";
    parts.push(`Kelime kotanız ${limitLabel} seviyesine ulaştı.${premiumHint}`);
  }

  if (!parts.length) {
    parts.push("Geçerli kelimeler girmeniz gerekiyor.");
    type = "error";
  }

  return { message: parts.join(" "), type };
}

function summarizeRemoveResult(result) {
  const parts = [];
  let type = result.removed.length ? "success" : "error";

  if (result.removed.length) {
    const preview = result.removed
      .slice(0, 5)
      .map((word) => `\`${word}\``)
      .join(", ");

    parts.push(
      result.removed.length > 5
        ? `${result.removed.length} kelime kaldırıldı (${preview}...)`
        : `Kaldırılan kelimeler: ${preview}`,
    );
  }

  if (result.notFound.length) {
    const preview = result.notFound
      .slice(0, 5)
      .map((word) => `\`${word}\``)
      .join(", ");

    parts.push(
      result.notFound.length > 5
        ? `${result.notFound.length} kelime bulunamadı (${preview}...)`
        : `Bulunamayan kelimeler: ${preview}`,
    );
  }

  if (!parts.length) {
    parts.push("Belirtilen kelimeler bulunamadı.");
  }

  return { message: parts.join(" "), type };
}

function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated?.()) {
    return next();
  }

  return res.redirect("/");
}

function ensureDashboardConfigured() {
  const dashboardConfig = config.Dashboard ?? {};
  const { ClientId, ClientSecret, CallbackURL, SessionSecret } = dashboardConfig;

  return Boolean(ClientId && ClientSecret && CallbackURL && SessionSecret);
}

function getInviteUrl() {
  const clientId = config.Dashboard?.ClientId ?? config.Bot?.ClientId;

  if (!clientId || clientId === "DISCORD_BOT_TOKEN") {
    return null;
  }

  const scopes = encodeURIComponent("bot applications.commands");
  const permissions = "268510208";

  return `https://discord.com/oauth2/authorize?client_id=${clientId}&scope=${scopes}&permissions=${permissions}`;
}

function configurePassport() {
  const dashboardConfig = config.Dashboard;

  passport.use(
    new DiscordStrategy(
      {
        clientID: dashboardConfig.ClientId,
        clientSecret: dashboardConfig.ClientSecret,
        callbackURL: dashboardConfig.CallbackURL,
        scope: ["identify", "guilds"],
      },
      (accessToken, refreshToken, profile, done) => done(null, profile),
    ),
  );

  passport.serializeUser((user, done) => done(null, user));
  passport.deserializeUser((obj, done) => done(null, obj));
}

function renderHome(req, res) {
  res.render("home", {
    featureSpotlights: FEATURE_SPOTLIGHTS,
    commandHighlights: COMMAND_CATALOG.slice(0, 3),
    schematics: FEATURE_SCHEMATICS.slice(0, 1),
    premiumFeatures: PREMIUM_FEATURES,
    premiumEnabled: premiumStore.isEnabled(),
    defaultLimitLabel: formatWordLimitLabel(premiumStore.getDefaultLimit()),
    premiumLimitLabel: formatWordLimitLabel(premiumStore.getPremiumLimit()),
    inviteUrl: getInviteUrl(),
    isHome: true,
  });
}

function renderDashboard(req, res, client) {
  const guilds = getAdminGuilds(req.user, client);

  res.render("dashboard", {
    guilds,
    premiumEnabled: premiumStore.isEnabled(),
    defaultLimitLabel: formatWordLimitLabel(premiumStore.getDefaultLimit()),
    premiumLimitLabel: formatWordLimitLabel(premiumStore.getPremiumLimit()),
    inviteUrl: getInviteUrl(),
  });
}

function renderGuildDashboard(req, res, client, guildId) {
  const guilds = getAdminGuilds(req.user, client);
  const guild = guilds.find((g) => g.id === guildId);

  if (!guild) {
    res.status(403).render("error", {
      title: "Yetkisiz İşlem",
      message: "Bu sunucuyu yönetme yetkiniz yok.",
      backLink: "/dashboard",
    });
    return;
  }

  const words = filterStore.getWords(guildId);
  const exemptChannels = filterStore.getExemptChannels(guildId);
  const exemptRoles = filterStore.getExemptRoles(guildId);
  const flashMessage = req.session.dashboardMessage;
  const flashType = req.session.dashboardMessageType;
  delete req.session.dashboardMessage;
  delete req.session.dashboardMessageType;

  const premiumStatus = premiumStore.getGuildStatus(guildId);
  const premiumLicense = premiumStatus.licenseKey
    ? premiumStore.getLicenseMetadata(premiumStatus.licenseKey)
    : null;
  const activatedAt = premiumStatus.activatedAt
    ? new Date(premiumStatus.activatedAt)
    : null;
  const expiresAt = premiumStatus.expiresAt
    ? new Date(premiumStatus.expiresAt)
    : null;
  const activatedLabel =
    activatedAt && Number.isFinite(activatedAt.getTime())
      ? activatedAt.toLocaleDateString("tr-TR")
      : null;
  const expiresLabel =
    expiresAt && Number.isFinite(expiresAt.getTime())
      ? expiresAt.toLocaleDateString("tr-TR")
      : null;
  let remainingLabel = null;
  if (expiresAt && Number.isFinite(expiresAt.getTime())) {
    const diff = expiresAt.getTime() - Date.now();
    if (diff <= 0) {
      remainingLabel = "Süresi doldu";
    } else {
      const remainingDays = Math.ceil(diff / DAY_IN_MS);
      remainingLabel = `${remainingDays} gün`;
    }
  }
  const durationLabel = premiumLicense?.durationDays
    ? formatDurationLabel(premiumLicense.durationDays) ??
      `${premiumLicense.durationDays} gün`
    : null;
  const wordLimit = filterStore.getWordLimit(guildId);
  const defaultLimit = premiumStore.getDefaultLimit();
  const premiumLimit = premiumStore.getPremiumLimit();
  const remainingSlots =
    wordLimit === Infinity ? null : Math.max(wordLimit - words.length, 0);

  const liveGuild = client.guilds.cache.get(guildId);
  const channelOptions = [];
  const roleOptions = [];

  if (liveGuild) {
    liveGuild.channels.cache
      .filter((channel) =>
        [
          ChannelType.GuildText,
          ChannelType.GuildAnnouncement,
          ChannelType.GuildVoice,
          ChannelType.GuildStageVoice,
          ChannelType.GuildForum,
        ].includes(channel.type),
      )
      .forEach((channel) => {
        channelOptions.push({
          id: channel.id,
          name: channel.name,
          type: channel.type,
          mentionPrefix:
            channel.type === ChannelType.GuildText ||
            channel.type === ChannelType.GuildAnnouncement
              ? "#"
              : "",
          exempt: exemptChannels.includes(channel.id),
        });
      });

    liveGuild.roles.cache
      .filter((role) => !role.managed && role.id !== liveGuild.id)
      .forEach((role) => {
        roleOptions.push({
          id: role.id,
          name: role.name,
          color: role.hexColor,
          exempt: exemptRoles.includes(role.id),
        });
      });
  }

  channelOptions.sort((a, b) => a.name.localeCompare(b.name, "tr"));
  roleOptions.sort((a, b) => a.name.localeCompare(b.name, "tr"));

  const channelLookup = new Map(channelOptions.map((channel) => [channel.id, channel]));
  const roleLookup = new Map(roleOptions.map((role) => [role.id, role]));

  const selectedChannels = exemptChannels.map((id) => {
    const meta = channelLookup.get(id);
    return (
      meta ?? {
        id,
        name: "Bilinmeyen Kanal",
        mentionPrefix: "#",
        exempt: true,
        missing: true,
      }
    );
  });

  const selectedRoles = exemptRoles.map((id) => {
    const meta = roleLookup.get(id);
    return (
      meta ?? {
        id,
        name: "Silinmiş Rol",
        color: "#5865F2",
        exempt: true,
        missing: true,
      }
    );
  });

  res.render("guild", {
    guild,
    words,
    channelOptions,
    roleOptions,
    selectedChannels,
    selectedRoles,
    flashMessage,
    flashType,
    premiumEnabled: premiumStore.isEnabled(),
    premiumStatus,
    premiumLicense,
    wordLimit,
    defaultLimit,
    premiumLimit,
    wordLimitLabel: formatWordLimitLabel(wordLimit),
    defaultLimitLabel: formatWordLimitLabel(defaultLimit),
    premiumLimitLabel: formatWordLimitLabel(premiumLimit),
    remainingSlots,
    premiumActivatedLabel: activatedLabel,
    premiumExpiresLabel: expiresLabel,
    premiumRemainingLabel: remainingLabel,
    premiumDurationLabel: durationLabel,
    inviteUrl: getInviteUrl(),
  });
}

function renderFeatures(req, res) {
  res.render("features", {
    featureSpotlights: FEATURE_SPOTLIGHTS,
    schematics: FEATURE_SCHEMATICS,
    inviteUrl: getInviteUrl(),
  });
}

function renderCommands(req, res) {
  res.render("commands", {
    commands: COMMAND_DETAILS,
    workflows: COMMAND_WORKFLOWS,
    defaultLimitLabel: formatWordLimitLabel(premiumStore.getDefaultLimit()),
    premiumLimitLabel: formatWordLimitLabel(premiumStore.getPremiumLimit()),
    inviteUrl: getInviteUrl(),
  });
}

function startDashboard(client) {
  if (isStarted) {
    return null;
  }

  if (!ensureDashboardConfigured()) {
    console.warn(
      "[Dashboard] Gerekli yapılandırma bulunamadı. Dashboard başlatılmayacak.",
    );
    return null;
  }

  configurePassport();

  const app = express();
  const { SessionSecret, Port } = config.Dashboard;

  app.set("trust proxy", 1);
  app.set("views", path.join(__dirname, "views"));
  app.set("view engine", "ejs");

  app.use("/static", express.static(path.join(__dirname, "public")));
  app.use(
    session({
      secret: SessionSecret,
      resave: false,
      saveUninitialized: false,
    }),
  );
  app.use(express.urlencoded({ extended: false }));
  app.use(passport.initialize());
  app.use(passport.session());
  app.use((req, res, next) => {
    res.locals.user = req.user;
    res.locals.isAuthenticated = req.isAuthenticated?.() ?? false;
    res.locals.currentYear = new Date().getFullYear();
    res.locals.isHome = false;
    res.locals.currentPath = req.path;
    res.locals.inviteUrl = getInviteUrl();
    if (req.user) {
      const discriminator =
        typeof req.user.discriminator === "string" &&
        req.user.discriminator !== "0"
          ? `#${req.user.discriminator}`
          : "";
      const avatarUrl = req.user.avatar
        ? `https://cdn.discordapp.com/avatars/${req.user.id}/${req.user.avatar}.png?size=128`
        : `https://cdn.discordapp.com/embed/avatars/${
            Number(req.user.discriminator ?? 0) % 5
          }.png`;

      res.locals.profile = {
        tag: `${req.user.username ?? "Kullanıcı"}${discriminator}`,
        avatarUrl,
      };
    } else {
      res.locals.profile = null;
    }
    next();
  });

  app.get("/", (req, res) => renderHome(req, res));
  app.get("/ozellikler", (req, res) => renderFeatures(req, res));
  app.get("/komutlar", (req, res) => renderCommands(req, res));
  app.get("/dashboard", ensureAuthenticated, (req, res) =>
    renderDashboard(req, res, client),
  );
  app.get("/dashboard/:guildId", ensureAuthenticated, (req, res) =>
    renderGuildDashboard(req, res, client, req.params.guildId),
  );

  app.post("/dashboard/:guildId/words", ensureAuthenticated, (req, res) => {
    const guilds = getAdminGuilds(req.user, client);
    const guild = guilds.find((g) => g.id === req.params.guildId);

    if (!guild) {
      req.session.dashboardMessage = "Bu sunucuyu yönetme yetkiniz yok.";
      req.session.dashboardMessageType = "error";
      res.redirect(`/dashboard/${req.params.guildId}`);
      return;
    }

    const action = req.body.action;
    const words = normalizeWordInput(req.body.words ?? req.body.word);

    if (!words.length) {
      req.session.dashboardMessage = "Lütfen en az bir kelime girin.";
      req.session.dashboardMessageType = "error";
      res.redirect(`/dashboard/${req.params.guildId}`);
      return;
    }

    if (action === "add") {
      const result = filterStore.addWords(guild.id, words);
      const summary = summarizeAddResult(guild.id, result);
      req.session.dashboardMessage = summary.message;
      req.session.dashboardMessageType = summary.type;
    } else if (action === "remove") {
      const result = filterStore.removeWords(guild.id, words);
      const summary = summarizeRemoveResult(result);
      req.session.dashboardMessage = summary.message;
      req.session.dashboardMessageType = summary.type;
    } else {
      req.session.dashboardMessage = "Geçersiz işlem.";
      req.session.dashboardMessageType = "error";
    }

    res.redirect(`/dashboard/${req.params.guildId}`);
  });

  app.post(
    "/dashboard/:guildId/exemptions/channels",
    ensureAuthenticated,
    (req, res) => {
      const guilds = getAdminGuilds(req.user, client);
      const guild = guilds.find((g) => g.id === req.params.guildId);

      if (!guild) {
        req.session.dashboardMessage = "Bu sunucuyu yönetme yetkiniz yok.";
        req.session.dashboardMessageType = "error";
        res.redirect(`/dashboard/${req.params.guildId}`);
        return;
      }

      const selections = req.body.channels;
      const channelIds = Array.isArray(selections)
        ? selections
        : selections
        ? [selections]
        : [];

      const result = filterStore.setExemptChannels(guild.id, channelIds);

      req.session.dashboardMessage = result.channels.length
        ? `${result.channels.length} kanal filtre kontrolünden muaf tutuluyor.`
        : "Muaf kanal bulunmuyor. Tüm kanallarda filtre aktif.";
      req.session.dashboardMessageType = "success";

      res.redirect(`/dashboard/${req.params.guildId}`);
    },
  );

  app.post(
    "/dashboard/:guildId/exemptions/roles",
    ensureAuthenticated,
    (req, res) => {
      const guilds = getAdminGuilds(req.user, client);
      const guild = guilds.find((g) => g.id === req.params.guildId);

      if (!guild) {
        req.session.dashboardMessage = "Bu sunucuyu yönetme yetkiniz yok.";
        req.session.dashboardMessageType = "error";
        res.redirect(`/dashboard/${req.params.guildId}`);
        return;
      }

      const selections = req.body.roles;
      const roleIds = Array.isArray(selections)
        ? selections
        : selections
        ? [selections]
        : [];

      const result = filterStore.setExemptRoles(guild.id, roleIds);

      req.session.dashboardMessage = result.roles.length
        ? `${result.roles.length} rol filtre kontrolünden muaf tutuluyor.`
        : "Muaf rol bulunmuyor. Tüm roller filtreye tabi.";
      req.session.dashboardMessageType = "success";

      res.redirect(`/dashboard/${req.params.guildId}`);
    },
  );

  app.post("/dashboard/:guildId/premium", ensureAuthenticated, (req, res) => {
    const guilds = getAdminGuilds(req.user, client);
    const guild = guilds.find((g) => g.id === req.params.guildId);

    if (!guild) {
      req.session.dashboardMessage = "Bu sunucuyu yönetme yetkiniz yok.";
      req.session.dashboardMessageType = "error";
      res.redirect(`/dashboard/${req.params.guildId}`);
      return;
    }

    if (!premiumStore.isEnabled()) {
      req.session.dashboardMessage = "Premium sistemi şu anda etkin değil.";
      req.session.dashboardMessageType = "error";
      res.redirect(`/dashboard/${req.params.guildId}`);
      return;
    }

    const licenseKey = (req.body.licenseKey ?? req.body.license ?? "").trim();

    if (!licenseKey) {
      req.session.dashboardMessage = "Lütfen lisans anahtarını girin.";
      req.session.dashboardMessageType = "error";
      res.redirect(`/dashboard/${req.params.guildId}`);
      return;
    }

    const result = premiumStore.redeemLicense(guild.id, licenseKey);

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
        default:
          break;
      }

      req.session.dashboardMessage = message;
      req.session.dashboardMessageType = "error";
      res.redirect(`/dashboard/${req.params.guildId}`);
      return;
    }

    req.session.dashboardMessage = "Premium lisansı başarıyla etkinleştirildi.";
    req.session.dashboardMessageType = "success";
    res.redirect(`/dashboard/${req.params.guildId}`);
  });

  app.get("/auth/discord", passport.authenticate("discord"));
  app.get(
    "/auth/discord/callback",
    passport.authenticate("discord", {
      failureRedirect: "/",
    }),
    (req, res) => {
      res.redirect("/dashboard");
    },
  );

  app.get("/logout", (req, res, next) => {
    req.logout((error) => {
      if (error) {
        next(error);
        return;
      }

      req.session.destroy(() => {
        res.redirect("/");
      });
    });
  });

  app.use((err, req, res, next) => {
    console.error("[Dashboard] Bir hata oluştu:", err);
    res.status(500).render("error", {
      title: "Beklenmedik Hata",
      message: "Beklenmedik bir hata oluştu. Lütfen daha sonra tekrar deneyin.",
      backLink: req.isAuthenticated?.() ? "/dashboard" : "/",
    });
  });

  const server = app.listen(Port ?? 3000, () => {
    console.log(
      `[Dashboard] Web arayüzü ${Port ?? 3000} portu üzerinden hizmet veriyor.`,
    );
  });

  isStarted = true;
  return server;
}

module.exports = {
  startDashboard,
};
