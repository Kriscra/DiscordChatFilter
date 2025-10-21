const {
  Client,
  GatewayIntentBits,
  Partials,
} = require("discord.js");
const config = require("./config");
const { loadCommands } = require("./commands");
const { registerEvents } = require("./events");
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
registerEvents(client);

client.login(config.Bot.Token);

module.exports = client;
