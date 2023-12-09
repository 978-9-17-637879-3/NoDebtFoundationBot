const axios = require("axios");
const Discord = require("discord.js");
const { MongoClient, ServerApiVersion } = require("mongodb");
const path = require("path");
const fs = require("fs");

const client = new Discord.Client({
  intents: [
    Discord.IntentsBitField.Flags.GuildMessages,
    Discord.IntentsBitField.Flags.GuildMembers,
  ],
});

const mongoClient = new MongoClient("mongodb://localhost:27017", {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

let database;

const {
  HYPIXEL_API_KEY,
  DISCORD_BOT_TOKEN,
  HYPIXEL_GUILD_ID,
  SOURCE_URL,
} = require("./config.json");

const DESIRED_REQUESTS_PER_MINUTE = 60;

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

  const delay =
    (DESIRED_REQUESTS_PER_MINUTE / guildResponse.data.guild.members.length) *
    1000;

  for (const member of guildResponse.data.guild.members) {
    try {
      const playerResponse = await axios({
        method: "get",
        url: "https://api.hypixel.net/v2/player",
        headers: { "API-Key": HYPIXEL_API_KEY },
        params: {
          uuid: member.uuid,
        },
      });

      if (playerResponse.data.player.achievements?.bedwars_level) {
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
                .four_four_final_kills_bedwars
            ),
            safeAdder(
              playerResponse.data.player.stats.Bedwars
                .eight_one_final_deaths_bedwars,
              playerResponse.data.player.stats.Bedwars
                .eight_two_final_deaths_bedwars,
              playerResponse.data.player.stats.Bedwars
                .four_three_final_deaths_bedwars,
              playerResponse.data.player.stats.Bedwars
                .four_four_final_deaths_bedwars
            )
          ),
          falling_deaths_per_death: safeDiv(
            playerResponse.data.player.stats.Bedwars.fall_deaths_bedwars,
            playerResponse.data.player.stats.Bedwars.deaths_bedwars
          ),
        };
        console.log(memberData);

        await database
          .collection("members")
          .updateOne(
            { uuid: member.uuid },
            { $set: memberData },
            { upsert: true }
          );
      }
    } catch (e) {
      console.error(e);
    }
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
}

async function scanLoop() {
  try {
    await scan();
  } catch (e) {
    console.error(e);
  }
  await new Promise((resolve) => setTimeout(resolve, 60000));
}

client.on("ready", async () => {
  console.log("ready!");

  database = mongoClient.db("nodebtfoundationbot");

  scanLoop();
});

const commandsFolderPath = path.join(__dirname, "commands/");

const commands = fs
  .readdirSync(commandsFolderPath)
  .map((fileName) => require(path.join(commandsFolderPath, fileName)));

const commandsMap = Object.fromEntries(
  commands.map((command) => [command.name, command.exec])
);

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const commandExec = commandsMap[interaction.commandName];

  if (!commandExec) {
    throw new Error();
  }

  return commandExec(interaction, database);
});

mongoClient.connect().then(() => client.login(DISCORD_BOT_TOKEN));
