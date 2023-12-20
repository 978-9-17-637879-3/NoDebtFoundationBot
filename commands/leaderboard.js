const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const STAT_OPTIONS = [
    { name: "Star", value: "bedwars_level" },
    { name: "FKDR", value: "fkdr", ratio: true },
    {
        name: "Void Deaths/Regular Death",
        value: "void_deaths_per_death",
        percentage: true,
    },
    { name: "Beds Broken/Lost", value: "bblr", ratio: true },
    { name: "Wins/Losses", value: "wlr", ratio: true },
    { name: "Emeralds/Game", value: "emeralds_per_game", ratio: true },
    { name: "Diamonds/Game", value: "diamonds_per_game", ratio: true },
];

module.exports = {
    name: "leaderboard",
    exec: async function (interaction, database) {
        const guildData = (
            await database
                .collection("guildData")
                .find({})
                .sort({ updated: -1 })
                .limit(1)
                .toArray()
        )?.[0];

        const members = guildData?.stats ?? [];

        const direction = interaction.options.get("direction")?.value ?? "forwards";

        const lbMembers = members
            .sort(
                (a, b) =>
                    b.stats[interaction.options.get("sort").value] -
                    a.stats[interaction.options.get("sort").value],
            )
            .slice(
                direction === "forwards" ? 0 : Math.max(0, members.length - 10),
                direction === "forwards" ? 10 : members.length,
            );

        const lastUpdated = Number(guildData?.updated ?? "0");

        const embed = new EmbedBuilder()
            .setColor(0x0099ff)
            .setTitle(
                `${direction === "forwards" ? "Top" : "Bottom"} 10 members by ${
                    STAT_OPTIONS.find(
                        (stat) => stat.value === interaction.options.get("sort").value,
                    ).name
                }`,
            )
            .setFooter({
                text: `Last Updated ${
                    lastUpdated
                        ? `${Math.floor((Date.now() - lastUpdated) / 1000)} seconds ago`
                        : "Never"
                }`,
            });

        for (let i = 0; i < lbMembers.length; i++) {
            const member = lbMembers[i];
            embed.addFields({
                name: `${
                    (direction === "forwards" ? 0 : members.length - 10) + i + 1
                }. [${member.stats.bedwars_level}☆] ${member.name}`,
                value: STAT_OPTIONS.filter((stat) => stat.name != "Star")
                    .map((stat) => {
                        let statString = `${stat.name}: `;

                        if (stat.ratio) {
                            statString += member.stats[stat.value].toFixed(2);
                        } else if (stat.percentage) {
                            statString +=
                                (member.stats[stat.value] * 100).toFixed(1) + "%";
                        } else {
                            statString += member.stats[stat.value];
                        }

                        return statString;
                    })
                    .join(", "),
            });
        }

        return interaction.reply({ embeds: [embed] });
    },
    commandData: new SlashCommandBuilder()
        .setName("leaderboard")
        .setDescription(
            "get's the top/bottom 10 players of the guild by various statistics",
        )
        .addStringOption((option) =>
            option
                .setName("sort")
                .setDescription("sorting method")
                .addChoices(...STAT_OPTIONS),
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
