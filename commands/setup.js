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
                return interaction.reply({ content: 'You need Administrator permissions to run this command!', ephemeral: true });
            }

            const embed = new EmbedBuilder()
                .setTitle('Server Setup')
                .setDescription('Starting server setup...')
                .setColor('#0099ff');

            await interaction.reply({ embeds: [embed], ephemeral: true });

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

            const adminRoleEmbed = new EmbedBuilder()
                .setTitle('Admin Role Name')
                .setDescription('Please provide a name for the admin role or type "default" for the default admin role name: "Admin".')
                .setColor('#0099ff');

            await interaction.followUp({ embeds: [adminRoleEmbed], ephemeral: true });

            const adminMessage = await interaction.channel.awaitMessages({
                filter: response => response.author.id === user.id,
                max: 1,
                time: 60000,
                errors: ['time']
            });

            const adminName = adminMessage.first()?.content || 'Admin';

            const generateRandomColor = () => {
                const color = Math.floor(Math.random() * 16777215).toString(16);
                return `#${color.padStart(6, '0')}`;
            };

            const subjectsEmbed = new EmbedBuilder()
                .setTitle('Subjects List')
                .setDescription('Please provide a comma-separated list of subjects to create roles and channels (e.g., "Math, Science, English").')
                .setColor('#0099ff');

            await interaction.followUp({ embeds: [subjectsEmbed], ephemeral: true });

            const subjectsMessage = await interaction.channel.awaitMessages({
                filter: response => response.author.id === user.id,
                max: 1,
                time: 60000,
                errors: ['time']
            });

            const subjects = subjectsMessage.first()?.content.split(',').map(subject => subject.trim());

            if (!subjects || subjects.length === 0) {
                return interaction.followUp({ content: 'No subjects provided. Aborting setup.', ephemeral: true });
            }

            const confirmationEmbed = new EmbedBuilder()
                .setTitle('Confirmation')
                .setDescription(`Please confirm your details:\n**Admin Role Name:** ${adminName}\n**Subjects:** ${subjects.join(', ')}`)
                .setColor('#0099ff');

            const confirmRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('confirm')
                    .setLabel('Confirm')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('startover')
                    .setLabel('Start Over')
                    .setStyle(ButtonStyle.Danger)
            );

            await interaction.followUp({ embeds: [confirmationEmbed], components: [confirmRow], ephemeral: true });

            const confirmCollector = interaction.channel.createMessageComponentCollector({ filter: i => i.user.id === user.id, time: 60000 });

            confirmCollector.on('collect', async i => {
                if (i.customId === 'confirm') {
                    const adminRole = await guild.roles.create({
                        name: adminName.toLowerCase() === 'default' ? 'Admin' : adminName,
                        color: generateRandomColor(),
                        permissions: [PermissionFlagsBits.Administrator],
                        reason: 'Role created for command access',
                        displaySeparately: true
                    });

                    await interaction.member.roles.add(adminRole);
                    await interaction.followUp({ content: `The role "${adminRole.name}" has been created and assigned to you.`, ephemeral: true });

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

                    await initializationChannel.send('Hello! Welcome to ' + guild.name + '! To get started, verify yourself by using the /verify command.');
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
                        const allRoles = guild.roles.cache;

                        allChannels.forEach(async channel => {
                            if (channel.type === ChannelType.GuildCategory && !createdCategories.includes(channel.id)) {
                                try {
                                    await channel.delete();
                                } catch (error) {
                                    console.error(`Failed to delete category: ${channel.name}`, error);
                                }
                            } else if (channel.type !== ChannelType.GuildCategory && !createdChannels.includes(channel.id)) {
                                try {
                                    if (channel.deletable) {
                                        await channel.delete();
                                    }
                                } catch (error) {
                                    console.error(`Failed to delete channel: ${channel.name}`, error);
                                }
                            }
                        });

                        allRoles.forEach(async role => {
                            if (!createdRoles.includes(role.id) && role.id !== everyoneRole.id) {
                                try {
                                    await role.delete();
                                } catch (error) {
                                    console.error(`Failed to delete role: ${role.name}`, error);
                                }
                            }
                        });

                        try {
                            if (commandChannel.deletable) {
                                await commandChannel.delete();
                            }
                        } catch (error) {
                            console.error(`Failed to delete command ran channel: ${commandChannel.name}`, error);
                        }
                    }, 2000);

                    await interaction.followUp({ content: 'Server setup is complete!', ephemeral: true });
                } else if (i.customId === 'startover') {
                    await interaction.followUp({ content: 'Server setup process restarted. Please run the command again.', ephemeral: true });
                }
            });

            confirmCollector.on('end', async () => {
                await interaction.followUp({ content: 'Server setup process timed out. Please run the command again.', ephemeral: true });
            });

        } catch (error) {
            console.error('Error during setup:', error);
            interaction.followUp({ content: 'There was an error during setup. Please check the logs.', ephemeral: true });
        }
    },
};
