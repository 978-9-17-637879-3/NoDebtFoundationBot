const { SlashCommandBuilder } = require("discord.js");
const { SOURCE_URL } = require("../config.json");

module.exports = {
    name: "source",
    exec: async function (interaction) {
        return interaction.reply(SOURCE_URL);
    },
    commandData: new SlashCommandBuilder()
        .setName("source")
        .setDescription("link to the source code of the bot"),
};
