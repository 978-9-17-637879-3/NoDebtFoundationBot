const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  name: "online",
  exec: async function (interaction, redisClient) {
    const members = JSON.parse((await redisClient.get("memberData")) ?? "[]");

    return interaction.reply(
      members.filter((member) => member.is_online).map(member => member.name).join(", ") ?? "No one is online! What a rarity..."
    );
  },
  commandData: new SlashCommandBuilder()
    .setName("online")
    .setDescription("get's the members that are currently online"),
};
