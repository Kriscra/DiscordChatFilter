const {EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle} = require("discord.js");
const config = require("../config.js");
const { diffieHellman } = require("crypto");

exports.run = async (client, message, args) => {



	const ekle = new ButtonBuilder()
	.setCustomId('ekle')
	.setLabel('Filitre Kelime Ekle')
	.setStyle(ButtonStyle.Success)
	.setEmoji('<:Plus:1140208783512043743>')

	const çıkart = new ButtonBuilder()
	.setCustomId('cikart')
	.setLabel('Filitre Kelime Çıkart')
	.setStyle(ButtonStyle.Danger)
	.setEmoji('<:minus:1140212230588207104>')

	const liste = new ButtonBuilder()
	.setCustomId('liste')
	.setLabel('Filitre Kelime Liste')
	.setStyle(ButtonStyle.Secondary)
	.setEmoji('<:list:1140213657402347540>')

	const row = new ActionRowBuilder()
	.addComponents(ekle, çıkart, liste);

const embed = new EmbedBuilder()
	.setColor("#009eff")
	.setTitle('Filitre Menüsü')
	.setDescription(`
	<:Plus:1140208783512043743> Butonuna tıklayarak kelime ekleyebilirsiniz.
	<:minus:1140212230588207104> Butonuna tıklayarak kelime çıkartabilirsiniz.
	<:list:1140213657402347540> Butonuna tıklayarak kelime listesine bakabilirsiniz.
	`)
	.setTimestamp()
	.setFooter({ text: 'Aşşağıdaki butonlardan seçim yapabilirsiniz.'});

  message.channel.send({embeds: [embed],components: [row]
  })

};
exports.conf = {
  aliases: [""]
};

exports.help = {
  name: "filitre"
};