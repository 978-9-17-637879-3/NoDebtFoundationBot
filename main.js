const axios = require("axios");
const Discord = require("discord.js");
const { MongoClient, ServerApiVersion } = require("mongodb");

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

let membersCollection;

const {
  HYPIXEL_API_KEY,
  DISCORD_BOT_TOKEN,
  HYPIXEL_GUILD_ID,
} = require("./config.json");

function safeDiv(a, b) {
  return a / (b === 0 ? 1 : b);
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
  
  const timeout = (250 / guildResponse.data.guild.members.length) * 1000;

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
        };
        console.log(memberData);
        
        await membersCollection
          .updateOne(
            { uuid: member.uuid },
            { $set: memberData },
            { upsert: true }
          );
      }
    } catch (e) {
      console.error(e);
    }
    await new Promise((resolve) => setTimeout(resolve, timeout));
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

  await mongoClient.connect();
  membersCollection = mongoClient.db('nodebtfoundationbot').collection('members')

  scanLoop();
});

const sortMap = {
  fkdr: (a, b) => b.fkdr - a.fkdr,
  star: (a, b) => b.bedwars_level - a.bedwars_level,
};

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "startup") {
    await interaction.reply(
      "bro... let's build a startup together! i got this great app idea, and if you make it, you can get a 5% cut :fire:"
    );
  }

  if (interaction.commandName === "top10") {
    const members = await membersCollection.find({}).toArray();

    const comp =
      sortMap[interaction.options.get("sort").value] ?? sortMap["star"];

    await interaction.reply(
      members
        .filter((a) => a.bedwars_level)
        .sort(comp)
        .slice(0, 10)
        .map(
          (member, index) =>
            `${index + 1}. [${member.bedwars_level}☆] ${
              member.name
            } (FKDR: ${member.fkdr.toFixed(2)})`
        )
        .join("\n")
    );
  }
});

client.login(DISCORD_BOT_TOKEN);
