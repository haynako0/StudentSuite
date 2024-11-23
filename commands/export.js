const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit-table');
const logger = require('../logs/logs.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('export')
        .setDescription('Export attendance records for a specific role')
        .addRoleOption(option =>
            option.setName('role')
                .setDescription('The subject/role to export attendance for')
                .setRequired(true)
        ),
    async execute(interaction) {
        try {
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                await interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
                return;
            }

            const role = interaction.options.getRole('role');
            const dbFolderPath = path.join(__dirname, '../databases');
            const sanitizedRoleName = role.name.replace(/[<>:"/\\|?*]/g, '_');
            const dbPath = path.join(dbFolderPath, `${sanitizedRoleName}-${role.id}.db`);

            if (!fs.existsSync(dbPath)) {
                await interaction.reply({ content: `No database found for the role: ${role.name}`, ephemeral: true });
                return;
            }

            const db = new sqlite3.Database(dbPath);

            db.all('SELECT DISTINCT date FROM attendance', async (err, rows) => {
                if (err) {
                    logger.error(`Database error: ${err.message}`);
                    interaction.reply({ content: 'An error occurred while fetching the dates.', ephemeral: true });
                    return;
                }

                if (rows.length === 0) {
                    interaction.reply({ content: `No attendance records found for ${role.name}.`, ephemeral: true });
                    return;
                }

                const dateButtons = rows.map(row =>
                    new ButtonBuilder()
                        .setCustomId(`export_${row.date}`)
                        .setLabel(row.date)
                        .setStyle(ButtonStyle.Primary)
                );

                const rowComponents = [];
                for (let i = 0; i < dateButtons.length; i += 5) {
                    rowComponents.push(new ActionRowBuilder().addComponents(dateButtons.slice(i, i + 5)));
                }

                let dateEmbed = new EmbedBuilder()
                    .setColor('#0099ff')
                    .setTitle(`Select a Date to Export Attendance for Role: ${role.name}`)
                    .setDescription('Choose a date from the buttons below:')
                    .setFooter({ text: 'You have 60 seconds to interact.' })
                    .setTimestamp();

                await interaction.deferReply({ ephemeral: true });
                const message = await interaction.editReply({ embeds: [dateEmbed], components: rowComponents, fetchReply: true });

                const filter = i => i.customId.startsWith('export_') && i.user.id === interaction.user.id;
                const collector = interaction.channel.createMessageComponentCollector({ filter, time: 60000 });

                const interval = setInterval(() => {
                    const remainingTime = Math.ceil((60000 - (Date.now() - message.createdTimestamp)) / 1000);
                    if (remainingTime > 0) {
                        dateEmbed.setFooter({ text: `You have ${remainingTime} seconds to interact.` });
                        interaction.editReply({ embeds: [dateEmbed] });
                    }
                }, 1000);

                collector.on('collect', async i => {
                    clearInterval(interval);
                    const date = i.customId.split('_')[1];
                    await i.deferUpdate();

                    await i.editReply({ components: [] });

                    const pdfFolderPath = path.join(__dirname, '../exports');

                    if (!fs.existsSync(pdfFolderPath)) {
                        fs.mkdirSync(pdfFolderPath, { recursive: true });
                    }

                    const uniqueTime = new Date().toISOString().replace(/[-:.TZ]/g, '');
                    const pdfPath = path.join(pdfFolderPath, `${sanitizedRoleName}_${interaction.guild.name.replace(/ /g, '_')}_${date.replace(/ /g, '_')}_${uniqueTime}.pdf`);
                    const pdfDoc = new PDFDocument({ margin: 50 });

                    pdfDoc.pipe(fs.createWriteStream(pdfPath));

                    const serverName = interaction.guild.name;
                    const professors = interaction.guild.members.cache
                        .filter(member => member.permissions.has('Administrator') && !member.user.bot)
                        .map(member => member.user.tag)
                        .join(', ') || 'None';

                    pdfDoc
                        .fontSize(24)
                        .fillColor('#2e86c1')
                        .text(`Attendance Records`, { align: 'center' })
                        .fontSize(16)
                        .fillColor('black')
                        .text(`Date: ${date}`, { align: 'center' })
                        .text(`Subject: ${role.name}`, { align: 'center' })
                        .text(`Server: ${serverName}`, { align: 'center' })
                        .text(`Professors: ${professors}`, { align: 'center' })
                        .moveDown(1);

                    db.all('SELECT name, status, timestamp FROM attendance WHERE date = ?', [date], async (err, rows) => {
                        if (err) {
                            logger.error(`Database error: ${err.message}`);
                            i.followUp({ content: 'An error occurred while exporting the data.', ephemeral: true });
                            return;
                        }

                        if (rows.length === 0) {
                            i.followUp({ content: `No attendance records found for ${date}.`, ephemeral: true });
                            return;
                        }

                        const table = {
                            headers: ['Name', 'Status', 'Timestamp'],
                            rows: rows.map(row => [
                                row.name,
                                row.status,
                                row.status === 'Absent' ? 'N/A' : row.timestamp,
                            ]),
                        };

                        pdfDoc.table(table, {
                            prepareHeader: () => pdfDoc.fontSize(12).fillColor('#2c3e50'),
                            prepareRow: (row, indexColumn) => pdfDoc.fontSize(10).fillColor(indexColumn % 2 === 0 ? 'black' : '#555555'),
                            columnSpacing: 10,
                            padding: 5,
                        });

                        pdfDoc.end();

                        const exportEmbed = new EmbedBuilder()
                            .setColor('#0099ff')
                            .setTitle(`Export Successful for Role: ${role.name}`)
                            .setDescription(`Attendance records for ${role.name} on ${date} have been exported.`)
                            .setTimestamp();

                        i.followUp({ embeds: [exportEmbed], files: [{ attachment: pdfPath, name: path.basename(pdfPath) }] });
                    });
                });

                collector.on('end', collected => {
                    clearInterval(interval);
                    if (collected.size === 0) {
                        interaction.followUp({ content: 'No date selected. Export cancelled.', ephemeral: true });
                    }
                });
            });

        } catch (error) {
            logger.error(`Error in export command: ${error.stack || error.message}`);
            await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
        }
    },
};
