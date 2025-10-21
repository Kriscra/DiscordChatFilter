module.exports = {
    Bot: {
        Token: "DISCORD_BOT_TOKEN",
        Prefix: ".",
        BotDurum: "Chat Filter",
        DurumTipi: "online",
        OwnerIds: ["YOUR_DISCORD_USER_ID"]
    },
    Dashboard: {
        ClientId: "DISCORD_CLIENT_ID",
        ClientSecret: "DISCORD_CLIENT_SECRET",
        CallbackURL: "http://localhost:3000/auth/discord/callback",
        SessionSecret: "super-secret-session-key",
        Port: 3000
    },
    Premium: {
        Enabled: true,
        DefaultLimit: 25,
        PremiumLimit: 250,
        LicenseKeys: ["CHATFILTER-PREMIUM-0001"]
    }
}
