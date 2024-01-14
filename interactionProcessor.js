const path = require("path");
const fs = require("fs");

const commandsFolderPath = path.join(__dirname, "commands/");

const commands = fs
    .readdirSync(commandsFolderPath)
    .map((fileName) => require(path.join(commandsFolderPath, fileName)));

const commandsMap = Object.fromEntries(
    commands.map((command) => [command.name, command.exec]),
);

const {
    generateLeaderboard,
    MEMBER_COUNT_PER_PAGE,
    filterMembersWhoHaventPlayedAGame,
} = require("./leaderboardUtils");

module.exports = async (interaction, client, database) => {
    if (interaction.isChatInputCommand()) {
        const commandExec = commandsMap[interaction.commandName];

        if (!commandExec) return;

        return commandExec(interaction, database);
    } else {
        const leaderboardData = await database
            .collection("leaderboards")
            .findOne({ id: interaction.message.id });

        if (!leaderboardData)
            return interaction.reply({
                content: "Leaderboard message could not be found.",
                ephemeral: true,
            });

        if (interaction.user.id !== leaderboardData.requesterId) {
            return interaction.reply({
                content: "You can only interact with leaderboards you requested!",
                ephemeral: true,
            });
        }

        if (interaction.isButton() && interaction.customId === "delete") {
            await client.channels.fetch(interaction.channelId); // channel that message was in must be cached for the message to be deleted.
            return interaction.message.delete();
        }

        const guildData =
            interaction.isButton() && interaction.customId === "update"
                ? (
                      await database
                          .collection("guildData")
                          .find({})
                          .sort({ updated: -1 })
                          .limit(1)
                          .toArray()
                  )[0]
                : await database
                      .collection("guildData")
                      .findOne({ updated: leaderboardData.dataTs });

        if (!guildData)
            return interaction.reply({
                content: "Data for that leaderboard could not be found.",
                ephemeral: true,
            });

        guildData.members = filterMembersWhoHaventPlayedAGame(
            guildData.members,
            leaderboardData.since_tracking,
        );

        let newStat = leaderboardData.stat;
        let newFirstIdx = leaderboardData.firstIdx;
        let newLastIdx = leaderboardData.lastIdx;

        if (
            interaction.isStringSelectMenu() &&
            interaction.customId === "statsDropdown"
        ) {
            newStat = interaction.values[0];
        } else if (interaction.isButton()) {
            const veryFirstFirstIdx = 0;
            const veryFirstLastIdx = MEMBER_COUNT_PER_PAGE;
            const veryLastFirstIdx = Math.max(
                0,
                Math.floor(guildData.members.length / MEMBER_COUNT_PER_PAGE) *
                    MEMBER_COUNT_PER_PAGE,
            );
            const veryLastLastIdx = guildData.members.length;

            switch (interaction.customId) {
                case "first":
                case "update":
                    newFirstIdx = veryFirstFirstIdx;
                    newLastIdx = veryFirstLastIdx;
                    break;
                case "prev":
                    newFirstIdx = Math.max(
                        veryFirstFirstIdx,
                        leaderboardData.firstIdx - MEMBER_COUNT_PER_PAGE,
                    );
                    newLastIdx = Math.max(
                        veryFirstLastIdx,
                        Math.min(leaderboardData.firstIdx, guildData.members.length),
                    );
                    break;
                case "next":
                    newFirstIdx = Math.min(
                        leaderboardData.firstIdx + MEMBER_COUNT_PER_PAGE,
                        veryLastFirstIdx,
                    );
                    newLastIdx = Math.min(
                        leaderboardData.lastIdx + MEMBER_COUNT_PER_PAGE,
                        veryLastLastIdx,
                    );
                    break;
                case "last":
                    newFirstIdx = veryLastFirstIdx;
                    newLastIdx = veryLastLastIdx;
                    break;
            }
        }

        await interaction.update(
            await generateLeaderboard(
                newFirstIdx,
                newLastIdx,
                newStat,
                guildData,
                guildData.updated,
                leaderboardData.since_tracking,
            ),
        );

        return database.collection("leaderboards").updateOne(
            { id: interaction.message.id },
            {
                $set: {
                    stat: newStat,
                    firstIdx: newFirstIdx,
                    lastIdx: newLastIdx,
                    dataTs: guildData.updated,
                },
            },
        );
    }
};
