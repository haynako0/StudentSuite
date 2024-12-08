const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('verify')
        .setDescription('Verify yourself to gain access to the server'),
    async execute(interaction) {
        try {
            const guild = interaction.guild;
            const user = interaction.user;

            const embed = new EmbedBuilder()
                .setDescription("# Verification Process\n### *Step 1:*\n\n*Please navigate to your designated channel, which will appear on the left side of your screen, to complete the verification process.*\n\n***Feel free to contact the administrator for assistance if you encounter any issues.***")
                .setTimestamp(new Date('2024-11-28T16:00:00+00:00'))
                .setColor(11944518)
                .setFooter({
                    text: "Powered by StudentSuite",
                    iconURL: "https://i.pinimg.com/736x/cb/b4/76/cbb47685095fec0e83f13906f64c1edb.jpg"
                })
                .setThumbnail('https://i.imgur.com/FeekXot.png');

            await interaction.reply({ embeds: [embed], ephemeral: true });

            const tempChannel = await guild.channels.create({
                name: user.username.toLowerCase(),
                type: ChannelType.GuildText,
                permissionOverwrites: [
                    {
                        id: guild.roles.everyone,
                        deny: [PermissionFlagsBits.ViewChannel],
                    },
                    {
                        id: user.id,
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
                    },
                ],
            });

            const nameEmbed = new EmbedBuilder()
                .setDescription("# Verification Process\n### *Step 1:*\n\n*Please provide your name.*")
                .setTimestamp(new Date('2024-11-28T16:00:00+00:00'))
                .setColor(11944518)
                .setFooter({
                    text: "Powered by StudentSuite",
                    iconURL: "https://i.pinimg.com/736x/cb/b4/76/cbb47685095fec0e83f13906f64c1edb.jpg"
                })
                .setThumbnail('https://i.imgur.com/FeekXot.png');

            await tempChannel.send({ content: `<@${user.id}>`, embeds: [nameEmbed] });

            const nameMessage = await tempChannel.awaitMessages({
                filter: response => response.author.id === user.id,
                max: 1,
                time: 60000,
                errors: ['time']
            });

            const userName = nameMessage.first()?.content;

            const allRoles = guild.roles.cache.filter(role => role.name !== '@everyone' && !role.managed && !role.permissions.has(PermissionFlagsBits.Administrator));

            const rows = [];
            let currentRow = new ActionRowBuilder();
            allRoles.forEach(role => {
                if (currentRow.components.length >= 5) {
                    rows.push(currentRow);
                    currentRow = new ActionRowBuilder();
                }
                currentRow.addComponents(
                    new ButtonBuilder()
                        .setCustomId(role.id)
                        .setLabel(role.name)
                        .setStyle(ButtonStyle.Primary)
                );
            });
            if (currentRow.components.length > 0) {
                rows.push(currentRow);
            }

            const completeRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('complete')
                    .setLabel('Press this button to complete verification')
                    .setStyle(ButtonStyle.Success)
            );
            rows.push(completeRow);

            const roleEmbed = new EmbedBuilder()
                .setDescription("# Verification Process\n### *Step 2:*\n\n*Please choose your subject roles from the options below by clicking the corresponding buttons:*")
                .setTimestamp(new Date('2024-11-28T16:00:00+00:00'))
                .setColor(11944518)
                .setFooter({
                    text: "Powered by StudentSuite",
                    iconURL: "https://i.pinimg.com/736x/cb/b4/76/cbb47685095fec0e83f13906f64c1edb.jpg"
                })
                .setThumbnail('https://i.imgur.com/FeekXot.png');

            await tempChannel.send({ embeds: [roleEmbed], components: rows });

            const filter = i => i.user.id === user.id;
            const collector = tempChannel.createMessageComponentCollector({ filter, time: 60000 });

            const chosenRoles = new Set();
            collector.on('collect', async i => {
                if (i.customId === 'complete') {
                    collector.stop();
                    return;
                }

                const roleId = i.customId;
                const role = guild.roles.cache.get(roleId);
                if (!chosenRoles.has(roleId)) {
                    chosenRoles.add(roleId);
                    const roleChosenEmbed = new EmbedBuilder()
                        .setDescription(`# **You have chosen the role: ${role.name}**`)
                        .setTimestamp(new Date('2024-11-28T16:00:00+00:00'))
                        .setColor(5798747)
                        .setFooter({
                            text: "Powered by StudentSuite",
                            iconURL: "https://i.pinimg.com/736x/cb/b4/76/cbb47685095fec0e83f13906f64c1edb.jpg"
                        });

                    await i.reply({ embeds: [roleChosenEmbed], ephemeral: true });
                }
            });

            collector.on('end', async collected => {
                const chosenRoleNames = Array.from(chosenRoles).map(roleId => guild.roles.cache.get(roleId).name).join(', ');

                const confirmationEmbed = new EmbedBuilder()
                    .setDescription(`# 📋 Subjects List Confirmation\n# *Please confirm your details before proceeding:*\n\n**Name:** ${userName}\n**Subjects:** ${chosenRoleNames}\n\n*If everything looks correct, click \`Confirm\` to proceed or \`Start Over\` to make changes.*`)
                    .setTimestamp(new Date('2024-11-28T16:00:00+00:00'))
                    .setColor(5798747)
                    .setFooter({
                        text: "Powered by StudentSuite",
                        iconURL: "https://i.pinimg.com/736x/cb/b4/76/cbb47685095fec0e83f13906f64c1edb.jpg"
                    })
                    .setImage('https://i.imgur.com/AZRevLY.png')
                    .setThumbnail('https://i.imgur.com/FeekXot.png');

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

                await tempChannel.send({ embeds: [confirmationEmbed], components: [confirmRow] });

                const confirmCollector = tempChannel.createMessageComponentCollector({ filter, time: 60000 });

                confirmCollector.on('collect', async i => {
                    if (i.customId === 'confirm') {
                        await interaction.member.setNickname(userName);
                        for (const roleId of chosenRoles) {
                            const role = guild.roles.cache.get(roleId);
                            await interaction.member.roles.add(role);
                        }
                        const initializationChannel = guild.channels.cache.find(channel => channel.name === 'initialization');
                        if (initializationChannel) {
                            await initializationChannel.permissionOverwrites.edit(user.id, {
                                [PermissionFlagsBits.ViewChannel]: false,
                            });
                        }
                        await tempChannel.delete();
                        await interaction.followUp({ content: 'Verification complete! You can now access the server.', ephemeral: true });
                    } else if (i.customId === 'startover') {
                        await tempChannel.delete();
                        await interaction.followUp({ content: 'Verification process restarted. Please run the command again.', ephemeral: true });
                    }
                });

                confirmCollector.on('end', async () => {
                    const timeoutEmbed = new EmbedBuilder()
                        .setDescription("# ⏳ Process Timed Out")
                        .setTimestamp(new Date('2024-11-28T16:00:00+00:00'))
                        .setColor(11944518)
                        .setFooter({
                            text: "Powered by StudentSuite",
                            iconURL: "https://i.pinimg.com/736x/cb/b4/76/cbb47685095fec0e83f13906f64c1edb.jpg"
                        })
                        .setImage('https://i.imgur.com/rgnL7RO.png');

                    await interaction.followUp({ embeds: [timeoutEmbed], ephemeral: true });
                    await tempChannel.delete();
                });
            });

        } catch (error) {
            console.error('Error during verification:', error);
            await interaction.followUp({ content: 'There was an error during verification. Please try again.', ephemeral: true });
        }
    },
};
