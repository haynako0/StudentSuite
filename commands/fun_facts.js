const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const axios = require('axios');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('fun-facts-with-nixonic')
        .setDescription('Get a random fun fact with Nixonic the Coronadoan Hedgehog!'),
    async execute(interaction) {
        try {
            const response = await axios.get('https://uselessfacts.jsph.pl/api/v2/facts/random');
            const fact = response.data;

            const imageUrls = [
                'https://cdn.discordapp.com/attachments/1310440641657831495/1310441058953330839/aifaceswap-3869a20a317023d3a81ffef2d1f98ad5.jpg?ex=67453ad7&is=6743e957&hm=588b2bb042a352a5e3c74f6d1e27bc5d771752df3b385048907143d0645077bc&',
                'https://cdn.discordapp.com/attachments/1310440641657831495/1310441430497361930/aifaceswap-a3e8faf6df2b7243fa78e814e61e62fb.jpg?ex=67453b2f&is=6743e9af&hm=9dc983b02a465e4d501cc942e296748c6df6e3896baa481cfa25c52f7ae2ff22&'
            ];

            const randomImageUrl = imageUrls[Math.floor(Math.random() * imageUrls.length)];

            const embed = new EmbedBuilder()
                .setTitle('**Fun Facts with Nixonic the Coronadoan Hedgehog!**')
                .setDescription(fact.text)
                .setTimestamp()
                .setColor(2969343)
                .setFooter({
                    text: 'Tune in with Nixonic the Coronadoan Hedgehog for more fun facts!',
                    iconURL: 'https://assetsio.gnwcdn.com/eurogamer-e05hlt.jpg?width=1200&height=1200&fit=bounds&quality=70&format=jpg&auto=webp'
                })
                .setAuthor({
                    name: 'Nixonic the Coronadoan Hedgehog',
                    iconURL: 'https://assetsio.gnwcdn.com/eurogamer-e05hlt.jpg?width=1200&height=1200&fit=bounds&quality=70&format=jpg&auto=webp'
                })
                .setImage(randomImageUrl)
                .setThumbnail('https://platform.polygon.com/wp-content/uploads/sites/2/chorus/uploads/chorus_asset/file/6831573/sonic_artwork.0.jpg?quality=90&strip=all&crop=0,16.666666666667,100,66.666666666667');

            await interaction.reply({ content: 'The more you know!', embeds: [embed] });
        } catch (error) {
            console.error('Error fetching fun fact:', error);
            await interaction.reply({ content: 'There was an error fetching the fun fact. Please try again later.', ephemeral: true });
        }
    },
};
