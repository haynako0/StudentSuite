const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('verify')
        .setDescription('Verify yourself and set your subjects'),
    async execute(interaction) {
        try {
            const guild = interaction.guild;
            const user = interaction.user;
            const everyoneRole = guild.roles.everyone;

            await interaction.reply({ content: 'Starting verification process...', ephemeral: true });

            const tempChannel = await guild.channels.create({
                name: `verify-${user.username}`,
                type: ChannelType.GuildText,
                permissionOverwrites: [
                    {
                        id: everyoneRole.id,
                        deny: [PermissionFlagsBits.ViewChannel],
                    },
                    {
                        id: user.id,
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
                    },
                ],
            });

            await interaction.followUp({ content: 'Please check the temporary channel created for you and follow the instructions there.', ephemeral: true });

            await tempChannel.send(`${user}, welcome to the verification process! Please follow the instructions below:`);
            await tempChannel.send('1. Type your name so we can set it as your nickname.');

            const nameMessage = await tempChannel.awaitMessages({
                filter: response => response.author.id === user.id,
                max: 1,
                time: 60000,
                errors: ['time']
            });

            const nickname = nameMessage.first()?.content;
            try {
                await interaction.member.setNickname(nickname);
                await tempChannel.send(`Your nickname has been set to "${nickname}".`);
            } catch (error) {
                console.error('Error setting nickname:', error);
                if (error.code === 50013) {
                    await tempChannel.send('I do not have the necessary permissions to change your nickname. Please contact an administrator.');
                } else {
                    throw error;
                }
            }

            const roles = guild.roles.cache.filter(role => role.name !== everyoneRole.name && role.name !== 'Admin');
            const subjects = [];

            await tempChannel.send('2. Please type the subjects you are interested in, one by one. Type "done" when finished.');

            const collector = tempChannel.createMessageCollector({
                filter: response => response.author.id === user.id,
                time: 300000,
            });

            collector.on('collect', async message => {
                if (message.content.toLowerCase() === 'done') {
                    collector.stop();
                } else {
                    const role = roles.find(r => r.name.toLowerCase() === message.content.toLowerCase());
                    if (role) {
                        subjects.push(role);
                        await interaction.member.roles.add(role);
                        await tempChannel.send(`You have been added to the "${role.name}" role.`);
                    } else {
                        await tempChannel.send(`The subject "${message.content}" does not exist. Please try again.`);
                    }
                }
            });

            collector.on('end', async collected => {
                await tempChannel.send('Verification process completed!');
                await tempChannel.delete();
                await interaction.followUp({ content: 'Your verification is complete! You can now access the channels for your subjects.', ephemeral: true });
            });

        } catch (error) {
            console.error('Error during verification:', error);
            interaction.followUp({ content: 'There was an error during verification. Please check the logs.', ephemeral: true });
        }
    },
};
