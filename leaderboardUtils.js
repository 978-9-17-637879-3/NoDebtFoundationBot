const {
    EmbedBuilder,
    ButtonBuilder,
    ButtonStyle,
    ActionRowBuilder,
    StringSelectMenuBuilder,
} = require("discord.js");

module.exports.MEMBER_COUNT_PER_PAGE = 5;

module.exports.STAT_OPTIONS = [
    { name: "Bedwars Level", value: "bedwars_level" },
    { name: "FKDR", value: "fkdr", ratio: true },
    { name: "Wins/Losses", value: "wlr", ratio: true },
    { name: "Beds Broken/Lost", value: "bblr", ratio: true },
    {
        name: "Void Deaths/Regular Death",
        value: "void_deaths_per_death",
        percentage: true,
        reverse: true,
    },
    { name: "Emeralds/Game", value: "emeralds_per_game", ratio: true },
    { name: "Diamonds/Game", value: "diamonds_per_game", ratio: true },
    { name: "Weekly GEXP", value: "weekly_guild_experience" },
    { name: "Average Rank", value: "average_rank", ratio: true, reverse: true },
];

module.exports.getStat = (memberData, stat, since_tracking) => {
    return memberData[since_tracking ? "diffStats" : "stats"][stat];
};

module.exports.renderStatValueString = (memberData, statOption, since_tracking) => {
    const stat = module.exports.getStat(memberData, statOption.value, since_tracking);

    if (statOption.ratio) {
        let result = `${stat.num.toFixed(2)}`;

        if (statOption.value !== "average_rank")
            result += ` | (${stat.numerator}/${stat.denominator})`;

        return result;
    } else if (statOption.percentage) {
        return `${(stat.num * 100).toFixed(1)}% | (${stat.numerator}/${
            stat.denominator
        })`;
    } else {
        return `${stat.num}`;
    }
};

module.exports.filterMembersWhoHaventPlayedAGame = (members, since_tracking) => {
    return members.filter(
        (member) =>
            module.exports.getStat(member, "emeralds_per_game", since_tracking)
                ?.denominator > 0,
    );
};

module.exports.generateLeaderboard = async (
    first,
    last,
    statValue,
    guildData,
    dataTs,
    since_tracking,
) => {
    const statsKey = since_tracking ? "diffStats" : "stats";

    const members = module.exports.filterMembersWhoHaventPlayedAGame(
        guildData?.members ?? [],
        statsKey,
    );

    let lbMembers = members.sort(
        (a, b) =>
            module.exports.getStat(b, statValue, since_tracking).num -
            module.exports.getStat(a, statValue, since_tracking).num,
    );

    const stat = module.exports.STAT_OPTIONS.find(
        (statOption) => statOption.value === statValue,
    );

    if (stat.reverse) lbMembers.reverse();
    lbMembers = lbMembers.slice(first, last);

    const embed = new EmbedBuilder()
        .setColor(since_tracking ? 0x00ff099 : 0x0099ff)
        .setTitle(`${stat.name} Leaderboard${since_tracking ? " Since Tracking" : ""}`)
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
            name: `${first + i + 1}. [${member[statsKey].bedwars_level.num}☆] ${
                member.name
            }`,
            value: module.exports.STAT_OPTIONS.filter(
                (stat) => stat.value !== "bedwars_level",
            )
                .map(
                    (stat) =>
                        `${stat.name}: ${module.exports.renderStatValueString(
                            member,
                            stat,
                            since_tracking,
                        )}`,
                )
                .join("\n"),
        });
    }

    const statsDropdown = new StringSelectMenuBuilder()
        .setCustomId("statsDropdown")
        .setPlaceholder(
            module.exports.STAT_OPTIONS.find(
                (statOption) => statOption.value === statValue,
            ).name,
        )
        .addOptions(
            ...module.exports.STAT_OPTIONS.map((statOption) => ({
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

    const updateButton = new ButtonBuilder()
        .setCustomId("update")
        .setLabel("Update")
        .setStyle(ButtonStyle.Success)
        .setEmoji("🔁");

    const deleteButton = new ButtonBuilder()
        .setCustomId("delete")
        .setLabel("Delete")
        .setStyle(ButtonStyle.Danger)
        .setEmoji("🗑️");

    const dropdownRow = new ActionRowBuilder().addComponents(statsDropdown);

    const firstButtonsRow = new ActionRowBuilder().addComponents(
        firstButton,
        prevButton,
        nextButton,
        lastButton,
    );

    const secondButtonsRow = new ActionRowBuilder().addComponents(
        updateButton,
        deleteButton,
    );

    return {
        embeds: [embed],
        components: [dropdownRow, firstButtonsRow, secondButtonsRow],
    };
};

module.exports.safeDiv = (a, b) => {
    return (a ?? 0) / ((b ?? 0) === 0 ? 1 : b);
};

module.exports.safeAdder = (...args) => {
    let sum = 0;
    for (const arg of args) {
        sum += arg ?? 0;
    }
    return sum;
};

module.exports.processRanks = (members, statsKey) => {
    for (const statOption of module.exports.STAT_OPTIONS) {
        if (statOption.value === "average_rank") continue;

        let sortedStatsCopy = members
            .slice() // copies array so that sort doesn't mutate
            .sort(
                (a, b) =>
                    b[statsKey][statOption.value].num - a[statsKey][statOption.value].num,
            );

        if (statOption.reverse) sortedStatsCopy.reverse();

        for (let i = 0; i < members.length; i++) {
            members[i].rankSum =
                (members[i].rankSum ?? 0) +
                sortedStatsCopy.findIndex((member) => member.uuid === members[i].uuid) +
                1;
        }
    }

    for (let i = 0; i < members.length; i++) {
        members[i][statsKey].average_rank = {
            numerator: members[i].rankSum,
            denominator: module.exports.STAT_OPTIONS.length - 1,
            num: module.exports.safeDiv(
                members[i].rankSum,
                module.exports.STAT_OPTIONS.length - 1,
            ),
        };
        delete members[i].rankSum;
    }

    return members;
};
