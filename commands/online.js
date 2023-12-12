const { SlashCommandBuilder } = require("discord.js");

module.exports = {
    name: "online",
    exec: async function (interaction, redisClient) {
        const members = JSON.parse((await redisClient.get("guildData")) ?? "[]");
        const lastUpdated = Number((await redisClient.get("lastUpdated")) ?? "0");

        const membersOnlineString = members
            .filter((member) => member.is_online)
            .map((member) => member.name)
            .join(", ");

        return interaction.reply(
            (membersOnlineString
                ? membersOnlineString
                : "No one is online! What a rarity...") +
                ` (updated ${Math.floor((Date.now() - lastUpdated) / 1000)} seconds ago)`,
        );
    },
    commandData: new SlashCommandBuilder()
        .setName("online")
        .setDescription("get's the members that are currently online"),
};
