const { SlashCommandBuilder } = require("discord.js");

module.exports = {
    name: "online",
    exec: async function (interaction, database) {
        const guildData = (
            await database
                .collection("guildData")
                .find({})
                .sort({ updated: -1 })
                .limit(1)
                .toArray()
        )[0];

        const members = guildData?.stats ?? [];
        const lastUpdated = Number(guildData?.updated ?? "0");

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
