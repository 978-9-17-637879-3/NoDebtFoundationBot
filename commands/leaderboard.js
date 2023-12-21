const { SlashCommandBuilder } = require("discord.js");
const { generateLeaderboard, STAT_OPTIONS } = require("../leaderboardUtils");

const FIRST_PLAYER_IDX = 0;
const LAST_PLAYER_IDX = 10;

module.exports = {
    name: "leaderboard",
    exec: async function (interaction, database) {
        const guildData = (
            await database
                .collection("guildData")
                .find({})
                .sort({ updated: -1 })
                .limit(1)
                .toArray()
        )[0];

        const dataTs = Number(guildData?.updated ?? "0");

        const reply = await interaction.reply(
            Object.assign({}, await generateLeaderboard(
                FIRST_PLAYER_IDX,
                LAST_PLAYER_IDX,
                interaction.options.get("stat")?.value ?? "star",
                guildData,
                dataTs,
            ), {fetchReply: true}),
        );

        return database.collection("leaderboards").insertOne({
            id: reply.id,
            dataTs: dataTs,
            stat: interaction.options.get("stat").value,
            firstIdx: FIRST_PLAYER_IDX,
            lastIdx: LAST_PLAYER_IDX,
        });
    },
    commandData: new SlashCommandBuilder()
        .setName("leaderboard")
        .setDescription(
            "get's the top/bottom 10 players of the guild by various statistics",
        )
        .addStringOption((option) =>
            option
                .setName("stat")
                .setDescription("statistic to sort by")
                .addChoices(...STAT_OPTIONS),
        ),
};
