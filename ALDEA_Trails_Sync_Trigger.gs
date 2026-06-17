/**
 * ALDEA Trails sync trigger.
 * Version: v2026.06.17-01
 * Last Updated: 2026-06-17 12:00 Europe/Lisbon
 *
 * What this script does:
 * 1. Calls the Vercel sync endpoint.
 * 2. Installs the 15-minute sync trigger.
 * 3. Logs sync responses in the workbook.
 */

const ALDEA_TRAILS_SYNC_URL = 'https://YOUR_DOMAIN/api/sync/aldea-trails';
const ALDEA_TRAILS_SYNC_TOKEN = 'REPLACE_WITH_SYNC_SECRET_TOKEN';
const ALDEA_TRAILS_SYNC_LOG_SHEET = '_SYNC_LOGS';

function runAldeaTrailsSync() {
  const response = UrlFetchApp.fetch(ALDEA_TRAILS_SYNC_URL, {
    method: 'post',
    contentType: 'application/json',
    headers: {
      Authorization: 'Bearer ' + ALDEA_TRAILS_SYNC_TOKEN
    },
    payload: JSON.stringify({ action: 'sync' }),
    muteHttpExceptions: true
  });

  const status = response.getResponseCode();
  const body = response.getContentText();

  logAldeaTrailsSyncResult(status, body);

  if (status >= 400) {
    throw new Error('ALDEA Trails sync failed with status ' + status + ': ' + body);
  }
}

function installAldeaTrailsSyncTriggers() {
  const existing = ScriptApp.getProjectTriggers()
    .filter((trigger) => trigger.getHandlerFunction() === 'runAldeaTrailsSync');

  existing.forEach((trigger) => ScriptApp.deleteTrigger(trigger));

  ScriptApp.newTrigger('runAldeaTrailsSync')
    .timeBased()
    .everyMinutes(15)
    .create();
}

function logAldeaTrailsSyncResult(status, body) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(ALDEA_TRAILS_SYNC_LOG_SHEET);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(ALDEA_TRAILS_SYNC_LOG_SHEET);
    sheet.hideSheet();
    sheet.appendRow(['Timestamp', 'HTTP Status', 'Response']);
  }

  sheet.appendRow([new Date(), status, body]);
}
