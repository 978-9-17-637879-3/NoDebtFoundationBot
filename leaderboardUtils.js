const {
    EmbedBuilder,
    ButtonBuilder,
    ButtonStyle,
    ActionRowBuilder,
    StringSelectMenuBuilder,
} = require("discord.js");

const STAT_OPTIONS = [
    { name: "Bedwars Level", value: "bedwars_level" },
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
    { name: "Weekly GEXP", value: "weekly_guild_experience" },
];

module.exports.STAT_OPTIONS = STAT_OPTIONS;

module.exports.generateLeaderboard = async (first, last, stat, guildData, dataTs) => {
    const members = guildData?.stats ?? [];

    const lbMembers = members
        .sort((a, b) => b.stats[stat] - a.stats[stat])
        .slice(first, last);

    const embed = new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle(
            `${
                STAT_OPTIONS.find((statOption) => statOption.value === stat).name
            } Leaderboard`,
        )
        .setFooter({
            text: `Last Updated ${
                dataTs
                    ? `${Math.floor((Date.now() - dataTs) / 1000)} seconds ago`
                    : "Never"
            }`,
        });

    for (let i = 0; i < lbMembers.length; i++) {
        const member = lbMembers[i];
        embed.addFields({
            name: `${first + i + 1}. [${member.stats.bedwars_level}☆] ${member.name}`,
            value: STAT_OPTIONS.filter((stat) => stat.value != "bedwars_level")
                .map((stat) => {
                    let statString = `${stat.name}: `;

                    if (stat.ratio) {
                        statString += member.stats[stat.value].toFixed(2);
                    } else if (stat.percentage) {
                        statString += (member.stats[stat.value] * 100).toFixed(1) + "%";
                    } else {
                        statString += member.stats[stat.value];
                    }

                    return statString;
                })
                .join(", "),
        });
    }

    const statsDropdown = new StringSelectMenuBuilder()
        .setCustomId("statsDropdown")
        .setPlaceholder(STAT_OPTIONS.find((statOption) => statOption.value === stat).name)
        .addOptions(
            ...STAT_OPTIONS.map((statOption) => ({
                label: statOption.name,
                value: statOption.value,
            })),
        );

    const firstButton = new ButtonBuilder()
        .setCustomId("first")
        .setLabel("First")
        .setStyle(ButtonStyle.Primary)
        .setEmoji("⏮️");

    const prevButton = new ButtonBuilder()
        .setCustomId("prev")
        .setLabel("Prev")
        .setStyle(ButtonStyle.Primary)
        .setEmoji("⏪");

    const nextButton = new ButtonBuilder()
        .setCustomId("next")
        .setLabel("Next")
        .setStyle(ButtonStyle.Primary)
        .setEmoji("⏩");

    const lastButton = new ButtonBuilder()
        .setCustomId("last")
        .setLabel("Last")
        .setStyle(ButtonStyle.Primary)
        .setEmoji("⏭️");

    const dropdownRow = new ActionRowBuilder().addComponents(statsDropdown);

    const buttonsRow = new ActionRowBuilder().addComponents(
        firstButton,
        prevButton,
        nextButton,
        lastButton,
    );

    return {
        embeds: [embed],
        components: [dropdownRow, buttonsRow],
    };
};
