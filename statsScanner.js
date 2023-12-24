const axios = require("axios");
const { ActivityType } = require("discord.js");

const { STAT_OPTIONS } = require("./leaderboardUtils");

const {
    HYPIXEL_API_KEY,
    HYPIXEL_GUILD_ID,
    TRACKING_UUID_BLACKLIST,
} = require("./config.json");

const sleep = (sleepMs) => new Promise((resolve) => setTimeout(resolve, sleepMs));

const DESIRED_REQUESTS_PER_FIVE_MINUTES = 290;

function safeDiv(a, b) {
    return (a ?? 0) / ((b ?? 0) === 0 ? 1 : b);
}

function safeAdder(...args) {
    let sum = 0;
    for (const arg of args) {
        sum += arg ?? 0;
    }
    return sum;
}

function bedwarsRatio(data, numeratorKey, denominatorKey) {
    return safeDiv(
        safeAdder(
            data["player"]["stats"]["Bedwars"][`eight_one_${numeratorKey}_bedwars`],
            data["player"]["stats"]["Bedwars"][`eight_two_${numeratorKey}_bedwars`],
            data["player"]["stats"]["Bedwars"][`four_three_${numeratorKey}_bedwars`],
            data["player"]["stats"]["Bedwars"][`four_four_${numeratorKey}_bedwars`],
        ),
        safeAdder(
            data["player"]["stats"]["Bedwars"][`eight_one_${denominatorKey}_bedwars`],
            data["player"]["stats"]["Bedwars"][`eight_two_${denominatorKey}_bedwars`],
            data["player"]["stats"]["Bedwars"][`four_three_${denominatorKey}_bedwars`],
            data["player"]["stats"]["Bedwars"][`four_four_${denominatorKey}_bedwars`],
        ),
    );
}

class Scanner {
    constructor(discordClient, database) {
        this.discordClient = discordClient;
        this.database = database;
    }

    async scan() {
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

        for (let i = 0; i < guildResponse.data["guild"]["members"].length; i++) {
            if ((i + 1) % 10 === 0)
                console.log(
                    `${(
                        (i / guildResponse.data["guild"]["members"].length) *
                        100
                    ).toFixed(1)}% updated`,
                );

            const guildMember = guildResponse.data["guild"]["members"][i];

            if (TRACKING_UUID_BLACKLIST.includes(guildMember.uuid)) continue;

            try {
                const playerResponse = await axios({
                    method: "get",
                    url: "https://api.hypixel.net/v2/player",
                    headers: { "API-Key": HYPIXEL_API_KEY },
                    params: {
                        uuid: guildMember["uuid"],
                    },
                });

                if (
                    playerResponse.data["player"]["achievements"]?.["bedwars_level"] &&
                    (!playerResponse.data["player"]["lastLogin"] ||
                        Date.now() - playerResponse.data["player"]["lastLogin"] <
                            1000 * 60 * 60 * 24 * 30)
                ) {
                    const playerStatusResponse = await axios({
                        method: "get",
                        url: "https://api.hypixel.net/v2/status",
                        headers: { "API-Key": HYPIXEL_API_KEY },
                        params: {
                            uuid: guildMember["uuid"],
                        },
                    });

                    await sleep(delay);

                    const memberData = {
                        name: playerResponse.data["player"]["displayname"],
                        uuid: guildMember["uuid"],
                        stats: {
                            bedwars_level:
                                playerResponse.data["player"]["achievements"][
                                    "bedwars_level"
                                ],
                            fkdr: bedwarsRatio(
                                playerResponse.data,
                                "final_kills",
                                "final_deaths",
                            ),
                            void_deaths_per_death: bedwarsRatio(
                                playerResponse.data,
                                "void_deaths",
                                "deaths",
                            ),
                            bblr: bedwarsRatio(
                                playerResponse.data,
                                "beds_broken",
                                "beds_lost",
                            ),
                            wlr: bedwarsRatio(playerResponse.data, "wins", "losses"),
                            emeralds_per_game: bedwarsRatio(
                                playerResponse.data,
                                "emerald_resources_collected",
                                "games_played",
                            ),
                            diamonds_per_game: bedwarsRatio(
                                playerResponse.data,
                                "diamond_resources_collected",
                                "games_played",
                            ),
                            weekly_guild_experience: safeAdder(
                                ...Object.values(guildMember["expHistory"]),
                            ),
                        },
                        is_online: playerStatusResponse.data["session"]["online"],
                        last_login_time: playerResponse.data["player"]["lastLogin"],
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

            let sortedStatsCopy = stats
                .slice() // copies array so that sort doesn't mutate
                .sort((a, b) => b.stats[statOption.value] - a.stats[statOption.value]);
            
            if (statOption.reverse)
                sortedStatsCopy.reverse();

            for (let i = 0; i < stats.length; i++) {
                stats[i].rankSum +=
                    sortedStatsCopy.findIndex((member) => member.uuid === stats[i].uuid) +
                    1;
            }
        }

        for (let i = 0; i < stats.length; i++) {
            stats[i].stats.average_rank = safeDiv(
                stats[i].rankSum,
                STAT_OPTIONS.length - 1,
            );
            delete stats[i].rankSum;
        }

        await this.database
            .collection("guildData")
            .insertOne({ stats, updated: Date.now() });

        await this.discordClient.user.setPresence({
            activities: [
                {
                    name: `${stats.filter((member) => member.is_online).length} ${
                        stats.filter((member) => member.is_online).length === 1
                            ? "person"
                            : "people"
                    } play`,
                    type: ActivityType.Watching,
                },
            ],
            status: "online",
        });

        console.log(`Took ${Date.now() - updatingStartTime}ms to update`);
    }
}

async function scanLoop(scanner) {
    try {
        await scanner.scan();
    } catch (e) {
        console.error(e);
    }

    await sleep(1000);
    scanLoop(scanner);
}

module.exports = function (discordClient, database) {
    scanLoop(new Scanner(discordClient, database));
};
