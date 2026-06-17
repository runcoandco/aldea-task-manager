/**
 * ALDEA Task Manager sheet utilities.
 * Version: v2026.06.17-01
 * Last Updated: 2026-06-17 12:30 Europe/Lisbon
 *
 * What this script does:
 * 1. Adds the Task Manager menu.
 * 2. Archives Done tasks into 3_ARCHIVE.
 * 3. Marks tasks Done from the dashboard checkbox.
 */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('ALDEA Tasks')
    .addItem('Archive Done Tasks', 'archiveDoneTasks')
    .addToUi();

  if (typeof addReminderMenu_ === 'function') {
    addReminderMenu_();
  }
}

function archiveDoneTasks() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tasksSheet = ss.getSheetByName('2_TASKS');
  const archiveSheetName = '3_ARCHIVE';

  if (!tasksSheet) {
    SpreadsheetApp.getUi().alert('2_TASKS tab not found.');
    return;
  }

  let archiveSheet = ss.getSheetByName(archiveSheetName);

  if (!archiveSheet) {
    archiveSheet = ss.insertSheet(archiveSheetName);

    const headers = tasksSheet
      .getRange(1, 1, 1, tasksSheet.getLastColumn())
      .getValues()[0];

    archiveSheet
      .getRange(1, 1, 1, headers.length + 1)
      .setValues([[...headers, 'Archived At']]);

    archiveSheet.setFrozenRows(1);
  }

  const lastRow = tasksSheet.getLastRow();
  const lastCol = tasksSheet.getLastColumn();

  if (lastRow < 2) {
    SpreadsheetApp.getUi().alert('No tasks to archive.');
    return;
  }

  const dataRange = tasksSheet.getRange(2, 1, lastRow - 1, lastCol);
  const data = dataRange.getValues();

  const headers = tasksSheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const statusColIndex = headers.indexOf('Status');

  if (statusColIndex === -1) {
    SpreadsheetApp.getUi().alert('Status column not found.');
    return;
  }

  const rowsToArchive = [];
  const rowsToDelete = [];

  data.forEach((row, index) => {
    const status = String(row[statusColIndex]).trim();

    if (status === 'Done') {
      rowsToArchive.push([...row, new Date()]);
      rowsToDelete.push(index + 2);
    }
  });

  if (rowsToArchive.length === 0) {
    SpreadsheetApp.getUi().alert('No Done tasks found.');
    return;
  }

  const archiveStartRow = archiveSheet.getLastRow() + 1;

  archiveSheet
    .getRange(archiveStartRow, 1, rowsToArchive.length, rowsToArchive[0].length)
    .setValues(rowsToArchive);

  rowsToDelete.reverse().forEach((rowNumber) => {
    tasksSheet.deleteRow(rowNumber);
  });

  SpreadsheetApp.getUi().alert(rowsToArchive.length + ' Done task(s) archived.');
}

function onEdit(e) {
  if (!e || !e.range) return;

  const sheet = e.range.getSheet();
  if (sheet.getName() !== '1_DASHBOARD') return;

  const editedValue = e.range.getValue();
  if (editedValue !== true) return;

  const row = e.range.getRow();
  const col = e.range.getColumn();

  const markDoneCols = [1];
  if (!markDoneCols.includes(col)) return;

  const taskId = sheet.getRange(row, col + 1).getValue();
  if (!taskId) {
    e.range.setValue(false);
    return;
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tasksSheet = ss.getSheetByName('2_TASKS');
  const tasksData = tasksSheet.getDataRange().getValues();

  const headers = tasksData[0];
  const taskIdCol = headers.indexOf('Task ID');
  const statusCol = headers.indexOf('Status');

  if (taskIdCol === -1 || statusCol === -1) {
    e.range.setValue(false);
    SpreadsheetApp.getUi().alert('Task ID or Status column not found in 2_TASKS.');
    return;
  }

  for (let i = 1; i < tasksData.length; i++) {
    if (String(tasksData[i][taskIdCol]).trim() === String(taskId).trim()) {
      tasksSheet.getRange(i + 1, statusCol + 1).setValue('Done');
      e.range.setValue(false);
      return;
    }
  }

  e.range.setValue(false);
  SpreadsheetApp.getUi().alert('Task ID not found in 2_TASKS: ' + taskId);
}
