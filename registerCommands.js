const { REST, Routes, SlashCommandBuilder } = require("discord.js");
const { DISCORD_BOT_TOKEN, DISCORD_CLIENT_ID } = require("./config.json");

const commands = [
  new SlashCommandBuilder()
    .setName("startup")
    .setDescription("we all know that one person..."),
  new SlashCommandBuilder()
    .setName("source")
    .setDescription("link to the source code of the bot"),
  new SlashCommandBuilder()
    .setName("top10")
    .setDescription("get's the top 10 players of the guild by star")
    .addStringOption((option) =>
      option
        .setName("sort")
        .setDescription("sorting method")
        .addChoices(
          { name: "Star", value: "star" },
          { name: "FKDR", value: "fkdr" }
        )
    ),
];

const rest = new REST({ version: "10" }).setToken(DISCORD_BOT_TOKEN);

(async function () {
  try {
    console.log("Started refreshing application (/) commands.");

    await rest.put(Routes.applicationCommands(DISCORD_CLIENT_ID), {
      body: commands.map((command) => command.toJSON()),
    });

    console.log("Successfully reloaded application (/) commands.");
  } catch (error) {
    console.error(error);
  }
})();
