import { ButtonInteraction } from "discord.js";
import { Button } from './button';
import { Guild } from "../../db";
import { errorMessage } from "../utils/error";
import { GuildService } from "../services";
import { IGuild } from "../types";
import { createLeaderboard } from "../commands/leaderboard";
import { LeaderboardHelper } from "../utils/leaderboard-helper";

export const PrevPageButton: Button = {
	customId: 'prev-page',
	execute: async (interaction: ButtonInteraction) => {
		
		if (!interaction.guildId) return interaction.reply(errorMessage);
		const guildService = new GuildService(interaction.guildId);

		const pageNumber = LeaderboardHelper.parsePageNumber(interaction.message.embeds[0]);
		const week = LeaderboardHelper.parseWeekDate(interaction.message.embeds[0]);

		const data = await guildService.getWeeklyTopUsers(week);
	
		const { embed, row } = createLeaderboard(data, interaction.guild?.iconURL(), week, pageNumber - 1);
	
		return interaction.reply({
			embeds: [embed],
			components: [row]
		})
	}
}