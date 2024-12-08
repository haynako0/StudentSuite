const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
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
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                await interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
                return;
            }

            const role = interaction.options.getRole('role');

            if (!role) {
                await interaction.reply({ content: 'Subject not found!', ephemeral: true });
                return;
            }

            const dbFolderPath = path.join(__dirname, '../databases');
            const sanitizedRoleName = role.name.replace(/[<>:"/\\|?*]/g, '_');
            const dbPath = path.join(dbFolderPath, `${sanitizedRoleName}-${role.id}.db`);

            if (!fs.existsSync(dbPath)) {
                await interaction.reply({ content: `No attendance records found for the subject: ${role.name}`, ephemeral: true });
                return;
            }

            const db = new sqlite3.Database(dbPath);

            db.all('SELECT DISTINCT date FROM attendance', async (err, rows) => {
                if (err) {
                    logger.error(`Error retrieving data from database: ${err.stack || err.message}`);
                    await interaction.reply({ content: 'There was an error retrieving attendance records.', ephemeral: true });
                    return;
                }

                if (rows.length === 0) {
                    await interaction.reply({ content: `No records found for the subject: ${role.name}`, ephemeral: true });
                    return;
                }

                const dateButtons = rows.map(row =>
                    new ButtonBuilder()
                        .setCustomId(`records_${row.date}`)
                        .setLabel(row.date)
                        .setStyle(ButtonStyle.Primary)
                );

                const rowComponents = [];
                for (let i = 0; i < dateButtons.length; i += 5) {
                    rowComponents.push(new ActionRowBuilder().addComponents(dateButtons.slice(i, i + 5)));
                }

                let dateEmbed = new EmbedBuilder()
                    .setColor(5798747)
                    .setDescription(`# 📅 Select a Date to View Attendance for the Role:\n### Choose a date from the buttons below:`)
                    .setThumbnail('https://i.imgur.com/FeekXot.png')
                    .setFooter({ text: 'You have 60 seconds to interact.', iconURL: 'https://i.pinimg.com/736x/cb/b4/76/cbb47685095fec0e83f13906f64c1edb.jpg' })
                    .setTimestamp();

                await interaction.deferReply({ ephemeral: true });
                const message = await interaction.editReply({ embeds: [dateEmbed], components: rowComponents, fetchReply: true });

                const filter = i => i.customId.startsWith('records_') && i.user.id === interaction.user.id;
                const collector = interaction.channel.createMessageComponentCollector({ filter, time: 60000 });

                const interval = setInterval(() => {
                    const remainingTime = Math.ceil((60000 - (Date.now() - message.createdTimestamp)) / 1000);
                    if (remainingTime > 0) {
                        dateEmbed.setFooter({ text: `You have ${remainingTime} seconds to interact.`, iconURL: 'https://i.pinimg.com/736x/cb/b4/76/cbb47685095fec0e83f13906f64c1edb.jpg' });
                        interaction.editReply({ embeds: [dateEmbed] });
                    }
                }, 1000);

                collector.on('collect', async i => {
                    clearInterval(interval);
                    const date = i.customId.split('_')[1];
                    await i.deferUpdate();

                    await i.editReply({ components: [] });

                    db.all('SELECT name, status, timestamp FROM attendance WHERE date = ? ORDER BY timestamp ASC', [date], async (err, rows) => {
                        if (err) {
                            logger.error(`Error retrieving data from database: ${err.stack || err.message}`);
                            await i.followUp({ content: 'There was an error retrieving attendance records.', ephemeral: true });
                            return;
                        }

                        if (rows.length === 0) {
                            await i.followUp({ content: `No records found for the date: ${date}`, ephemeral: true });
                            return;
                        }

                        const pageSize = 10;
                        let page = 0;
                        const totalPages = Math.ceil(rows.length / pageSize);

                        const generateEmbed = (currentPage) => {
                            const embed = new EmbedBuilder()
                                .setColor(5798747)
                                .setDescription(`# 📋 Attendance Records for ${role.name} on ${date}`)
                                .setImage('https://i.imgur.com/fZoI8Fi.png')
                                .setThumbnail('https://i.imgur.com/FeekXot.png')
                                .setFooter({ text: `Page ${currentPage + 1} of ${totalPages}`, iconURL: 'https://i.pinimg.com/736x/cb/b4/76/cbb47685095fec0e83f13906f64c1edb.jpg' })
                                .setTimestamp();

                            const records = rows.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
                            records.forEach(record => {
                                const statusField = `**Status**: ${record.status}`;
                                const timestampField = record.status === 'Absent' ? '' : `\n**Timestamp**: ${record.timestamp}`;
                                embed.addFields({
                                    name: `${record.name}`,
                                    value: statusField + timestampField
                                });
                            });

                            return embed;
                        };

                        const embedMessage = await i.followUp({
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
                    });
                });

                collector.on('end', collected => {
                    clearInterval(interval);
                    if (collected.size === 0) {
                        interaction.followUp({ content: 'No date selected. Records retrieval cancelled.', ephemeral: true });
                    }
                });
            });

        } catch (error) {
            logger.error(`Error in records command: ${error.stack || error.message}`);
            await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
        }
    },
};
