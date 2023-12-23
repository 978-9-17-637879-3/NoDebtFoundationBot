const Discord = require("discord.js");
const { MongoClient } = require("mongodb");

const statsScanner = require("./statsScanner");
const interactionProcessor = require("./interactionProcessor");

class Bot {
    constructor(discordClient, mongoClient, botToken) {
        this.discordClient = discordClient;
        this.mongoClient = mongoClient;

        this.discordClient.on("ready", async () => {
            await this.mongoClient.connect();
            this.database = this.mongoClient.db("nodebtfoundationbot");

            console.log("ready!");
            await this.discordClient.user.setPresence({
                activities: [
                    {
                        name: `Bedwars`,
                        type: Discord.ActivityType.Competing,
                    },
                ],
                status: "dnd",
            });

            statsScanner(this.discordClient, this.database);

            this.discordClient.on("interactionCreate", (interaction) =>
                interactionProcessor(interaction, this.discordClient, this.database),
            );
        });

        discordClient.login(botToken);
    }
}

const discordClient = new Discord.Client({
    intents: [],
});

const mongoClient = new MongoClient("mongodb://localhost:27017");

const { DISCORD_BOT_TOKEN } = require("./config.json");

new Bot(discordClient, mongoClient, DISCORD_BOT_TOKEN);
