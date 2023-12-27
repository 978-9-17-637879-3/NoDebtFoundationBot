const { SlashCommandBuilder } = require("discord.js");
const {
    generateLeaderboard,
    STAT_OPTIONS,
    simulateData,
} = require("../leaderboardUtils");

const FIRST_PLAYER_IDX = 0;
const LAST_PLAYER_IDX = 10;

module.exports = {
    name: "trackedleaderboard",
    exec: async function (interaction, database) {
        const simData = await simulateData(database);

        const dataTs = simData?.updated ?? 0;
        const stat = interaction.options.get("stat")?.value ?? "bedwars_level";

        const reply = await interaction.reply(
            Object.assign(
                {},
                await generateLeaderboard(
                    FIRST_PLAYER_IDX,
                    LAST_PLAYER_IDX,
                    stat,
                    simData,
                    dataTs,
                ),
                { fetchReply: true },
            ),
        );

        return database.collection("leaderboards").insertOne({
            id: reply.id,
            requesterId: interaction.user.id,
            dataTs: dataTs,
            stat: stat,
            firstIdx: FIRST_PLAYER_IDX,
            lastIdx: LAST_PLAYER_IDX,
            tracked: true,
        });
    },
    commandData: new SlashCommandBuilder()
        .setName("trackedleaderboard")
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
