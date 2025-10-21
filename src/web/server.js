const path = require("path");
const express = require("express");
const session = require("express-session");
const passport = require("passport");
const { Strategy: DiscordStrategy } = require("passport-discord");
const config = require("../config");
const filterStore = require("../database/filterStore");
const premiumStore = require("../database/premiumStore");
const { DAY_IN_MS, formatDurationLabel } = require("../utils/duration");
const { normalizeWordInput } = require("../utils/text");

const ADMINISTRATOR_PERMISSION = BigInt(0x00000008);
let isStarted = false;

const COMMAND_CATALOG = [
  {
    name: "!filtre /filtre",
    type: "Mesaj & Slash",
    description:
      "Toplu kelime ekleme, hızlı silme menüsü ve filtre listesine erişim sağlar.",
  },
  {
    name: "!yardım /yardım",
    type: "Mesaj & Slash",
    description: "Botun kullanım rehberini ve tüm komutların özetini gösterir.",
  },
  {
    name: "!ping /ping",
    type: "Mesaj & Slash",
    description: "Botun gecikme süresini ölçerek çevrim içi durumunu doğrular.",
  },
  {
    name: "!invite /invite",
    type: "Mesaj & Slash",
    description: "Sunucunuza botu eklemek için davet bağlantısı oluşturur.",
  },
  {
    name: "!premium /premium",
    type: "Mesaj & Slash",
    description:
      "Premium durumunu görüntüler ve lisans anahtarı kullanarak planınızı yükseltmenizi sağlar.",
  },
  {
    name: "!premiumolustur /premiumkod",
    type: "Mesaj & Slash",
    description:
      "Bot sahiplerinin süreli premium lisans anahtarları oluşturmasına olanak tanır.",
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
    commands: COMMAND_CATALOG,
    premiumFeatures: PREMIUM_FEATURES,
    premiumEnabled: premiumStore.isEnabled(),
    defaultLimitLabel: formatWordLimitLabel(premiumStore.getDefaultLimit()),
    premiumLimitLabel: formatWordLimitLabel(premiumStore.getPremiumLimit()),
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

  res.render("guild", {
    guild,
    words,
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
    next();
  });

  app.get("/", (req, res) => renderHome(req, res));
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
