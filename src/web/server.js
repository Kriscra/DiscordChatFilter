const express = require("express");
const session = require("express-session");
const passport = require("passport");
const { Strategy: DiscordStrategy } = require("passport-discord");
const config = require("../config");
const filterStore = require("../database/filterStore");

const ADMINISTRATOR_PERMISSION = BigInt(0x00000008);
let isStarted = false;

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

function formatLayout(content, user) {
  const authSection = user
    ? `<div class="user">Giriş yapan: ${user.username}#${user.discriminator} | <a href="/logout">Çıkış Yap</a></div>`
    : "";

  return `<!DOCTYPE html>
<html lang="tr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Chat Filter Dashboard</title>
    <style>
      body { font-family: 'Segoe UI', Tahoma, sans-serif; margin: 0; padding: 0; background: #f4f6fb; color: #1f2937; }
      header { background: #3b82f6; color: white; padding: 1.5rem 2rem; }
      main { max-width: 960px; margin: 2rem auto; background: white; padding: 2rem; border-radius: 1rem; box-shadow: 0 25px 50px -12px rgba(59, 130, 246, 0.25); }
      h1 { margin-top: 0; }
      a.button { display: inline-block; padding: 0.75rem 1.5rem; background: #2563eb; color: white; border-radius: 0.75rem; text-decoration: none; font-weight: 600; }
      a.button:hover { background: #1d4ed8; }
      ul { list-style: none; padding: 0; }
      li.guild { padding: 0.75rem 1rem; border: 1px solid #e5e7eb; border-radius: 0.75rem; margin-bottom: 0.75rem; display: flex; justify-content: space-between; align-items: center; }
      li.guild span { font-weight: 600; }
      form { margin-top: 1.5rem; display: grid; gap: 1rem; }
      form .row { display: flex; gap: 0.75rem; }
      form input[type="text"] { flex: 1; padding: 0.75rem; border: 1px solid #d1d5db; border-radius: 0.75rem; }
      form button { padding: 0.75rem 1.5rem; border: none; border-radius: 0.75rem; background: #10b981; color: white; font-weight: 600; cursor: pointer; }
      form button.danger { background: #ef4444; }
      .words { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 1rem; }
      .chip { padding: 0.35rem 0.75rem; background: #e0f2fe; color: #1d4ed8; border-radius: 999px; font-size: 0.875rem; }
      .empty { padding: 1rem; background: #f1f5f9; border-radius: 0.75rem; }
      .message { padding: 1rem; border-radius: 0.75rem; margin-bottom: 1rem; }
      .message.success { background: #dcfce7; color: #166534; }
      .message.error { background: #fee2e2; color: #991b1b; }
      .user { margin-bottom: 1rem; font-weight: 600; }
    </style>
  </head>
  <body>
    <header>
      <h1>Chat Filter Dashboard</h1>
    </header>
    <main>
      ${authSection}
      ${content}
    </main>
  </body>
</html>`;
}

function renderHome(req, res) {
  if (req.isAuthenticated?.()) {
    const content = `<p>Sunucu filtrelerini yönetmek için aşağıdaki butona tıklayın.</p>
<a class="button" href="/dashboard">Sunucularım</a>`;

    res.send(formatLayout(content, req.user));
    return;
  }

  const content = `<p>Discord hesabınız ile giriş yaparak filtreleri yönetebilirsiniz.</p>
<a class="button" href="/auth/discord">Discord ile Giriş Yap</a>`;

  res.send(formatLayout(content));
}

function renderDashboard(req, res, client) {
  const guilds = getAdminGuilds(req.user, client);

  if (!guilds.length) {
    const content = `<p>Yönetici olduğunuz ve botun bulunduğu herhangi bir sunucu bulunamadı.</p>
<p>Lütfen botu davet ettiğinizden ve yönetici yetkisine sahip olduğunuzdan emin olun.</p>`;
    res.send(formatLayout(content, req.user));
    return;
  }

  const items = guilds
    .map(
      (guild) =>
        `<li class="guild"><span>${guild.name}</span> <a class="button" href="/dashboard/${guild.id}">Yönet</a></li>`,
    )
    .join("");

  const content = `<p>Filtreleri yönetmek istediğiniz sunucuyu seçin.</p>
<ul>${items}</ul>`;

  res.send(formatLayout(content, req.user));
}

function renderGuildDashboard(req, res, client, guildId) {
  const guilds = getAdminGuilds(req.user, client);
  const guild = guilds.find((g) => g.id === guildId);

  if (!guild) {
    res.status(403).send(
      formatLayout(
        `<div class="message error">Bu sunucuyu yönetme yetkiniz yok.</div>
<a class="button" href="/dashboard">Sunuculara Dön</a>`,
        req.user,
      ),
    );
    return;
  }

  const words = filterStore.getWords(guildId);
  const message = req.session.dashboardMessage;
  const messageType = req.session.dashboardMessageType;
  delete req.session.dashboardMessage;
  delete req.session.dashboardMessageType;

  const messageHtml = message
    ? `<div class="message ${messageType}">${message}</div>`
    : "";

  const wordsHtml = words.length
    ? `<div class="words">${words
        .map((word) => `<span class="chip">${word}</span>`)
        .join("")}</div>`
    : '<div class="empty">Bu sunucu için kayıtlı kelime bulunmuyor.</div>';

  const content = `${messageHtml}
<h2>${guild.name} Filtre Yönetimi</h2>
<p>Yeni kelimeler ekleyebilir veya mevcut kelimeleri çıkartabilirsiniz.</p>
${wordsHtml}
<form method="POST" action="/dashboard/${guildId}/words">
  <div class="row">
    <input type="text" name="word" placeholder="Kelime" maxlength="100" required />
    <button type="submit" name="action" value="add">Kelime Ekle</button>
    <button type="submit" name="action" value="remove" class="danger">Kelime Çıkart</button>
  </div>
</form>
<p><a class="button" href="/dashboard">Sunuculara Dön</a></p>`;

  res.send(formatLayout(content, req.user));
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
    res
      .status(500)
      .send(
        formatLayout(
          `<div class="message error">Beklenmedik bir hata oluştu. Lütfen daha sonra tekrar deneyin.</div>`,
          req.user,
        ),
      );
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
