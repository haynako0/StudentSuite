const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('verify')
        .setDescription('Verify yourself to gain access to the server'),
    async execute(interaction) {
        try {
            const guild = interaction.guild;
            const user = interaction.user;

            await interaction.reply({ content: `Please go to your designated channel to proceed with verification.`, ephemeral: true });

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

            await tempChannel.send(`<@${user.id}>, please provide your name.`);

            const nameMessage = await tempChannel.awaitMessages({
                filter: response => response.author.id === user.id,
                max: 1,
                time: 60000,
                errors: ['time']
            });

            const userName = nameMessage.first()?.content;

            await interaction.member.setNickname(userName);

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

            await tempChannel.send({ content: 'Please choose your subject roles:', components: rows });
 
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
                    await interaction.member.roles.add(role);
                    chosenRoles.add(roleId);
                    await i.reply({ content: `You have chosen the role: ${role.name}`, ephemeral: true });
                }
            });

            collector.on('end', async collected => {
                const initializationChannel = guild.channels.cache.find(channel => channel.name === 'initialization');
                if (initializationChannel) {
                    await initializationChannel.permissionOverwrites.edit(user.id, {
                        [PermissionFlagsBits.ViewChannel]: false,
                    });
                }

                await tempChannel.delete();
                await interaction.followUp({ content: 'Verification complete! You can now access the server.', ephemeral: true });
            });

        } catch (error) {
            console.error('Error during verification:', error);
            await interaction.followUp({ content: 'There was an error during verification. Please try again.', ephemeral: true });
        }
    },
};
