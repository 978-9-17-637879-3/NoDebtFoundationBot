const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require("discord.js");
const { STAT_OPTIONS, renderStatValueString } = require("../leaderboardUtils");
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
        const guildData = (
            await database
                .collection("guildData")
                .find({})
                .sort({ updated: -1 })
                .limit(1)
                .toArray()
        )[0];

        if (!guildData)
            return interaction.reply({
                content: "No guild data found!",
                ephemeral: true,
            });

        const dataTs = guildData?.updated ?? 0;

        let memberData;

        const usernameArgument = interaction.options.get("username")?.value;
        if (usernameArgument) {
            memberData = guildData?.stats?.find(
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

            memberData = guildData?.stats?.find((member) => member.uuid === uuid);
        }

        if (!memberData)
            return interaction.reply({
                content: "Player data could not be found!",
                ephemeral: true,
            });

        const embed = new EmbedBuilder()
            .setColor(0x0099ff)
            .setTitle(`${memberData.name}'s Stats`)
            .setFooter({
                text: `Last Updated ${
                    dataTs
                        ? `${Math.floor((Date.now() - dataTs) / 1000)} seconds ago`
                        : "Never"
                }`,
            });

        for (const statOption of STAT_OPTIONS) {
            let stats = guildData.stats.sort(
                (a, b) => b.stats[statOption.value].num - a.stats[statOption.value].num,
            );

            if (statOption.reverse) stats.reverse();

            let rank = stats.findIndex((member) => member.uuid === memberData.uuid) + 1;

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
        ),
};
