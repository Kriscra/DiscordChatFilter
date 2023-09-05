const {EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle} = require("discord.js");
const config = require("../config.js");
const { diffieHellman } = require("crypto");

exports.run = async (client, message, args) => {




	const davet = new ButtonBuilder()
	.setLabel('Davet')
	.setURL('https://discord.com/api/oauth2/authorize?client_id=1121128528243605657&permissions=8&scope=bot')
	.setStyle(ButtonStyle.Link);
	const row = new ActionRowBuilder()
	.addComponents(davet);

const embed = new EmbedBuilder()
	.setColor("#009eff")
	.setTitle('Chat Filter')
	.setDescription(`

  Benim Anlık Gecikmem **[${client.ws.ping} MS](https://discord.com/api/oauth2/authorize?client_id=1121128528243605657&permissions=8&scope=bot)** dir.


  `)
	.setTimestamp()
	.setFooter({ text: 'Aşşagıdan beni ekleyebilirsiniz.'});

  message.channel.send({embeds: [embed], components: [row]})

};
exports.conf = {
  aliases: [""]
};

exports.help = {
  name: "ping"
};