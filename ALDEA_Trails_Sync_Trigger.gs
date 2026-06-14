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
  const hours = [6, 12, 18];
  const existing = ScriptApp.getProjectTriggers()
    .filter((trigger) => trigger.getHandlerFunction() === 'runAldeaTrailsSync');

  existing.forEach((trigger) => ScriptApp.deleteTrigger(trigger));

  hours.forEach((hour) => {
    ScriptApp.newTrigger('runAldeaTrailsSync')
      .timeBased()
      .atHour(hour)
      .everyDays(1)
      .create();
  });
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
