const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
const logger = require('../logs/logs.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('records')
        .setDescription('Retrieve attendance records for a specific subject')
        .addRoleOption(option =>
            option.setName('role')
                .setDescription('Subject to retrieve attendance records for')
                .setRequired(true)
        ),
    async execute(interaction) {
        try {
            const role = interaction.options.getRole('role');

            if (!role) {
                await interaction.reply({ content: 'Subject not found!', ephemeral: true });
                return;
            }

            const dbFolderPath = path.join(__dirname, '../databases');
            const sanitizedRoleName = role.name.replace(/[<>:"/\\|?*]/g, '_');
            const dbPath = path.join(dbFolderPath, `${sanitizedRoleName}.db`);

            if (!fs.existsSync(dbPath)) {
                await interaction.reply({ content: `No attendance records found for the subject: ${role.name}`, ephemeral: true });
                return;
            }

            const db = new sqlite3.Database(dbPath);

            db.all('SELECT date, name, status, timestamp FROM attendance ORDER BY timestamp ASC', [], async (err, rows) => {
                if (err) {
                    logger.error(`Error retrieving data from database: ${err.stack || err.message}`);
                    await interaction.reply({ content: 'There was an error retrieving attendance records.', ephemeral: true });
                    return;
                }

                if (rows.length === 0) {
                    await interaction.reply({ content: `No records found for the subject: ${role.name}`, ephemeral: true });
                    return;
                }

                const pageSize = 10;
                let page = 0;
                const totalPages = Math.ceil(rows.length / pageSize);

                const generateEmbed = (currentPage) => {
                    const embed = new EmbedBuilder()
                        .setColor('#0099ff')
                        .setTitle(`Attendance Records for ${role.name}`)
                        .setFooter({ text: `Page ${currentPage + 1} of ${totalPages}` })
                        .setTimestamp();

                    const records = rows.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
                    records.forEach(record => {
                        embed.addFields({
                            name: `${record.name}`,
                            value: `**Date**: ${record.date}\n**Status**: ${record.status}\n**Timestamp**: ${record.timestamp}`
                        });
                    });

                    return embed;
                };

                const embedMessage = await interaction.reply({
                    embeds: [generateEmbed(page)],
                    fetchReply: true,
                });

                if (totalPages > 1) {
                    await embedMessage.react('⬅️');
                    await embedMessage.react('➡️');

                    const filter = (reaction, user) => {
                        return ['⬅️', '➡️'].includes(reaction.emoji.name) && user.id === interaction.user.id;
                    };

                    const collector = embedMessage.createReactionCollector({ filter, time: 60000 });

                    collector.on('collect', (reaction) => {
                        if (reaction.emoji.name === '➡️') {
                            if (page < totalPages - 1) page++;
                        } else if (reaction.emoji.name === '⬅️') {
                            if (page > 0) page--;
                        }
                        embedMessage.edit({ embeds: [generateEmbed(page)] });
                    });

                    collector.on('end', () => {
                        embedMessage.reactions.removeAll();
                    });
                }

                db.close();
            });
        } catch (error) {
            logger.error(`Error in records command: ${error.stack || error.message}`);
            await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
        }
    },
};
