const { REST, Routes } = require("discord.js");
const { DISCORD_BOT_TOKEN, DISCORD_CLIENT_ID } = require("./config.json");

const fs = require("fs");
const path = require("path");

const commandsFolderPath = path.join(__dirname, "commands/");

const commands = fs
    .readdirSync(commandsFolderPath)
    .map((fileName) => require(path.join(commandsFolderPath, fileName)).commandData);

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
