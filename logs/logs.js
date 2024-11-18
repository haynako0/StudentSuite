const fs = require('fs');
const path = require('path');

const logFilePath = path.join(__dirname, 'app.log');

const logLevels = {
    INFO: 'INFO',
    ERROR: 'ERROR',
    WARN: 'WARN',
    DEBUG: 'DEBUG',
};

function log(level, message) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level}] ${message}\n`;

    console.log(logMessage);

    fs.appendFileSync(logFilePath, logMessage);
}

function info(message) {
    log(logLevels.INFO, message);
}

function error(message) {
    log(logLevels.ERROR, message);
}

function warn(message) {
    log(logLevels.WARN, message);
}

function debug(message) {
    log(logLevels.DEBUG, message);
}

module.exports = {
    info,
    error,
    warn,
    debug,
};
