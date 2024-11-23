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
                .setTitle('Verification Process')
                .setDescription('Please go to your designated channel to proceed with verification.')
                .setColor('#0099ff');

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
                .setTitle('Verification Step 1')
                .setDescription(`<@${user.id}>, please provide your name.`)
                .setColor('#0099ff');

            await tempChannel.send({ embeds: [nameEmbed] });

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
                .setTitle('Verification Step 2')
                .setDescription('Please choose your subject roles:')
                .setColor('#0099ff');

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
                    await i.reply({ content: `You have chosen the role: ${role.name}`, ephemeral: true });
                }
            });

            collector.on('end', async collected => {
                const chosenRoleNames = Array.from(chosenRoles).map(roleId => guild.roles.cache.get(roleId).name).join(', ');

                const confirmationEmbed = new EmbedBuilder()
                    .setTitle('Confirmation')
                    .setDescription(`Please confirm your details:\n**Name:** ${userName}\n**Subjects:** ${chosenRoleNames}`)
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
                    await tempChannel.delete();
                    await interaction.followUp({ content: 'Verification process timed out. Please run the command again.', ephemeral: true });
                });
            });

        } catch (error) {
            console.error('Error during verification:', error);
            await interaction.followUp({ content: 'There was an error during verification. Please try again.', ephemeral: true });
        }
    },
};
