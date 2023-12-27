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
    since_tracking,
) => {
    const members = guildData?.members ?? [];

    let lbMembers = members.sort(
        (a, b) => b.stats[statValue].num - a.stats[statValue].num,
    );

    const stat = STAT_OPTIONS.find((statOption) => statOption.value === statValue);

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

module.exports.processRanks = (members) => {
    for (const statOption of STAT_OPTIONS) {
        if (statOption.value === "average_rank") continue;

        let sortedStatsCopy = members
            .slice() // copies array so that sort doesn't mutate
            .sort(
                (a, b) => b.stats[statOption.value].num - a.stats[statOption.value].num,
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
        members[i].stats.average_rank = {
            numerator: members[i].rankSum,
            denominator: STAT_OPTIONS.length - 1,
            num: module.exports.safeDiv(members[i].rankSum, STAT_OPTIONS.length - 1),
        };
        delete members[i].rankSum;
    }

    return members;
};

module.exports.simulateData = async (database, timestamp) => {
    const currentData = (
        timestamp
            ? await database
                  .collection("guildData")
                  .find({ updated: timestamp })
                  .limit(1)
                  .toArray()
            : await database
                  .collection("guildData")
                  .find({})
                  .sort({ updated: -1 })
                  .limit(1)
                  .toArray()
    )[0];

    const simData = { members: [], updated: currentData.updated };

    for (const member of currentData.members) {
        const findDict = {
            "members.uuid": member.uuid,
        };

        for (const key of Object.keys(member.stats)) {
            findDict[`members.0.stats.${key}.num`] = { $exists: true }; // legacy data support
        }

        const oldestStatsForMember = (
            await database
                .collection("guildData")
                .find(findDict)
                .sort({ updated: 1 })
                .limit(1)
                .toArray()
        )[0]?.members?.find((m) => m.uuid === member.uuid);

        if (!oldestStatsForMember) {
            console.error("impossible?");
            return;
        }

        const newMem = Object.assign({}, member);

        const diffStats = {};

        for (const key of Object.keys(member.stats)) {
            if (key === "average_rank") continue;

            if (!oldestStatsForMember.stats[key].numerator) {
                diffStats[key] = member.stats[key];
                continue;
            }

            diffStats[key] = {};

            diffStats[key].numerator =
                member.stats[key].numerator - oldestStatsForMember.stats[key].numerator;

            diffStats[key].denominator =
                member.stats[key].denominator -
                oldestStatsForMember.stats[key].denominator;

            diffStats[key].num = module.exports.safeDiv(
                diffStats[key].numerator,
                diffStats[key].denominator,
            );
        }

        newMem.stats = diffStats;

        simData.members.push(newMem);
    }

    simData.members = module.exports.processRanks(simData.members);

    return simData;
};
