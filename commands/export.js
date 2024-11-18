const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const logger = require('../logs/logs.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('export')
        .setDescription('Export attendance records for a specific date to a PDF')
        .addStringOption(option =>
            option.setName('date')
                .setDescription('Date to export (e.g., November 17, 2024)')
                .setRequired(true)
        )
        .addRoleOption(option =>
            option.setName('role')
                .setDescription('The subject/role to export attendance for')
                .setRequired(true)
        ),
    async execute(interaction) {
        try {
            const date = interaction.options.getString('date');
            const role = interaction.options.getRole('role');
            const dbFolderPath = path.join(__dirname, '../databases');
            const sanitizedRoleName = role.name.replace(/[<>:"/\\|?*]/g, '_');
            const dbPath = path.join(dbFolderPath, `${sanitizedRoleName}.db`);

            if (!fs.existsSync(dbPath)) {
                await interaction.reply({ content: `No database found for the role: ${role.name}`, ephemeral: true });
                return;
            }

            const db = new sqlite3.Database(dbPath);

            const pdfPath = path.join(__dirname, `../exports/${sanitizedRoleName}_${date.replace(/ /g, '_')}.pdf`);
            const pdfDoc = new PDFDocument();
            const pdfFolderPath = path.join(__dirname, '../exports');

            if (!fs.existsSync(pdfFolderPath)) {
                fs.mkdirSync(pdfFolderPath);
            }

            pdfDoc.pipe(fs.createWriteStream(pdfPath));

            pdfDoc.fontSize(20).text(`Attendance Records for ${date}`, { align: 'center' });
            pdfDoc.moveDown(1);
            pdfDoc.fontSize(14).text(`Subject: ${role.name}`, { align: 'center' });
            pdfDoc.moveDown(1);

            db.all('SELECT nickname, status, timestamp, server_name FROM attendance WHERE date = ?', [date], (err, rows) => {
                if (err) {
                    logger.error(`Database error: ${err.message}`);
                    interaction.reply({ content: 'An error occurred while exporting the data.', ephemeral: true });
                    return;
                }

                if (rows.length === 0) {
                    interaction.reply({ content: `No attendance records found for ${date}.`, ephemeral: true });
                    return;
                }

                pdfDoc.moveDown(0.5);
                pdfDoc.fontSize(12).text('Nickname', { continued: true });
                pdfDoc.text('Status', { align: 'center', continued: true });
                pdfDoc.text('Timestamp', { align: 'right' });
                pdfDoc.moveDown(0.5);
                pdfDoc.text('---------------------------------------------------------------------------------------------------------------------');

                rows.forEach((row) => {
                    pdfDoc.text(row.nickname, { continued: true });
                    pdfDoc.text(row.status, { align: 'center', continued: true });
                    pdfDoc.text(row.timestamp, { align: 'right' });
                });

                pdfDoc.end();

                const exportEmbed = new EmbedBuilder()
                    .setColor('#0099ff')
                    .setTitle(`Export Successful for Role: ${role.name}`)
                    .setDescription(`Attendance records for ${role.name} on ${date} have been exported.`)
                    .setTimestamp();

                interaction.reply({ embeds: [exportEmbed], files: [{ attachment: pdfPath, name: path.basename(pdfPath) }] });
            });

        } catch (error) {
            logger.error(`Error in export command: ${error.stack || error.message}`);
            await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
        }
    },
};
