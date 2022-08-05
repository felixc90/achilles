const { SlashCommandBuilder } = require('@discordjs/builders');
const fetch = require('node-fetch');
const dotenv = require('dotenv');
const { updateUsers } = require('../utils/update')

dotenv.config()

module.exports = {
	data: new SlashCommandBuilder()
		.setName('update')
		.setDescription('Updates running data for everyone in the server!'),
        async execute(interaction) {
            await updateUsers(interaction.guild.id)
            await interaction.reply({content : '⚡️ Stats have been updated! ⚡️'})
        }
};