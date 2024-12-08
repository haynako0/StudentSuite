const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup')
        .setDescription('Initial setup for the server when the bot is added'),
    async execute(interaction) {
        try {
            const guild = interaction.guild;
            const user = interaction.user;

            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                const permissionMessage = await interaction.reply({ content: 'You need Administrator permissions to run this command!', fetchReply: true });
                setTimeout(() => {
                    permissionMessage.delete().catch(error => console.error('Error deleting message:', error));
                }, 5000);
                return;
            }

            const warningEmbed = new EmbedBuilder()
                .setImage('https://cdn.discordapp.com/attachments/1307939013344235530/1311869609338732585/server_setup.png?ex=67564ac8&is=6754f948&hm=3e59a31351244f64a0029c869e33645ecf594661ae03b6aa49e719bbbdeaf1a9&')
                .setColor('#ff0000');

            const confirmRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('confirm')
                    .setLabel('Confirm')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('cancel')
                    .setLabel('Cancel')
                    .setStyle(ButtonStyle.Danger)
            );

            const warningMessage = await interaction.reply({ embeds: [warningEmbed], components: [confirmRow], fetchReply: true });

            const confirmCollector = interaction.channel.createMessageComponentCollector({ filter: i => i.user.id === user.id, time: 60000 });

            confirmCollector.on('collect', async i => {
                if (warningMessage && warningMessage.deletable) {
                    await warningMessage.delete().catch(error => console.error('Error deleting message:', error));
                }

                if (i.customId === 'confirm') {
                    const embed = new EmbedBuilder()
                        .setTitle('Server Setup')
                        .setDescription('Starting server setup, please wait a moment...')
                        .setColor('#dedc15')
                        .setThumbnail('https://cdn-icons-png.flaticon.com/512/4990/4990502.png');

                    const setupMessage = await interaction.followUp({ embeds: [embed], fetchReply: true });

                    const everyoneRole = guild.roles.everyone;
                    await everyoneRole.setPermissions(0n);

                    const allChannels = guild.channels.cache;
                    allChannels.forEach(async channel => {
                        await channel.permissionOverwrites.edit(everyoneRole, {
                            [PermissionFlagsBits.ViewChannel]: false,
                            [PermissionFlagsBits.SendMessages]: false,
                            [PermissionFlagsBits.ReadMessageHistory]: false,
                        });
                    });

                    const allRoles = guild.roles.cache;
                    const botRoleId = guild.members.me.roles.highest.id;

                    console.log('Deleting old roles...');
                    allRoles.forEach(async role => {
                        if (role.id !== everyoneRole.id && role.id !== botRoleId) {
                            try {
                                await role.delete();
                                console.log(`Deleted role: ${role.name}`);
                            } catch (error) {
                                console.error(`Failed to delete role: ${role.name}`, error);
                            }
                        }
                    });

                    const adminRoleEmbed = new EmbedBuilder()
                        .setTitle('Admin Setup')
                        .setDescription('Please provide a name for the admin role or type "default" for the default admin role name: "Admin".')
                        .setColor('#dedc15')
                        .setThumbnail('https://cdn-icons-png.flaticon.com/128/17434790.png');

                    const adminMessage = await interaction.followUp({ embeds: [adminRoleEmbed], fetchReply: true });

                    const adminMessageCollector = interaction.channel.awaitMessages({
                        filter: response => response.author.id === user.id,
                        max: 1,
                        time: 60000,
                        errors: ['time']
                    });

                    adminMessageCollector.then(async collected => {
                        const adminName = collected.first()?.content || 'Admin';
                        if (adminMessage && adminMessage.deletable) {
                            await adminMessage.delete().catch(error => console.error('Error deleting message:', error));
                        }

                        const generateRandomColor = () => {
                            const color = Math.floor(Math.random() * 16777215).toString(16);
                            return `#${color.padStart(6, '0')}`;
                        };

                        const subjectsEmbed = new EmbedBuilder()
                            .setTitle('Subject List Setup')
                            .setDescription('Please provide a comma-separated list of subjects to create roles and channels (e.g., "Math, English, Science").')
                            .setColor('#dedc15')
                            .setThumbnail('https://cdn-icons-png.flaticon.com/512/5832/5832416.png');

                        const subjectsMessage = await interaction.followUp({ embeds: [subjectsEmbed], fetchReply: true });

                        const subjectsMessageCollector = interaction.channel.awaitMessages({
                            filter: response => response.author.id === user.id,
                            max: 1,
                            time: 60000,
                            errors: ['time']
                        });

                        subjectsMessageCollector.then(async collected => {
                            const subjects = collected.first()?.content.split(',').map(subject => subject.trim());
                            if (subjectsMessage && subjectsMessage.deletable) {
                                await subjectsMessage.delete().catch(error => console.error('Error deleting message:', error));
                            }

                            if (!subjects || subjects.length === 0) {
                                const noSubjectsMessage = await interaction.followUp({ content: 'No subjects provided. Aborting setup.', fetchReply: true });
                                setTimeout(() => {
                                    noSubjectsMessage.delete().catch(error => console.error('Error deleting message:', error));
                                }, 5000);
                                return;
                            }

                            const confirmationEmbed = new EmbedBuilder()
                                .setTitle('Confirmation')
                                .setDescription(`Please confirm your details:\n**Admin Role Name:** ${adminName}\n**Subjects:** ${subjects.join(', ')}`)
                                .setColor('#1cff00')
                                .setThumbnail('https://www.iconpacks.net/icons/2/free-check-icon-3278-thumb.png');

                            const confirmRow2 = new ActionRowBuilder().addComponents(
                                new ButtonBuilder()
                                    .setCustomId('confirm2')
                                    .setLabel('Confirm')
                                    .setStyle(ButtonStyle.Success),
                                new ButtonBuilder()
                                    .setCustomId('startover')
                                    .setLabel('Start Over')
                                    .setStyle(ButtonStyle.Danger)
                            );

                            const confirmationMessage = await interaction.followUp({ embeds: [confirmationEmbed], components: [confirmRow2], fetchReply: true });

                            const confirmCollector2 = interaction.channel.createMessageComponentCollector({ filter: i => i.user.id === user.id, time: 60000 });

                            confirmCollector2.on('collect', async i => {
                                if (confirmationMessage && confirmationMessage.deletable) {
                                    await confirmationMessage.delete().catch(error => console.error('Error deleting message:', error));
                                }

                                if (i.customId === 'confirm2') {
                                    const adminRole = await guild.roles.create({
                                        name: adminName.toLowerCase() === 'default' ? 'Admin' : adminName,
                                        color: generateRandomColor(),
                                        permissions: [PermissionFlagsBits.Administrator],
                                        reason: 'Role created for command access',
                                        displaySeparately: true
                                    });

                                    await interaction.member.roles.add(adminRole);
                                    const roleCreatedMessage = await interaction.followUp({ content: `The role "${adminRole.name}" has been created and assigned to you.`, fetchReply: true });
                                    setTimeout(() => {
                                        roleCreatedMessage.delete().catch(error => console.error('Error deleting message:', error));
                                    }, 5000);

                                    const subjectCategory = await guild.channels.create({
                                        name: 'Subject Channels',
                                        type: ChannelType.GuildCategory,
                                        position: 1,
                                    });

                                    const controlPanelCategory = await guild.channels.create({
                                        name: 'Control Panel',
                                        type: ChannelType.GuildCategory,
                                        position: 2,
                                    });

                                    const createdChannels = [];
                                    const createdCategories = [subjectCategory.id, controlPanelCategory.id];
                                    const createdRoles = [adminRole.id];

                                    for (const subject of subjects) {
                                        const subjectRole = await guild.roles.create({
                                            name: subject,
                                            color: generateRandomColor(),
                                            reason: `Role for subject ${subject}`,
                                        });

                                        createdRoles.push(subjectRole.id);

                                        const subjectChannel = await guild.channels.create({
                                            name: subject.toLowerCase().replace(/\s+/g, '-'),
                                            type: ChannelType.GuildText,
                                            reason: `Channel for subject ${subject}`,
                                            parent: subjectCategory.id,
                                            permissionOverwrites: [
                                                {
                                                    id: everyoneRole.id,
                                                    deny: [PermissionFlagsBits.ViewChannel],
                                                },
                                                {
                                                    id: subjectRole.id,
                                                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
                                                },
                                                {
                                                    id: adminRole.id,
                                                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels],
                                                },
                                            ],
                                        });

                                        createdChannels.push(subjectChannel.id);
                                    }

                                    const initializationChannel = await guild.channels.create({
                                        name: 'initialization',
                                        type: ChannelType.GuildText,
                                        reason: 'Channel for initialization',
                                        permissionOverwrites: [
                                            {
                                                id: everyoneRole.id,
                                                allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.UseApplicationCommands],
                                            },
                                        ],
                                    });

                                    const initializationEmbed = new EmbedBuilder()
                                        .setDescription("# 🎉 Welcome to the Server!!!\n*Hello! We're glad to have you here. To get started, please verify yourself by using the `/verify` command.*\n### Once verified, you'll gain access to all available channels. Enjoy your stay!")
                                        .setTimestamp(new Date('2024-11-28T16:00:00+00:00'))
                                        .setColor(5798747)
                                        .setFooter({
                                            text: "Powered by StudentSuite",
                                            iconURL: "https://i.pinimg.com/736x/cb/b4/76/cbb47685095fec0e83f13906f64c1edb.jpg"
                                        })
                                        .setThumbnail('https://i.imgur.com/FeekXot.png');

                                    await initializationChannel.send({
                                        embeds: [initializationEmbed],
                                        username: "initialization-process design #3",
                                        avatarURL: "https://cdn.discordapp.com/embed/avatars/0.png"
                                    });

                                    await initializationChannel.setPosition(0);

                                    const exportsChannel = await guild.channels.create({
                                        name: 'exports',
                                        type: ChannelType.GuildText,
                                        reason: 'Channel for exporting attendance records',
                                        parent: controlPanelCategory.id,
                                        permissionOverwrites: [
                                            {
                                                id: everyoneRole.id,
                                                deny: [PermissionFlagsBits.ViewChannel],
                                            },
                                            {
                                                id: adminRole.id,
                                                allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
                                            },
                                        ],
                                    });

                                    const recordsChannel = await guild.channels.create({
                                        name: 'records',
                                        type: ChannelType.GuildText,
                                        reason: 'Channel for viewing attendance records',
                                        parent: controlPanelCategory.id,
                                        permissionOverwrites: [
                                            {
                                                id: everyoneRole.id,
                                                deny: [PermissionFlagsBits.ViewChannel],
                                            },
                                            {
                                                id: adminRole.id,
                                                allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
                                            },
                                        ],
                                    });

                                    createdChannels.push(initializationChannel.id, exportsChannel.id, recordsChannel.id);

                                    setTimeout(async () => {
                                        const commandChannel = interaction.channel;
                                        const allChannels = guild.channels.cache;

                                        console.log('Deleting old channels...');
                                        allChannels.forEach(async channel => {
                                            if (channel.type === ChannelType.GuildCategory && !createdCategories.includes(channel.id)) {
                                                try {
                                                    await channel.delete();
                                                    console.log(`Deleted category: ${channel.name}`);
                                                } catch (error) {
                                                    console.error(`Failed to delete category: ${channel.name}`, error);
                                                }
                                            } else if (channel.type !== ChannelType.GuildCategory && !createdChannels.includes(channel.id)) {
                                                try {
                                                    if (channel.deletable) {
                                                        await channel.delete();
                                                        console.log(`Deleted channel: ${channel.name}`);
                                                    }
                                                } catch (error) {
                                                    console.error(`Failed to delete channel: ${channel.name}`, error);
                                                }
                                            }
                                        });

                                        try {
                                            if (commandChannel.deletable) {
                                                await commandChannel.delete();
                                                console.log(`Deleted command ran channel: ${commandChannel.name}`);
                                            }
                                        } catch (error) {
                                            console.error(`Failed to delete command ran channel: ${commandChannel.name}`, error);
                                        }
                                    }, 2000);

                                    const setupCompleteMessage = await interaction.followUp({ content: 'Server setup is complete!', fetchReply: true });
                                    setTimeout(() => {
                                        setupCompleteMessage.delete().catch(error => console.error('Error deleting message:', error));
                                    }, 5000);
                                } else if (i.customId === 'startover') {
                                    const startOverMessage = await interaction.followUp({ content: 'Server setup process restarted. Please run the command again.', fetchReply: true });
                                    setTimeout(() => {
                                        startOverMessage.delete().catch(error => console.error('Error deleting message:', error));
                                    }, 5000);
                                }
                            });

                            confirmCollector2.on('end', async () => {
                                const timeoutMessage = await interaction.followUp({ content: 'Server setup process timed out. Please run the command again.', fetchReply: true });
                                setTimeout(() => {
                                    timeoutMessage.delete().catch(error => console.error('Error deleting message:', error));
                                }, 5000);
                            });
                        });
                    });
                } else if (i.customId === 'cancel') {
                    const cancelMessage = await interaction.followUp({ content: 'Server setup process cancelled.', fetchReply: true });
                    setTimeout(() => {
                        cancelMessage.delete().catch(error => console.error('Error deleting message:', error));
                    }, 5000);
                }
            });

            confirmCollector.on('end', async () => {
                const timeoutMessage = await interaction.followUp({ content: 'Server setup process timed out. Please run the command again.', fetchReply: true });
                setTimeout(() => {
                    timeoutMessage.delete().catch(error => console.error('Error deleting message:', error));
                }, 5000);
            });

        } catch (error) {
            console.error('Error during setup:', error);
            const errorMessage = await interaction.followUp({ content: 'There was an error during setup. Please check the logs.', fetchReply: true });
            setTimeout(() => {
                errorMessage.delete().catch(error => console.error('Error deleting message:', error));
            }, 5000);
        }
    },
};
