const { Client, GatewayIntentBits, Partials, ActionRowBuilder, Events, ModalBuilder, TextInputBuilder, TextInputStyle, PermissionsBitField, EmbedBuilder } = require("discord.js");
const Discord = require("discord.js")
const rache = require("rachedb")
const db = new rache({
    "dbName": "filitrelenecekkelimeler", // DB dosya adımız.
    "dbFolder": "database", // DB klasör adımız.
    "noBlankData": true,
    "readable": true,
    "language": "en" // "tr" veya "en" yazabilirsiniz
})
const config = require("./config.js");
const client = new Client({
  partials: [
    Partials.Message, 
    Partials.Channel,
    Partials.GuildMember,
    Partials.Reaction,
    Partials.GuildScheduledEvent, 
    Partials.User, 
    Partials.ThreadMember, 
  ],
  intents: [
    GatewayIntentBits.Guilds, 
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildBans,
    GatewayIntentBits.GuildEmojisAndStickers,
    GatewayIntentBits.GuildIntegrations, 
    GatewayIntentBits.GuildWebhooks, 
    GatewayIntentBits.GuildInvites, 
    GatewayIntentBits.GuildVoiceStates, 
    GatewayIntentBits.GuildPresences, 
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildMessageTyping, 
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.DirectMessageReactions, 
    GatewayIntentBits.DirectMessageTyping, 
    GatewayIntentBits.MessageContent, 
  ],
});

module.exports = client;
require("./events/message.js")
require("./events/ready.js")
client.login(config.Bot.Token)












client.on("interactionCreate", async interaction => {
//butonlar
  if(interaction.customId == "ekle") {
		const modal = new ModalBuilder()
			.setCustomId('modalekle')
			.setTitle('Chat Filter');
		const eklenicekkelime = new TextInputBuilder()
			.setCustomId('modal_ekle')
			.setLabel("Eklenicek kelimeyi belirtin")
      .setMaxLength(100)
			.setStyle(TextInputStyle.Short);
      
		const firstActionRow = new ActionRowBuilder().addComponents(eklenicekkelime);
		modal.addComponents(firstActionRow);
		await interaction.showModal(modal);
	}

  if(interaction.customId == "liste") {
    if(!db.get("filitre_kelime"+interaction.guild.id)) return interaction.reply({content: "Sistemimizde hiçbir kelime kayıtlı değildir.", ephemeral: true})
    let kelimeler = []
    const content = db.get("filitre_kelime"+interaction.guild.id).forEach(element =>{
      kelimeler.push(element)
    })
    if(kelimeler == "") return interaction.reply({content: "Sistemde hiç veri bulunmuyor.", ephemeral: true})
    const chunks = splitTextIntoChunks(kelimeler, 2000);
    for (const chunk of chunks) {
      const embed = new EmbedBuilder()
      .setColor("345691")
      .setDescription(`
      **Filitredeki kelimeler aşağıda listelenmiştir.**
      ${chunk}
      `);
      await interaction.channel.send({ embeds: [embed] });
    }
	}

  if(interaction.customId == "cikart") {
		const modalcikart = new ModalBuilder()
			.setCustomId('modalcikart')
			.setTitle('Chat Filter');
		const cikankelime = new TextInputBuilder()
			.setCustomId('modal_cikart')
			.setLabel("Silinecek kelimeyi belirtin")
			.setStyle(TextInputStyle.Short);
		const firstActionRow = new ActionRowBuilder().addComponents(cikankelime);
		modalcikart.addComponents(firstActionRow);
		await interaction.showModal(modalcikart);
	}




  //modalkontorl
    if (interaction.customId === 'modalekle') {
      const kpknt = await interaction.guild.members.cache.get(interaction.user.id)
      if(!kpknt.permissions.has(PermissionsBitField.Flags.Administrator)) return await interaction.reply({content: "Bu işlemi yapabilmeniz için yeterli yetkide değilsiniz", ephemeral: true})
      const eklenenkelime = interaction.fields.getTextInputValue('modal_ekle');
      const verivarmıkontrolmerkezi = db.get("filitre_kelime"+interaction.guild.id)

      if(verivarmıkontrolmerkezi) {
      let kontrolsayiengel = 0 
      await verivarmıkontrolmerkezi.forEach(async element => {
        if(eklenenkelime === element) return kontrolsayiengel = 1
      });
      console.log(kontrolsayiengel)
      if(kontrolsayiengel == 0) {
        await db.push("filitre_kelime"+interaction.guild.id, eklenenkelime)
        await interaction.reply({ content: "Eklemek istediğiniz kelime başarılı bir şekilde kaydedildi.", ephemeral: true });
      } else {
        interaction.reply({ content: "Bu kelime sistemde kayıtlıdır.", ephemeral: true})
      }
    } else {
      await db.push("filitre_kelime"+interaction.guild.id, eklenenkelime)
      await interaction.reply({ content: "Eklemek istediğiniz kelime başarılı bir şekilde kaydedildi.", ephemeral: true });
    } 
  }


    if (interaction.customId === 'modalcikart') {
      const kpknt = await interaction.guild.members.cache.get(interaction.user.id)
      if(!kpknt.permissions.has(PermissionsBitField.Flags.Administrator)) return await interaction.reply({content: "Bu işlemi yapabilmeniz için yeterli yetkide değilsiniz", ephemeral: true})
      const cikartilankelime = interaction.fields.getTextInputValue('modal_cikart');
      const verivarmıkontrolmerkezi = db.get("filitre_kelime"+interaction.guild.id)

      if(!verivarmıkontrolmerkezi) return interaction.reply({content: "Sisteme zaten herhangi bir kelime eklenmemiş.", ephemeral: true})

      let kontrolsayiengel = 0 
      await verivarmıkontrolmerkezi.forEach(async element => {
        if(cikartilankelime == element) return kontrolsayiengel = 1
      });
      console.log(kontrolsayiengel)
      if(kontrolsayiengel == 1) {
        let kelimekayit = []
        const kelimecikartmaislemi = db.get("filitre_kelime"+interaction.guild.id)
        await kelimecikartmaislemi.forEach(element => {
          if(cikartilankelime == element) return;
          kelimekayit.push(element)
        })
        await db.set("filitre_kelime"+interaction.guild.id, kelimekayit)
        await interaction.reply({ content: "Kelime sistemden çıkartıldı.", ephemeral: true });
      } else {
        interaction.reply({ content: "Bu kelime sistemde zaten mevcut değil.", ephemeral: true})
      }
    }

});


function splitTextIntoChunks(text, chunkSize) {
  const words = text.slice(' ');
  const chunks = [];
  let currentChunk = '';
  for (const word of words) {
    const wordWithAsterisks = (currentChunk.length > 0 ? ', ' : '') + ` **\`${word}\`** `;
    if ((currentChunk + wordWithAsterisks).length + chunks.length <= chunkSize) {
      currentChunk += wordWithAsterisks;
    } else {
      chunks.push(currentChunk);
      currentChunk = wordWithAsterisks;
    }
  }
  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }
  return chunks;
}




client.on("messageCreate", async message => {
  if(message.author.id == client.user.id) return;
  const filitre = db.get("filitre_kelime"+message.guild.id)
  if(!filitre) return;
  let kelimekayit = []
  filitre.forEach(element =>{
    kelimekayit.push(element)
  })
  if(kelimekayit === "") return;
  const content = message.content.toLowerCase();
  const engelkelime = kelimekayit.some(word => content.includes(word.toLowerCase()));

  if (engelkelime) {
    try {
      const a = kelimekayit.find(word => content.includes(word));
      const engellenenkelimetekrarı = content.replace("@everyone", " ").replace("@here", "").replace("@", " ").replace(a, "**`-"+a+"-`**")
      //message.channel.send(engellenenkelimetekrarı)
      await message.delete();
    } catch (error) {
      message.channel.send("Bu arkadaşın mesajlarını silemiyorum.")
    }
  }

})