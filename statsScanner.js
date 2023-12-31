const axios = require("axios");
const { ActivityType } = require("discord.js");

const { processRanks, safeDiv, safeAdder } = require("./leaderboardUtils");

const {
    HYPIXEL_API_KEY,
    HYPIXEL_GUILD_ID,
    TRACKING_UUID_BLACKLIST,
    LEVEL_ROLE_IDS,
    GUILD_ID,
} = require("./config.json");

const sleep = (sleepMs) => new Promise((resolve) => setTimeout(resolve, sleepMs));

const DESIRED_REQUESTS_PER_FIVE_MINUTES = 290;

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

    async diffyStats(currentData) {
        const newData = Object.assign({}, currentData);
        for (let i = 0; i < newData.members.length; i++) {
            const findDict = {
                "members.uuid": newData.members[i].uuid,
            };

            for (const key of Object.keys(newData.members[i].stats)) {
                findDict[`members.0.stats.${key}.num`] = { $exists: true }; // legacy data support
            }

            const oldestStatsForMember = (
                await this.database
                    .collection("guildData")
                    .find(findDict)
                    .sort({ updated: 1 })
                    .limit(1)
                    .toArray()
            )[0]?.members?.find((m) => m.uuid === newData.members[i].uuid);

            if (!oldestStatsForMember) {
                return currentData;
            }

            const diffStats = {};

            for (const key of Object.keys(newData.members[i].stats)) {
                if (key === "average_rank") continue;

                if (!oldestStatsForMember.stats[key].numerator) {
                    diffStats[key] = newData.members[i].stats[key];
                    continue;
                }

                diffStats[key] = {};

                diffStats[key].numerator =
                    newData.members[i].stats[key].numerator -
                    oldestStatsForMember.stats[key].numerator;

                diffStats[key].denominator =
                    newData.members[i].stats[key].denominator -
                    oldestStatsForMember.stats[key].denominator;

                diffStats[key].num = safeDiv(
                    diffStats[key].numerator,
                    diffStats[key].denominator,
                );
            }

            newData.members[i].diffStats = diffStats;
        }

        newData.members = processRanks(newData.members, "diffStats");

        return newData;
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

        let members = [];

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
                    };

                    members.push(memberData);
                }
            } catch (e) {
                console.error(e);
            }

            await sleep(delay);
        }

        members = processRanks(members, "stats");
        const newData = await this.diffyStats({ members, updated: Date.now() });

        await this.database.collection("guildData").insertOne(newData);

        await this.discordClient.user.setPresence({
            activities: [
                {
                    name: `${members.filter((member) => member.is_online).length} ${
                        members.filter((member) => member.is_online).length === 1
                            ? "person"
                            : "people"
                    } play`,
                    type: ActivityType.Watching,
                },
            ],
            status: "online",
        });

        await this.updateRoles(members);

        console.log(`Took ${Date.now() - updatingStartTime}ms to update`);
    }

    async updateRoles(members) {
        const guild = await this.discordClient.guilds.fetch(GUILD_ID);
        const roles = await Promise.all(
            LEVEL_ROLE_IDS.map((roleId) => guild.roles.fetch(roleId)),
        );

        for (const memberData of members) {
            try {
                const roleIndex =
                    Math.floor(memberData.stats.bedwars_level.num / 100) - 1;
                if (roleIndex > LEVEL_ROLE_IDS.length - 1) {
                    console.error(
                        `${memberData.uuid} has invalid roleIdx with level ${memberData.stats.bedwars_level.num}`,
                    );
                    continue;
                }

                const memberDiscordId = (
                    await this.database
                        .collection("memberRegistry")
                        .findOne({ uuid: memberData.uuid })
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
