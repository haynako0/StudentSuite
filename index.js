const { Client, GatewayIntentBits, Partials } = require('discord.js');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { token, clientId } = require('./config.json');
const logger = require('./logs/logs.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers, 
    ],
    partials: [Partials.Channel],
});

const commands = [];
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const command = require(`./commands/${file}`);
    commands.push(command.data.toJSON());
}

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
    try {
        logger.info('Started refreshing application (/) commands.');

        await rest.put(
            Routes.applicationCommands(clientId),
            { body: commands },
        );

        logger.info('Successfully reloaded application (/) commands.');
    } catch (error) {
        logger.error(`Error refreshing application commands: ${error.stack || error.message}`);
    }
})();

client.once('ready', () => {
    logger.info('Ready!');
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;

    const command = client.commands.get(interaction.commandName);

    if (!command) return;

    try {
        logger.info(`Executing command: ${interaction.commandName}`);
        await command.execute(interaction);
    } catch (error) {
        logger.error(`Error executing command: ${interaction.commandName}: ${error.stack || error.message}`);
        await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
    }
});

client.commands = new Map();
commandFiles.forEach(file => {
    const command = require(`./commands/${file}`);
    client.commands.set(command.data.name, command);
});

client.login(token);
