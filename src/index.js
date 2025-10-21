const {
  Client,
  GatewayIntentBits,
  Partials,
} = require("discord.js");
const config = require("./config");
const { loadCommands } = require("./commands");
const { loadSlashCommands } = require("./slashCommands");
const { registerEvents } = require("./events");
const { startDashboard } = require("./web/server");
require("./database/filterStore");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [
    Partials.Channel,
    Partials.GuildMember,
    Partials.Message,
    Partials.Reaction,
    Partials.User,
  ],
});

loadCommands(client);
loadSlashCommands(client);
registerEvents(client);

startDashboard(client);

client.login(config.Bot.Token);

module.exports = client;
