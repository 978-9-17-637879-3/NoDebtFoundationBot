const axios = require("axios");
const { ActivityType } = require("discord.js");

const { STAT_OPTIONS } = require("./leaderboardUtils");

const {
    HYPIXEL_API_KEY,
    HYPIXEL_GUILD_ID,
    TRACKING_UUID_BLACKLIST,
    LEVEL_ROLE_IDS,
    GUILD_ID,
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

function bedwarsStat(data, key) {
    return data["player"]["stats"]["Bedwars"][key];
}

function bedwarsRatio(data, numeratorKey, denominatorKey) {
    const numerator = safeAdder(
        bedwarsStat(data, `eight_one_${numeratorKey}_bedwars`),
        bedwarsStat(data, `eight_two_${numeratorKey}_bedwars`),
        bedwarsStat(data, `four_three_${numeratorKey}_bedwars`),
        bedwarsStat(data, `four_four_${numeratorKey}_bedwars`),
    );
    const denominator = safeAdder(
        bedwarsStat(data, `eight_one_${denominatorKey}_bedwars`),
        bedwarsStat(data, `eight_two_${denominatorKey}_bedwars`),
        bedwarsStat(data, `four_three_${denominatorKey}_bedwars`),
        bedwarsStat(data, `four_four_${denominatorKey}_bedwars`),
    );
    return { numerator, denominator, num: safeDiv(numerator, denominator) };
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
                            bedwars_level: {
                                num: playerResponse.data["player"]["achievements"][
                                    "bedwars_level"
                                ],
                            },
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
                            weekly_guild_experience: {
                                num: safeAdder(
                                    ...Object.values(guildMember["expHistory"]),
                                ),
                            },
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
                .sort(
                    (a, b) =>
                        b.stats[statOption.value].num - a.stats[statOption.value].num,
                );

            if (statOption.reverse) sortedStatsCopy.reverse();

            for (let i = 0; i < stats.length; i++) {
                stats[i].rankSum +=
                    sortedStatsCopy.findIndex((member) => member.uuid === stats[i].uuid) +
                    1;
            }
        }

        for (let i = 0; i < stats.length; i++) {
            stats[i].stats.average_rank = {
                numerator: stats[i].rankSum,
                denominator: STAT_OPTIONS.length - 1,
                num: safeDiv(stats[i].rankSum, STAT_OPTIONS.length - 1),
            };
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

        await this.updateRoles(stats);

        console.log(`Took ${Date.now() - updatingStartTime}ms to update`);
    }

    async updateRoles(stats) {
        const guild = await this.discordClient.guilds.fetch(GUILD_ID);
        const roles = await Promise.all(
            LEVEL_ROLE_IDS.map((roleId) => guild.roles.fetch(roleId)),
        );

        for (const memberStatsEntry of stats) {
            try {
                const roleIndex =
                    Math.floor(memberStatsEntry.stats.bedwars_level.num / 100) - 1;
                if (roleIndex > LEVEL_ROLE_IDS.length - 1) {
                    console.error(
                        `${memberStatsEntry.uuid} has invalid roleIdx with level ${memberStatsEntry.stats.bedwars_level.num}`,
                    );
                    continue;
                }

                const memberDiscordId = (
                    await this.database
                        .collection("memberRegistry")
                        .findOne({ uuid: memberStatsEntry.uuid })
                )?.id;
                if (!memberDiscordId) {
                    continue;
                }

                const discordMember = await guild.members.fetch(memberDiscordId);
                for (let i = 0; i <= roleIndex; i++) {
                    await discordMember.roles.add(roles[i]);
                }
            } catch (e) {
                console.error(e);
            }
        }
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
