const axios = require("axios");
const Discord = require("discord.js");
const { createClient } = require("redis");
const path = require("path");
const fs = require("fs");

const client = new Discord.Client({
    intents: [],
});

const redisClient = createClient();

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

    let guildData = [];

    for (const member of guildResponse.data.guild.members) {
        if (TRACKING_UUID_BLACKLIST.includes(member.uuid)) continue;

        try {
            const playerResponse = await axios({
                method: "get",
                url: "https://api.hypixel.net/v2/player",
                headers: { "API-Key": HYPIXEL_API_KEY },
                params: {
                    uuid: member.uuid,
                },
            });

            if (
                (playerResponse.data.player.achievements?.bedwars_level &&
                    !playerResponse.data.player.lastLogin) ||
                Date.now() - playerResponse.data.player.lastLogin <
                    1000 * 60 * 60 * 24 * 30
            ) {
                const playerStatusResponse = await axios({
                    method: "get",
                    url: "https://api.hypixel.net/v2/status",
                    headers: { "API-Key": HYPIXEL_API_KEY },
                    params: {
                        uuid: member.uuid,
                    },
                });

                await new Promise((resolve) => setTimeout(resolve, delay));

                const memberData = {
                    name: playerResponse.data.player.displayname,
                    uuid: member.uuid,
                    bedwars_level: playerResponse.data.player.achievements.bedwars_level,
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
                    falling_deaths_per_death: safeDiv(
                        playerResponse.data.player.stats.Bedwars.fall_deaths_bedwars,
                        playerResponse.data.player.stats.Bedwars.deaths_bedwars,
                    ),
                    is_online: playerStatusResponse.data.session.online,
                    last_login_time: playerResponse.data.player.lastLogin,
                };

                guildData.push(memberData);
            }
        } catch (e) {
            console.error(e);
        }
        await new Promise((resolve) => setTimeout(resolve, delay));
    }

    await redisClient.set("guildData", JSON.stringify(guildData));
    await redisClient.set("lastUpdated", Date.now().toString());

    await client.user.setPresence({
        activities: [
            {
                name: `${guildData.filter((member) => member.is_online).length} ${
                    guildData.filter((member) => member.is_online).length === 1
                        ? "person"
                        : "people"
                } play`,
                type: Discord.ActivityType.Watching,
            },
        ],
        status: "online",
    });
}

async function scanLoop() {
    try {
        await scan();
    } catch (e) {
        console.error(e);
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
    scanLoop();
}

client.on("ready", async () => {
    console.log("ready!");

    scanLoop();
});

const commandsFolderPath = path.join(__dirname, "commands/");

const commands = fs
    .readdirSync(commandsFolderPath)
    .map((fileName) => require(path.join(commandsFolderPath, fileName)));

const commandsMap = Object.fromEntries(
    commands.map((command) => [command.name, command.exec]),
);

client.on("interactionCreate", async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const commandExec = commandsMap[interaction.commandName];

    if (commandExec) return commandExec(interaction, redisClient);
});

redisClient.connect().then(() => client.login(DISCORD_BOT_TOKEN));
