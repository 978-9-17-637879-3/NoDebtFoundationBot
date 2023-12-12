const { SlashCommandBuilder } = require("discord.js");

module.exports = {
    name: "leaderboard",
    exec: async function (interaction, redisClient) {
        const members = JSON.parse((await redisClient.get("guildData")) ?? "[]");

        const direction = interaction.options.get("direction")?.value ?? "forwards";

        return interaction.reply(
            members
                .sort(
                    (a, b) =>
                        b[interaction.options.get("sort").value] -
                        a[interaction.options.get("sort").value],
                )
                .slice(
                    direction === "forwards" ? 0 : Math.max(0, members.length - 10),
                    direction === "forwards" ? 10 : members.length,
                )
                .map(
                    (member, index) =>
                        `${
                            (direction === "forwards" ? 0 : members.length - 10) +
                            index +
                            1
                        }. [${member.bedwars_level}☆] ${
                            member.name
                        } (FKDR: ${member.fkdr.toFixed(2)}, Void Deaths/Death: ${(
                            member.void_deaths_per_death * 100
                        ).toFixed(1)}%)`,
                )
                .join("\n"),
        );
    },
    commandData: new SlashCommandBuilder()
        .setName("leaderboard")
        .setDescription("get's the top 10 players of the guild by star")
        .addStringOption((option) =>
            option.setName("sort").setDescription("sorting method").addChoices(
                { name: "Star", value: "bedwars_level" },
                { name: "FKDR", value: "fkdr" },
                {
                    name: "Void Deaths/Regular Death",
                    value: "void_deaths_per_death",
                },
            ),
        )
        .addStringOption((option) =>
            option
                .setName("direction")
                .setDescription("Top 10 or Bottom 10?")
                .addChoices(
                    { name: "Top 10", value: "forwards" },
                    { name: "Bottom 10", value: "backwards" },
                )
                .setRequired(false),
        ),
};
