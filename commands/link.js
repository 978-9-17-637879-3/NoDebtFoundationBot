const { SlashCommandBuilder } = require("discord.js");
const axios = require("axios");

module.exports = {
    name: "link",
    exec: async function (interaction, database) {
        const username = interaction.options.get("username").value;

        try {
            const profileResponse = await axios({
                method: "GET",
                url: `https://api.mojang.com/users/profiles/minecraft/${username}`,
            });

            await database
                .collection("memberRegistry")
                .updateOne(
                    { id: interaction.user.id },
                    { $set: { uuid: profileResponse.data.id } },
                    { upsert: true },
                );

            return interaction.reply("Account linked!");
        } catch (e) {
            console.error(e);
            return interaction.reply({
                content: "Failed to link that account!",
                ephemeral: true,
            });
        }
    },
    commandData: new SlashCommandBuilder()
        .setName("link")
        .setDescription(
            "link a minecraft account to your discord account for use with /member",
        )
        .addStringOption((option) =>
            option
                .setName("username")
                .setDescription("username you want to link")
                .setRequired(true),
        ),
};
