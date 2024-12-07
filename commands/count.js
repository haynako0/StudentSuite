const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
const logger = require('../logs/logs.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('count')
        .setDescription('Count attendance records for a specific subject')
        .addRoleOption(option =>
            option.setName('role')
                .setDescription('Subject to count attendance records for')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('option')
                .setDescription('Choose between student and date')
                .setRequired(true)
                .addChoices(
                    { name: 'student', value: 'student' },
                    { name: 'date', value: 'date' }
                )
        )
        .addStringOption(option =>
            option.setName('student')
                .setDescription('Student name to count attendance records for')
        )
        .addStringOption(option =>
            option.setName('date')
                .setDescription('Date to count attendance records for')
        ),
    async execute(interaction) {
        try {
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                await interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
                return;
            }

            const role = interaction.options.getRole('role');
            const option = interaction.options.getString('option');
            const student = interaction.options.getString('student');
            const date = interaction.options.getString('date');

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

            if (option === 'student') {
                if (!student) {
                    await interaction.reply({ content: 'Student name is required for this option.', ephemeral: true });
                    return;
                }

                db.all('SELECT status FROM attendance WHERE name = ?', [student], async (err, rows) => {
                    if (err) {
                        logger.error(`Error retrieving data from database: ${err.stack || err.message}`);
                        await interaction.reply({ content: 'There was an error retrieving attendance records.', ephemeral: true });
                        return;
                    }

                    if (rows.length === 0) {
                        await interaction.reply({ content: `No records found for the student: ${student}`, ephemeral: true });
                        return;
                    }

                    const total = rows.length;
                    const presents = rows.filter(row => row.status === 'Present').length;
                    const absents = rows.filter(row => row.status === 'Absent').length;

                    const embed = new EmbedBuilder()
                        .setColor('#0099ff')
                        .setTitle(`Attendance Summary for ${student}`)
                        .addFields(
                            { name: 'Total Attendances', value: total.toString(), inline: true },
                            { name: 'Presents', value: presents.toString(), inline: true },
                            { name: 'Absents', value: absents.toString(), inline: true }
                        )
                        .setTimestamp();

                    await interaction.reply({ embeds: [embed], ephemeral: true });
                });
            } else if (option === 'date') {
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
                            .setCustomId(`count_${row.date}`)
                            .setLabel(row.date)
                            .setStyle(ButtonStyle.Primary)
                    );

                    const rowComponents = [];
                    for (let i = 0; i < dateButtons.length; i += 5) {
                        rowComponents.push(new ActionRowBuilder().addComponents(dateButtons.slice(i, i + 5)));
                    }

                    let dateEmbed = new EmbedBuilder()
                        .setColor('#0099ff')
                        .setTitle(`Select a Date to Count Attendance for Role: ${role.name}`)
                        .setDescription('Choose a date from the buttons below:')
                        .setFooter({ text: 'You have 60 seconds to interact.' })
                        .setTimestamp();

                    await interaction.deferReply({ ephemeral: true });
                    const message = await interaction.editReply({ embeds: [dateEmbed], components: rowComponents, fetchReply: true });

                    const filter = i => i.customId.startsWith('count_') && i.user.id === interaction.user.id;
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
                        const selectedDate = i.customId.split('_')[1];
                        await i.deferUpdate();

                        await i.editReply({ components: [] });

                        db.all('SELECT status FROM attendance WHERE date = ?', [selectedDate], async (err, rows) => {
                            if (err) {
                                logger.error(`Error retrieving data from database: ${err.stack || err.message}`);
                                await i.followUp({ content: 'There was an error retrieving attendance records.', ephemeral: true });
                                return;
                            }

                            if (rows.length === 0) {
                                await i.followUp({ content: `No records found for the date: ${selectedDate}`, ephemeral: true });
                                return;
                            }

                            const total = rows.length;
                            const presents = rows.filter(row => row.status === 'Present').length;
                            const absents = rows.filter(row => row.status === 'Absent').length;

                            const embed = new EmbedBuilder()
                                .setColor('#0099ff')
                                .setTitle(`Attendance Summary for ${selectedDate}`)
                                .addFields(
                                    { name: 'Total Attendances', value: total.toString(), inline: true },
                                    { name: 'Presents', value: presents.toString(), inline: true },
                                    { name: 'Absents', value: absents.toString(), inline: true }
                                )
                                .setTimestamp();

                            await i.followUp({ embeds: [embed], ephemeral: true });
                        });
                    });

                    collector.on('end', collected => {
                        clearInterval(interval);
                        if (collected.size === 0) {
                            interaction.followUp({ content: 'No date selected. Count retrieval cancelled.', ephemeral: true });
                        }
                    });
                });
            }

        } catch (error) {
            logger.error(`Error in count command: ${error.stack || error.message}`);
            await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
        }
    },
};
