const appInsights = require('applicationinsights');

function initAppInsights() {
    if (!!process.env.APPLICATIONINSIGHTS_CONNECTION_STRING) {
        appInsights
            .setup()
            .setAutoCollectConsole(true, true) // Generate Trace telemetry for winston/bunyan and console logs
            .start();
        console.log('App insights enabled');
    } else {
        console.log('Missing APPLICATIONINSIGHTS_CONNECTION_STRING. Starting without App insights');
    }
}

/**
 *  The ID is generated using the current milliseconds and a random string.
 * @returns {string} - A unique request ID.
 */
function generateRequestId() {
    const milliseconds = new Date().getMilliseconds(); 
    return `${milliseconds}-${Math.random().toString(36).slice(2, 9)}`;
}

function startTimer(target) {
    console.time(target);
}

function endTimer(target) {
    console.timeEnd(target);
}

/**
 * Tracks and logs a trace message with the elapsed time and request ID.
 * 
 * @param {string} msg - The message to log.
 * @param {Array} start - The high-resolution time marker from `process.hrtime()`.
 * @param {string} requestId - The unique identifier for the request (optional).
 */
function trackTrace(msg, start, requestId) {
    const elapsed = clock(start);
    const timeDisplay = elapsed > 1000 ? `${(elapsed / 1000).toFixed(3)}s` : `${elapsed}ms`;
    console.log(`[@${requestId ?? ''}] ${msg} ${timeDisplay}`);
}

function clock(start) {
    if ( !start ) return process.hrtime();
    var end = process.hrtime(start);
    return Math.round((end[0]*1000) + (end[1]/1000000));
}

module.exports = { initAppInsights, clock, startTimer, endTimer, trackTrace, generateRequestId };