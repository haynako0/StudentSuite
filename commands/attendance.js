const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
const logger = require('../logs/logs.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('attendance')
        .setDescription('Take attendance for members with a specific subject')
        .addRoleOption(option =>
            option.setName('role')
                .setDescription('Subject to take attendance for')
                .setRequired(true)
        ),
    async execute(interaction) {
        try {
            const channel = interaction.channel;
            const guild = interaction.guild;
            const role = interaction.options.getRole('role');

            if (!role) {
                await interaction.reply({ content: 'Subject not found!', ephemeral: true });
                return;
            }

            const fetchedMembers = await guild.members.fetch();
            const membersWithRole = fetchedMembers.filter(member => member.roles.cache.has(role.id));

            if (membersWithRole.size === 0) {
                await interaction.reply({ content: `No members found with the subject: ${role.name} `, ephemeral: true });
                return;
            }

            const dbFolderPath = path.join(__dirname, '../databases');
            if (!fs.existsSync(dbFolderPath)) {
                fs.mkdirSync(dbFolderPath);
            }

            const sanitizedRoleName = role.name.replace(/[<>:"/\\|?*]/g, '_');
            const dbPath = path.join(dbFolderPath, `${sanitizedRoleName}-${role.id}.db`);
            const db = new sqlite3.Database(dbPath);

            db.serialize(() => {
                db.run(`
                    CREATE TABLE IF NOT EXISTS attendance(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT,
        name TEXT,
        status TEXT,
        timestamp TEXT,
        server_name TEXT
    )
                `);
            });

            const utc8Date = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" }));
            const attendanceStartDate = utc8Date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });

            const commandEmbed = new EmbedBuilder()
                .setColor(5798747)
                .setTitle('✅ Command Successfully Executed')
                .setDescription(`# The attendance command has been executed successfully.`)
                .setThumbnail('https://i.imgur.com/EISYZLs.png')
                .setFooter({ text: 'Powered by StudentSuite', iconURL: 'https://i.pinimg.com/736x/cb/b4/76/cbb47685095fec0e83f13906f64c1edb.jpg' })
                .setTimestamp();

            await interaction.reply({ embeds: [commandEmbed], ephemeral: false });

            const attendanceStartEmbed = new EmbedBuilder()
                .setColor(11944518)
                .setTitle('Attendance Starting Soon')
                .setDescription('Good day Students!!! Attendance will begin shortly. Please be ready to check in!')
                .setImage('https://i.imgur.com/fLYgGPq.png')
                .setThumbnail('https://i.imgur.com/EISYZLs.png')
                .setFooter({ text: 'Powered by StudentSuite', iconURL: 'https://i.pinimg.com/736x/cb/b4/76/cbb47685095fec0e83f13906f64c1edb.jpg' })
                .setTimestamp();

            await channel.send({ content: `<@&${role.id}>`, embeds: [attendanceStartEmbed] });

            await new Promise(resolve => setTimeout(resolve, 5000));

            let index = 0;
            const memberArray = membersWithRole.map(member => member);
            let isProcessing = false;
            let attendanceCompleted = false;

            const pingNextUser = async () => {
                if (index >= memberArray.length) {
                    if (!attendanceCompleted) {
                        const attendanceCompleteEmbed = new EmbedBuilder()
                            .setColor(2619932)
                            .setTitle('Attendance Done!')
                            .setDescription('Attendance is now complete!')
                            .setThumbnail('https://cdn-icons-png.flaticon.com/512/5290/5290058.png')
                            .setTimestamp();

                        await channel.send({ embeds: [attendanceCompleteEmbed] });
                        logger.info('Attendance completed for all students.');
                        attendanceCompleted = true;
                    }
                    return;
                }

                if (isProcessing) return;

                isProcessing = true;
                const member = memberArray[index];
                index++;

                if (member.user.bot) {
                    isProcessing = false;
                    pingNextUser();
                    return;
                }

                let publicMessage;
                try {
                    const attendancePromptEmbed = new EmbedBuilder()
                        .setColor(15466496)
                        .setTitle('Checking Attendance')
                        .setDescription(`# ${member}, please press the button to take your attendance. You have 10 seconds.`)
                        .setThumbnail('https://cdn-icons-png.flaticon.com/512/3338/3338489.png')
                        .setTimestamp();

                    publicMessage = await channel.send({ content: `${member}`, embeds: [attendancePromptEmbed] });
                } catch (error) {
                    logger.error(`Error sending public message: ${error.stack || error.message}`);
                    isProcessing = false;
                    pingNextUser();
                    return;
                }

                const row = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('present')
                            .setLabel('Present')
                            .setStyle(ButtonStyle.Primary),
                    );

                let buttonMessage;
                try {
                    const buttonPromptEmbed = new EmbedBuilder()
                        .setColor('#0099ff')
                        .setTitle('Mark Your Attendance')
                        .setDescription('Click the button below to mark your attendance.')
                        .setTimestamp();

                    buttonMessage = await publicMessage.reply({
                        embeds: [buttonPromptEmbed],
                        components: [row],
                    });
                } catch (error) {
                    logger.error(`Error sending button message: ${error.stack || error.message}`);
                    isProcessing = false;
                    pingNextUser();
                    return;
                }

                let timeRemaining = 10;
                const countdownInterval = setInterval(async () => {
                    timeRemaining--;
                    try {
                        if (timeRemaining > 0) {
                            const countdownEmbed = new EmbedBuilder()
                                .setColor(15466496)
                                .setTitle('Checking Attendance')
                                .setDescription(`# ${member}, please press the button to take your attendance. You have ${timeRemaining} seconds.`)
                                .setThumbnail('https://cdn-icons-png.flaticon.com/512/3338/3338489.png')
                                .setTimestamp();

                            await publicMessage.edit({ embeds: [countdownEmbed] });
                        } else {
                            clearInterval(countdownInterval);
                        }
                    } catch (error) {
                        logger.error(`Error updating countdown: ${error.stack || error.message}`);
                        clearInterval(countdownInterval);
                        isProcessing = false;
                        pingNextUser();
                    }
                }, 1000);

                const collector = channel.createMessageComponentCollector({
                    filter: i => i.customId === 'present' && i.user.id === member.id,
                    time: 10000
                });

                collector.on('collect', async i => {
                    if (i.user.id !== member.id) {
                        await i.deferUpdate();
                        return;
                    }

                    clearInterval(countdownInterval);

                    const timestamp = new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" });

                    db.run('INSERT INTO attendance (date, name, status, timestamp, server_name) VALUES (?, ?, ?, ?, ?)', [
                        attendanceStartDate,
                        member.displayName,
                        'Present',
                        timestamp,
                        guild.name,
                    ]);

                    await buttonMessage.delete();

                    const presentEmbed = new EmbedBuilder()
                        .setColor(2619932)
                        .setTitle('Attendance Marked')
                        .setDescription(`${member.displayName} is present.`)
                        .setThumbnail('https://cdn-icons-png.flaticon.com/256/8768/8768984.png')
                        .setTimestamp();

                    await publicMessage.edit({ embeds: [presentEmbed] });
                    logger.info(`${member.displayName} is present.`);

                    isProcessing = false;
                    setTimeout(pingNextUser, 2000);
                });

                collector.on('end', async collected => {
                    clearInterval(countdownInterval);

                    if (collected.size === 0) {
                        db.run('INSERT INTO attendance (date, name, status, timestamp, server_name) VALUES (?, ?, ?, ?, ?)', [
                            attendanceStartDate,
                            member.displayName,
                            'Absent',
                            'N/A',
                            guild.name,
                        ]);

                        await buttonMessage.delete();

                        const absentEmbed = new EmbedBuilder()
                            .setColor(15796746)
                            .setTitle('Attendance Marked')
                            .setDescription(`${member.displayName} is absent.`)
                            .setThumbnail('https://cdn-icons-png.flaticon.com/512/8769/8769084.png')
                            .setTimestamp();

                        await publicMessage.edit({ embeds: [absentEmbed] });
                        logger.info(`${member.displayName} is absent.`);
                    }

                    isProcessing = false;
                    setTimeout(pingNextUser, 2000);
                });
            };

            pingNextUser();
        } catch (error) {
            logger.error(`Error in attendance command: ${error.stack || error.message}`);
            await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
        }
    },
};
