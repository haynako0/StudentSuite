const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit-table');
const logger = require('../logs/logs.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('masterlist')
        .setDescription('Generate a master list of students for a specific role')
        .addRoleOption(option =>
            option.setName('role')
                .setDescription('The role to generate the master list for')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('type')
                .setDescription('The type of master list to generate')
                .setRequired(true)
                .addChoices(
                    { name: 'records', value: 'records' },
                    { name: 'export', value: 'export' }
                )
        ),
    async execute(interaction) {
        try {
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                await interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
                return;
            }

            const role = interaction.options.getRole('role');
            const type = interaction.options.getString('type');
            const dbFolderPath = path.join(__dirname, '../databases');
            const sanitizedRoleName = role.name.replace(/[<>:"/\\|?*]/g, '_');
            const dbPath = path.join(dbFolderPath, `${sanitizedRoleName}-${role.id}.db`);

            if (!fs.existsSync(dbPath)) {
                await interaction.reply({ content: `No database found for the role: ${role.name}`, ephemeral: true });
                return;
            }

            const db = new sqlite3.Database(dbPath);

            db.all('SELECT DISTINCT name FROM attendance', async (err, rows) => {
                if (err) {
                    logger.error(`Database error: ${err.message}`);
                    interaction.reply({ content: 'An error occurred while fetching the student list.', ephemeral: true });
                    return;
                }

                if (rows.length === 0) {
                    interaction.reply({ content: `No students found for the role: ${role.name}.`, ephemeral: true });
                    return;
                }

                const studentList = rows.map((row, index) => `${index + 1}. ${row.name}`).join('\n');

                if (type === 'records') {
                    const embed = new EmbedBuilder()
                        .setColor(5798747)
                        .setDescription(`# 📋 Master List for Role:\n### Students with the role ${role.name}:\n${studentList}`)
                        .setThumbnail('https://i.imgur.com/FeekXot.png')
                        .setFooter({ text: 'Powered by StudentSuite', iconURL: 'https://i.pinimg.com/736x/cb/b4/76/cbb47685095fec0e83f13906f64c1edb.jpg' })
                        .setTimestamp();

                    await interaction.reply({ embeds: [embed] });
                } else if (type === 'export') {
                    const pdfFolderPath = path.join(__dirname, '../exports');

                    if (!fs.existsSync(pdfFolderPath)) {
                        fs.mkdirSync(pdfFolderPath, { recursive: true });
                    }

                    const uniqueTime = new Date().toISOString().replace(/[-:.TZ]/g, '');
                    const pdfPath = path.join(pdfFolderPath, `${sanitizedRoleName}_${interaction.guild.name.replace(/ /g, '_')}_masterlist_${uniqueTime}.pdf`);
                    const pdfDoc = new PDFDocument({ margin: 50 });

                    const writeStream = fs.createWriteStream(pdfPath);
                    pdfDoc.pipe(writeStream);

                    const serverName = interaction.guild.name;
                    const professors = interaction.guild.members.cache
                        .filter(member => member.permissions.has('Administrator') && !member.user.bot)
                        .map(member => member.user.tag)
                        .join(', ') || 'None';

                    pdfDoc
                        .fontSize(24)
                        .fillColor('#2e86c1')
                        .text(`Master List`, { align: 'center' })
                        .fontSize(16)
                        .fillColor('black')
                        .text(`Role: ${role.name}`, { align: 'center' })
                        .text(`Server: ${serverName}`, { align: 'center' })
                        .text(`Professors: ${professors}`, { align: 'center' })
                        .moveDown(1);

                    const table = {
                        headers: ['Name'],
                        rows: rows.map(row => [row.name]),
                    };

                    pdfDoc.table(table, {
                        prepareHeader: () => pdfDoc.fontSize(12).fillColor('#2c3e50'),
                        prepareRow: (row, indexColumn) => pdfDoc.fontSize(10).fillColor(indexColumn % 2 === 0 ? 'black' : '#555555'),
                        columnSpacing: 10,
                        padding: 5,
                    });

                    pdfDoc.end();

                    writeStream.on('finish', async () => {
                        const exportEmbed = new EmbedBuilder()
                            .setColor(5798747)
                            .setDescription(`# ✅ Master List Export Successful for Role:\nThe master list for the role ${role.name} has been exported.`)
                            .setThumbnail('https://i.imgur.com/FeekXot.png')
                            .setFooter({ text: 'Powered by StudentSuite', iconURL: 'https://i.pinimg.com/736x/cb/b4/76/cbb47685095fec0e83f13906f64c1edb.jpg' })
                            .setTimestamp();

                        await interaction.reply({ embeds: [exportEmbed], files: [{ attachment: pdfPath, name: path.basename(pdfPath) }] });
                    });

                    writeStream.on('error', (err) => {
                        logger.error(`Error writing PDF: ${err.message}`);
                        interaction.reply({ content: 'An error occurred while exporting the master list.', ephemeral: true });
                    });
                }
            });

        } catch (error) {
            logger.error(`Error in masterlist command: ${error.stack || error.message}`);
            await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
        }
    },
};
