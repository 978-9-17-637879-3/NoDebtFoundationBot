const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require("discord.js");
const {
    STAT_OPTIONS,
    renderStatValueString,
    simulateData,
} = require("../leaderboardUtils");
const axios = require("axios");
const sharp = require("sharp");

async function generateMinecraftFaceImageBuffer(uuid) {
    const profileResponse = await axios({
        method: "get",
        url: `https://sessionserver.mojang.com/session/minecraft/profile/${uuid}`,
    });

    const skinResponse = await axios({
        method: "get",
        url: JSON.parse(
            Buffer.from(profileResponse.data.properties[0].value, "base64").toString(),
        ).textures.SKIN.url,
        responseType: "arraybuffer",
    });

    const skin = sharp(skinResponse.data);

    const baseLayer = skin
        .clone()
        .extract({
            top: 8,
            left: 8,
            width: 8,
            height: 8,
        })
        .resize({ width: 256, height: 256, kernel: "nearest" });

    const topLayer = skin
        .clone()
        .extract({
            top: 8,
            left: 40,
            width: 8,
            height: 8,
        })
        .resize({ width: 256, height: 256, kernel: "nearest" });

    return baseLayer
        .composite([{ input: await topLayer.toBuffer() }])
        .png()
        .toBuffer();
}

module.exports = {
    name: "member",
    exec: async function (interaction, database) {
        const since_tracking = interaction.options.get("since_tracking")?.value;

        const data = since_tracking
            ? await simulateData(database)
            : (
                  await database
                      .collection("guildData")
                      .find({})
                      .sort({ updated: -1 })
                      .limit(1)
                      .toArray()
              )[0];

        if (!data)
            return interaction.reply({
                content: "No guild data found!",
                ephemeral: true,
            });

        const dataTs = data?.updated ?? 0;

        let memberData;

        const usernameArgument = interaction.options.get("username")?.value;
        if (usernameArgument) {
            memberData = data?.members?.find(
                (member) => member.name.toUpperCase() === usernameArgument.toUpperCase(),
            );
        } else {
            const uuid = (
                await database
                    .collection("memberRegistry")
                    .findOne({ id: interaction.user.id })
            )?.uuid;
            if (!uuid)
                return interaction.reply({
                    content: "You are not registered with any minecraft account!",
                    ephemeral: true,
                });

            memberData = data?.members?.find((member) => member.uuid === uuid);
        }

        if (!memberData)
            return interaction.reply({
                content: "Player data could not be found!",
                ephemeral: true,
            });

        const embed = new EmbedBuilder()
            .setColor(since_tracking ? 0x00ff099 : 0x0099ff)
            .setTitle(
                `${memberData.name}'s Stats${since_tracking ? " Since Tracking" : ""}`,
            )
            .setFooter({
                text: `Last Updated ${
                    dataTs
                        ? `${Math.floor((Date.now() - dataTs) / 1000)} seconds ago`
                        : "Never"
                }`,
            });

        for (const statOption of STAT_OPTIONS) {
            let members = data.members.sort(
                (a, b) => b.stats[statOption.value].num - a.stats[statOption.value].num,
            );

            if (statOption.reverse) members.reverse();

            let rank = members.findIndex((member) => member.uuid === memberData.uuid) + 1;

            embed.addFields({
                name: statOption.name,
                value: `#${rank} @ ${renderStatValueString(memberData, statOption)}`,
            });
        }

        let response = {};

        try {
            response.files = [
                new AttachmentBuilder(
                    await generateMinecraftFaceImageBuffer(memberData.uuid),
                    { name: "skin.png" },
                ),
            ];
            embed.setThumbnail("attachment://skin.png");
        } catch (e) {
            console.error(e);
        }

        return interaction.reply(Object.assign({}, response, { embeds: [embed] }));
    },
    commandData: new SlashCommandBuilder()
        .setName("member")
        .setDescription("check stats of a specific member")
        .addStringOption((option) =>
            option.setName("username").setDescription("username you want to check"),
        )
        .addBooleanOption((option) =>
            option
                .setName("since_tracking")
                .setDescription(
                    "start stats from when the bot started tracking you, instead of all time",
                ),
        ),
};
