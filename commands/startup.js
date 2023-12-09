const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  name: "startup",
  exec: async function (interaction) {
    return interaction.reply(
      "bro... let's build a startup together! i got this great app idea, and if you make it, you can get a 5% cut :fire:"
    );
  },
  commandData: new SlashCommandBuilder()
    .setName("startup")
    .setDescription("we all know that one person..."),
};
