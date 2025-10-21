const path = require("path");
const express = require("express");
const session = require("express-session");
const passport = require("passport");
const { Strategy: DiscordStrategy } = require("passport-discord");
const config = require("../config");
const filterStore = require("../database/filterStore");

const ADMINISTRATOR_PERMISSION = BigInt(0x00000008);
let isStarted = false;

const COMMAND_CATALOG = [
  {
    name: "!filitre /filitre",
    type: "Mesaj & Slash",
    description: "Filtre yönetim menüsünü açar ve kelime butonlarını sunar.",
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
    isHome: true,
  });
}

function renderDashboard(req, res, client) {
  const guilds = getAdminGuilds(req.user, client);

  res.render("dashboard", {
    guilds,
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

  res.render("guild", {
    guild,
    words,
    flashMessage,
    flashType,
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

    const word = (req.body.word ?? "").trim();
    const action = req.body.action;

    if (!word) {
      req.session.dashboardMessage = "Lütfen geçerli bir kelime girin.";
      req.session.dashboardMessageType = "error";
      res.redirect(`/dashboard/${req.params.guildId}`);
      return;
    }

    if (action === "add") {
      const result = filterStore.addWord(guild.id, word);
      if (result.added) {
        req.session.dashboardMessage = "Kelime başarıyla eklendi.";
        req.session.dashboardMessageType = "success";
      } else {
        req.session.dashboardMessage =
          result.reason === "DUPLICATE"
            ? "Bu kelime zaten kayıtlı."
            : "Kelime eklenemedi. Lütfen tekrar deneyin.";
        req.session.dashboardMessageType = "error";
      }
    } else if (action === "remove") {
      const result = filterStore.removeWord(guild.id, word);
      if (result.removed) {
        req.session.dashboardMessage = "Kelime başarıyla kaldırıldı.";
        req.session.dashboardMessageType = "success";
      } else {
        req.session.dashboardMessage =
          result.reason === "NOT_FOUND"
            ? "Bu kelime sistemde kayıtlı değil."
            : "Kelime silinirken bir hata oluştu.";
        req.session.dashboardMessageType = "error";
      }
    } else {
      req.session.dashboardMessage = "Geçersiz işlem.";
      req.session.dashboardMessageType = "error";
    }

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
