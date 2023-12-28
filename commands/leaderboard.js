const { SlashCommandBuilder } = require("discord.js");
const {
    generateLeaderboard,
    STAT_OPTIONS,
    simulateData,
    MEMBER_COUNT_PER_PAGE,
} = require("../leaderboardUtils");

const FIRST_PLAYER_IDX = 0;
const LAST_PLAYER_IDX = MEMBER_COUNT_PER_PAGE;

module.exports = {
    name: "leaderboard",
    exec: async function (interaction, database) {
        const since_tracking = interaction.options.get("since_tracking")?.value;

        const data = since_tracking
            ? await simulateData(database)
            : (
                  await database
                      .collection("guildData")
                      .find({})
                      .sort({ updated: -1 })
                      .limit(1)
                      .toArray()
              )[0];

        const dataTs = data?.updated ?? 0;
        const stat = interaction.options.get("stat")?.value ?? "bedwars_level";

        const reply = await interaction.reply(
            Object.assign(
                {},
                await generateLeaderboard(
                    FIRST_PLAYER_IDX,
                    LAST_PLAYER_IDX,
                    stat,
                    data,
                    dataTs,
                    since_tracking,
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
            since_tracking: since_tracking,
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
        )
        .addBooleanOption((option) =>
            option
                .setName("since_tracking")
                .setDescription(
                    "start stats from when the bot started tracking you, instead of all time",
                ),
        ),
};
