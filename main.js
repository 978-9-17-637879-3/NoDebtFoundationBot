const axios = require("axios");
const Discord = require("discord.js");
const { MongoClient } = require("mongodb");
const path = require("path");
const fs = require("fs");

const client = new Discord.Client({
    intents: [],
});

const mongoClient = new MongoClient("mongodb://localhost:27017");

let database;

const {
    HYPIXEL_API_KEY,
    DISCORD_BOT_TOKEN,
    HYPIXEL_GUILD_ID,
    TRACKING_UUID_BLACKLIST,
} = require("./config.json");

const DESIRED_REQUESTS_PER_FIVE_MINUTES = 290;

function safeDiv(a, b) {
    return (a ?? 0) / ((b ?? 0) === 0 ? 1 : b);
}

function safeAdder(...args) {
    sum = 0;
    for (const arg of args) {
        sum += arg ?? 0;
    }
    return sum;
}

const sleep = (sleepMs) => new Promise((resolve) => setTimeout(resolve, sleepMs));

let firstUpdateCompleted = false;

const { STAT_OPTIONS } = require("./leaderboardUtils");

async function scan() {
    const guildResponse = await axios({
        method: "get",
        url: "https://api.hypixel.net/v2/guild",
        headers: { "API-Key": HYPIXEL_API_KEY },
        params: {
            id: HYPIXEL_GUILD_ID,
        },
    });

    const delay = (DESIRED_REQUESTS_PER_FIVE_MINUTES / 5 / 60) * 1000;

    let stats = [];

    const updatingStartTime = Date.now();
    console.log(`Started update at ${updatingStartTime}`);

    for (let i = 0; i < guildResponse.data.guild.members.length; i++) {
        if ((i + 1) % 10 == 0)
            console.log(
                `${((i / guildResponse.data.guild.members.length) * 100).toFixed(
                    1,
                )}% updated`,
            );

        const guildMember = guildResponse.data.guild.members[i];

        if (TRACKING_UUID_BLACKLIST.includes(guildMember.uuid)) continue;

        try {
            const playerResponse = await axios({
                method: "get",
                url: "https://api.hypixel.net/v2/player",
                headers: { "API-Key": HYPIXEL_API_KEY },
                params: {
                    uuid: guildMember.uuid,
                },
            });

            if (
                playerResponse.data.player.achievements?.bedwars_level &&
                (!playerResponse.data.player.lastLogin ||
                    Date.now() - playerResponse.data.player.lastLogin <
                        1000 * 60 * 60 * 24 * 30)
            ) {
                const playerStatusResponse = await axios({
                    method: "get",
                    url: "https://api.hypixel.net/v2/status",
                    headers: { "API-Key": HYPIXEL_API_KEY },
                    params: {
                        uuid: guildMember.uuid,
                    },
                });

                await sleep(delay);

                const memberData = {
                    name: playerResponse.data.player.displayname,
                    uuid: guildMember.uuid,
                    stats: {
                        bedwars_level:
                            playerResponse.data.player.achievements.bedwars_level,
                        fkdr: safeDiv(
                            safeAdder(
                                playerResponse.data.player.stats.Bedwars
                                    .eight_one_final_kills_bedwars,
                                playerResponse.data.player.stats.Bedwars
                                    .eight_two_final_kills_bedwars,
                                playerResponse.data.player.stats.Bedwars
                                    .four_three_final_kills_bedwars,
                                playerResponse.data.player.stats.Bedwars
                                    .four_four_final_kills_bedwars,
                            ),
                            safeAdder(
                                playerResponse.data.player.stats.Bedwars
                                    .eight_one_final_deaths_bedwars,
                                playerResponse.data.player.stats.Bedwars
                                    .eight_two_final_deaths_bedwars,
                                playerResponse.data.player.stats.Bedwars
                                    .four_three_final_deaths_bedwars,
                                playerResponse.data.player.stats.Bedwars
                                    .four_four_final_deaths_bedwars,
                            ),
                        ),
                        void_deaths_per_death: safeDiv(
                            safeAdder(
                                playerResponse.data.player.stats.Bedwars
                                    .eight_one_void_deaths_bedwars,
                                playerResponse.data.player.stats.Bedwars
                                    .eight_two_void_deaths_bedwars,
                                playerResponse.data.player.stats.Bedwars
                                    .four_three_void_deaths_bedwars,
                                playerResponse.data.player.stats.Bedwars
                                    .four_four_void_deaths_bedwars,
                            ),
                            safeAdder(
                                playerResponse.data.player.stats.Bedwars
                                    .eight_one_deaths_bedwars,
                                playerResponse.data.player.stats.Bedwars
                                    .eight_two_deaths_bedwars,
                                playerResponse.data.player.stats.Bedwars
                                    .four_three_deaths_bedwars,
                                playerResponse.data.player.stats.Bedwars
                                    .four_four_deaths_bedwars,
                            ),
                        ),
                        bblr: safeDiv(
                            safeAdder(
                                playerResponse.data.player.stats.Bedwars
                                    .eight_one_beds_broken_bedwars,
                                playerResponse.data.player.stats.Bedwars
                                    .eight_two_beds_broken_bedwars,
                                playerResponse.data.player.stats.Bedwars
                                    .four_three_beds_broken_bedwars,
                                playerResponse.data.player.stats.Bedwars
                                    .four_four_beds_broken_bedwars,
                            ),
                            safeAdder(
                                playerResponse.data.player.stats.Bedwars
                                    .eight_one_beds_lost_bedwars,
                                playerResponse.data.player.stats.Bedwars
                                    .eight_two_beds_lost_bedwars,
                                playerResponse.data.player.stats.Bedwars
                                    .four_three_beds_lost_bedwars,
                                playerResponse.data.player.stats.Bedwars
                                    .four_four_beds_lost_bedwars,
                            ),
                        ),
                        wlr: safeDiv(
                            safeAdder(
                                playerResponse.data.player.stats.Bedwars
                                    .eight_one_wins_bedwars,
                                playerResponse.data.player.stats.Bedwars
                                    .eight_two_wins_bedwars,
                                playerResponse.data.player.stats.Bedwars
                                    .four_three_wins_bedwars,
                                playerResponse.data.player.stats.Bedwars
                                    .four_four_wins_bedwars,
                            ),
                            safeAdder(
                                playerResponse.data.player.stats.Bedwars
                                    .eight_one_losses_bedwars,
                                playerResponse.data.player.stats.Bedwars
                                    .eight_two_losses_bedwars,
                                playerResponse.data.player.stats.Bedwars
                                    .four_three_losses_bedwars,
                                playerResponse.data.player.stats.Bedwars
                                    .four_four_losses_bedwars,
                            ),
                        ),
                        emeralds_per_game: safeDiv(
                            safeAdder(
                                playerResponse.data.player.stats.Bedwars
                                    .eight_one_emerald_resources_collected_bedwars,
                                playerResponse.data.player.stats.Bedwars
                                    .eight_two_emerald_resources_collected_bedwars,
                                playerResponse.data.player.stats.Bedwars
                                    .four_three_emerald_resources_collected_bedwars,
                                playerResponse.data.player.stats.Bedwars
                                    .four_four_emerald_resources_collected_bedwars,
                            ),
                            safeAdder(
                                playerResponse.data.player.stats.Bedwars
                                    .eight_one_games_played_bedwars,
                                playerResponse.data.player.stats.Bedwars
                                    .eight_two_games_played_bedwars,
                                playerResponse.data.player.stats.Bedwars
                                    .four_three_games_played_bedwars,
                                playerResponse.data.player.stats.Bedwars
                                    .four_four_games_played_bedwars,
                            ),
                        ),
                        diamonds_per_game: safeDiv(
                            safeAdder(
                                playerResponse.data.player.stats.Bedwars
                                    .eight_one_diamond_resources_collected_bedwars,
                                playerResponse.data.player.stats.Bedwars
                                    .eight_two_diamond_resources_collected_bedwars,
                                playerResponse.data.player.stats.Bedwars
                                    .four_three_diamond_resources_collected_bedwars,
                                playerResponse.data.player.stats.Bedwars
                                    .four_four_diamond_resources_collected_bedwars,
                            ),
                            safeAdder(
                                playerResponse.data.player.stats.Bedwars
                                    .eight_one_games_played_bedwars,
                                playerResponse.data.player.stats.Bedwars
                                    .eight_two_games_played_bedwars,
                                playerResponse.data.player.stats.Bedwars
                                    .four_three_games_played_bedwars,
                                playerResponse.data.player.stats.Bedwars
                                    .four_four_games_played_bedwars,
                            ),
                        ),
                        weekly_guild_experience: safeAdder(
                            ...Object.values(guildMember.expHistory),
                        ),
                    },
                    is_online: playerStatusResponse.data.session.online,
                    last_login_time: playerResponse.data.player.lastLogin,
                    rankSum: 0,
                };

                stats.push(memberData);
            }
        } catch (e) {
            console.error(e);
        }

        await sleep(delay);
    }

    for (const statOption of STAT_OPTIONS) {
        if (statOption.value === "average_rank") continue;

        for (let i = 0; i < stats.length; i++) {
            stats[i].rankSum +=
                stats
                    .slice() // copies array so that sort doesn't mutate
                    .sort((a, b) => b.stats[statOption.value] - a.stats[statOption.value])
                    .findIndex((member) => member.uuid === stats[i].uuid) + 1;
        }
    }

    for (let i = 0; i < stats.length; i++) {
        stats[i].stats.average_rank = safeDiv(stats[i].rankSum, STAT_OPTIONS.length - 1);
        delete stats[i].rankSum;
    }

    await database.collection("guildData").insertOne({ stats, updated: Date.now() });

    await client.user.setPresence({
        activities: [
            {
                name: `${stats.filter((member) => member.is_online).length} ${
                    stats.filter((member) => member.is_online).length === 1
                        ? "person"
                        : "people"
                } play`,
                type: Discord.ActivityType.Watching,
            },
        ],
        status: "online",
    });

    console.log(`Took ${Date.now() - updatingStartTime}ms to update`);
    firstUpdateCompleted = true;
}

async function scanLoop() {
    try {
        await scan();
    } catch (e) {
        console.error(e);
    }

    await sleep(1000);
    scanLoop();
}

client.on("ready", async () => {
    database = mongoClient.db("nodebtfoundationbot");

    console.log("ready!");
    await client.user.setPresence({
        activities: [
            {
                name: `Bedwars`,
                type: Discord.ActivityType.Competing,
            },
        ],
        status: "dnd",
    });

    scanLoop();
});

const commandsFolderPath = path.join(__dirname, "commands/");

const commands = fs
    .readdirSync(commandsFolderPath)
    .map((fileName) => require(path.join(commandsFolderPath, fileName)));

const commandsMap = Object.fromEntries(
    commands.map((command) => [command.name, command.exec]),
);

const { generateLeaderboard } = require("./leaderboardUtils");

client.on("interactionCreate", async (interaction) => {
    if (interaction.isButton() || interaction.isStringSelectMenu()) {
        if (
            !["first", "prev", "next", "last", "delete"].includes(interaction.customId) &&
            interaction.customId !== "statsDropdown"
        )
            return;

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

        if (interaction.customId === "delete") {
            await client.channels.fetch(interaction.channelId); // channel that message was in must be cached for the message to be deleted.
            return interaction.message.delete();
        }

        const guildDataAtTimestamp = await database
            .collection("guildData")
            .findOne({ updated: leaderboardData.dataTs });

        if (!guildDataAtTimestamp)
            return interaction.reply({
                content: "Data for that leaderboard could not be found.",
                ephemeral: true,
            });

        let newStat = leaderboardData.stat;
        let newFirstIdx = leaderboardData.firstIdx;
        let newLastIdx = leaderboardData.lastIdx;

        if (interaction.isStringSelectMenu()) {
            newStat = interaction.values[0];
        } else if (interaction.isButton()) {
            const veryFirstFirstIdx = 0;
            const veryFirstLastIdx = 10;
            const veryLastFirstIdx = Math.max(
                0,
                Math.floor(guildDataAtTimestamp.stats.length / 10) * 10,
            );
            const veryLastLastIdx = guildDataAtTimestamp.stats.length;

            switch (interaction.customId) {
                case "first":
                    newFirstIdx = veryFirstFirstIdx;
                    newLastIdx = veryFirstLastIdx;
                    break;
                case "prev":
                    newFirstIdx = Math.max(
                        veryFirstFirstIdx,
                        leaderboardData.firstIdx - 10,
                    );
                    newLastIdx = Math.max(
                        veryFirstLastIdx,
                        Math.min(
                            leaderboardData.firstIdx,
                            guildDataAtTimestamp.stats.length,
                        ),
                    );
                    break;
                case "next":
                    newFirstIdx = Math.min(
                        leaderboardData.firstIdx + 10,
                        veryLastFirstIdx,
                    );
                    newLastIdx = Math.min(leaderboardData.lastIdx + 10, veryLastLastIdx);
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
                guildDataAtTimestamp,
                leaderboardData.dataTs,
            ),
        );

        return database
            .collection("leaderboards")
            .updateOne(
                { id: interaction.message.id },
                { $set: { stat: newStat, firstIdx: newFirstIdx, lastIdx: newLastIdx } },
            );
    } else if (interaction.isChatInputCommand()) {
        const commandExec = commandsMap[interaction.commandName];

        if (!commandExec) return;

        if (!firstUpdateCompleted)
            return interaction.reply(
                'Refreshing data, please wait a couple minutes and try again. If my status says "Competing in Bedwars", I\'m still refreshing data.',
            );

        return commandExec(interaction, database);
    }
});

mongoClient.connect().then(() => client.login(DISCORD_BOT_TOKEN));
