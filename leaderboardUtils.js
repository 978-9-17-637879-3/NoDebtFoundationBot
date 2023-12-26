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
        reverse: true,
    },
    { name: "Beds Broken/Lost", value: "bblr", ratio: true },
    { name: "Wins/Losses", value: "wlr", ratio: true },
    { name: "Emeralds/Game", value: "emeralds_per_game", ratio: true },
    { name: "Diamonds/Game", value: "diamonds_per_game", ratio: true },
    { name: "Weekly GEXP", value: "weekly_guild_experience" },
    { name: "Average Rank", value: "average_rank", ratio: true, reverse: true },
];

module.exports.STAT_OPTIONS = STAT_OPTIONS;

module.exports.renderStatValueString = (memberData, stat) => {
    if (stat.ratio) {
        return memberData.stats[stat.value].num.toFixed(2);
    } else if (stat.percentage) {
        return (memberData.stats[stat.value].num * 100).toFixed(1) + "%";
    } else {
        return memberData.stats[stat.value].num;
    }
};

module.exports.generateLeaderboard = async (
    first,
    last,
    statValue,
    guildData,
    dataTs,
) => {
    const members = guildData?.stats ?? [];

    let lbMembers = members.sort(
        (a, b) => b.stats[statValue].num - a.stats[statValue].num,
    );

    const stat = STAT_OPTIONS.find((statOption) => statOption.value === statValue);

    if (stat.reverse) lbMembers.reverse();
    lbMembers = lbMembers.slice(first, last);

    const embed = new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle(`${stat.name} Leaderboard`)
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
            name: `${first + i + 1}. [${member.stats.bedwars_level.num}☆] ${member.name}`,
            value: STAT_OPTIONS.filter((stat) => stat.value != "bedwars_level")
                .map(
                    (stat) =>
                        `${stat.name}: ${module.exports.renderStatValueString(
                            member,
                            stat,
                        )}`,
                )
                .join(", "),
        });
    }

    const statsDropdown = new StringSelectMenuBuilder()
        .setCustomId("statsDropdown")
        .setPlaceholder(
            STAT_OPTIONS.find((statOption) => statOption.value === statValue).name,
        )
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

    const deleteButton = new ButtonBuilder()
        .setCustomId("delete")
        .setLabel("Delete")
        .setStyle(ButtonStyle.Danger)
        .setEmoji("🗑️");

    const dropdownRow = new ActionRowBuilder().addComponents(statsDropdown);

    const buttonsRow = new ActionRowBuilder().addComponents(
        firstButton,
        prevButton,
        nextButton,
        lastButton,
        deleteButton,
    );

    return {
        embeds: [embed],
        components: [dropdownRow, buttonsRow],
    };
};
