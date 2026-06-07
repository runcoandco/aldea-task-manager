// ============================================================
// ALDEA Task Manager - Due Date Email Reminders
// ============================================================
// Paste this file into Extensions > Apps Script in the Task Master
// Google Sheet, then run installTaskReminderTrigger() once.
//
// Setup expectations:
// - 2_TASKS contains the task table
// - 0_SETUP has Owner in column A and Email in column B
// - The script runs as the sheet owner
//
// Reminder rules:
// - Send one email on the due date morning when Status != Done
// - Send one extra email 7 days later when Status != Done
// - Do not send duplicates for the same task/reminder type/date
// ============================================================

var CONFIG = {
  TASK_SHEET: '2_TASKS',
  SETUP_SHEET: '0_SETUP',
  LOG_SHEET: '9_REMINDER_LOG',
  TASK_DATA_START_ROW: 2,
  SETUP_DATA_START_ROW: 2,
  OWNER_COL: 1, // A
  EMAIL_COL: 2, // B
  NOTIFICATION_FROM: '',
  NOTIFICATION_FROM_NAME: 'ALDEA Task Manager',
  DUE_REMINDER_DAYS: 0,
  FOLLOW_UP_DAYS: 7
};

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('ALDEA Reminders')
    .addItem('Install daily trigger', 'installTaskReminderTrigger')
    .addItem('Run reminders now', 'runTaskDueReminders')
    .addToUi();
}

function installTaskReminderTrigger() {
  removeTaskReminderTriggers_();

  ScriptApp.newTrigger('runTaskDueReminders')
    .timeBased()
    .everyDays(1)
    .atHour(7)
    .nearMinute(0)
    .create();
}

function removeTaskReminderTriggers_() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'runTaskDueReminders') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
}

function runTaskDueReminders() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var taskSheet = ss.getSheetByName(CONFIG.TASK_SHEET);
  if (!taskSheet) {
    throw new Error('Missing sheet: ' + CONFIG.TASK_SHEET);
  }

  var ownerEmailMap = buildOwnerEmailMap_(ss);
  var reminderLog = ensureReminderLogSheet_(ss);
  var timezone = ss.getSpreadsheetTimeZone() || Session.getScriptTimeZone();
  var todayKey = dateKey_(new Date(), timezone);
  var lastRow = taskSheet.getLastRow();

  if (lastRow < CONFIG.TASK_DATA_START_ROW) {
    return { success: true, sent: 0 };
  }

  var values = taskSheet.getRange(
    CONFIG.TASK_DATA_START_ROW,
    1,
    lastRow - CONFIG.TASK_DATA_START_ROW + 1,
    11
  ).getValues();

  var sent = 0;
  for (var i = 0; i < values.length; i++) {
    var task = rowToTask_(values[i], CONFIG.TASK_DATA_START_ROW + i);
    if (!task.taskId && !task.task) {
      continue;
    }

    if (!isOpenTask_(task.status)) {
      continue;
    }

    var dueDate = parseTaskDate_(task.dueDate);
    if (!dueDate) {
      continue;
    }

    var dueKey = dateKey_(dueDate, timezone);
    var daysFromDue = differenceInDays_(todayKey, dueKey);
    var reminderType = null;

    if (daysFromDue === CONFIG.DUE_REMINDER_DAYS) {
      reminderType = 'due-today';
    } else if (daysFromDue === CONFIG.FOLLOW_UP_DAYS) {
      reminderType = 'follow-up-7-days';
    } else {
      continue;
    }

    var recipient = ownerEmailMap[normalizeName_(task.owner)];
    if (!recipient) {
      continue;
    }

    if (hasReminderAlreadyBeenSent_(reminderLog, task.taskId, reminderType, dueKey)) {
      continue;
    }

    sendReminderEmail_(ss, task, recipient, reminderType, dueDate, timezone, daysFromDue);
    appendReminderLog_(reminderLog, task, recipient, reminderType, dueKey, timezone);
    sent++;
  }

  return { success: true, sent: sent };
}

function rowToTask_(row, rowNumber) {
  return {
    rowNumber: rowNumber,
    taskId: String(row[0] || '').trim(),
    task: String(row[1] || '').trim(),
    owner: String(row[2] || '').trim(),
    area: String(row[3] || '').trim(),
    priority: String(row[4] || '').trim(),
    status: String(row[5] || '').trim(),
    dueDate: row[6],
    blocker: String(row[7] || '').trim(),
    nextAction: String(row[8] || '').trim(),
    link: String(row[9] || '').trim(),
    notes: String(row[10] || '').trim()
  };
}

function isOpenTask_(status) {
  return normalizeName_(status) !== 'done';
}

function buildOwnerEmailMap_(ss) {
  var setup = ss.getSheetByName(CONFIG.SETUP_SHEET);
  if (!setup) {
    throw new Error('Missing sheet: ' + CONFIG.SETUP_SHEET);
  }

  var lastRow = setup.getLastRow();
  if (lastRow < CONFIG.SETUP_DATA_START_ROW) {
    return {};
  }

  var values = setup.getRange(
    CONFIG.SETUP_DATA_START_ROW,
    CONFIG.OWNER_COL,
    lastRow - CONFIG.SETUP_DATA_START_ROW + 1,
    CONFIG.EMAIL_COL - CONFIG.OWNER_COL + 1
  ).getValues();

  var map = {};
  for (var i = 0; i < values.length; i++) {
    var owner = String(values[i][0] || '').trim();
    var email = String(values[i][1] || '').trim();
    if (owner && email) {
      map[normalizeName_(owner)] = email;
    }
  }

  return map;
}

function ensureReminderLogSheet_(ss) {
  var sheet = ss.getSheetByName(CONFIG.LOG_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.LOG_SHEET);
    sheet.getRange(1, 1, 1, 8).setValues([[
      'Timestamp',
      'Reminder Type',
      'Task ID',
      'Due Date',
      'Owner',
      'Recipient Email',
      'Subject',
      'Task Row'
    ]]);
    sheet.setFrozenRows(1);
  }

  return sheet;
}

function hasReminderAlreadyBeenSent_(logSheet, taskId, reminderType, dueKey) {
  var lastRow = logSheet.getLastRow();
  if (lastRow < 2) {
    return false;
  }

  var values = logSheet.getRange(2, 1, lastRow - 1, 4).getValues();
  for (var i = 0; i < values.length; i++) {
    var rowReminderType = String(values[i][1] || '').trim();
    var rowTaskId = String(values[i][2] || '').trim();
    var rowDueKey = String(values[i][3] || '').trim();
    if (rowReminderType === reminderType && rowTaskId === taskId && rowDueKey === dueKey) {
      return true;
    }
  }

  return false;
}

function appendReminderLog_(logSheet, task, recipient, reminderType, dueKey, timezone) {
  var subject = buildReminderSubject_(task, reminderType);
  logSheet.appendRow([
    new Date(),
    reminderType,
    task.taskId,
    dueKey,
    task.owner,
    recipient,
    subject,
    task.rowNumber
  ]);
}

function sendReminderEmail_(ss, task, recipient, reminderType, dueDate, timezone, daysFromDue) {
  var subject = buildReminderSubject_(task, reminderType);
  var plainBody = buildReminderPlainBody_(ss, task, reminderType, dueDate, timezone, daysFromDue);
  var htmlBody = buildReminderHtmlBody_(ss, task, reminderType, dueDate, timezone, daysFromDue);
  sendEmailFromConfiguredAlias_(recipient, subject, plainBody, htmlBody);
}

function buildReminderSubject_(task, reminderType) {
  if (reminderType === 'follow-up-7-days') {
    return 'ALDEA Task Follow-up: ' + task.taskId + ' - ' + task.task;
  }
  return 'ALDEA Task Due Today: ' + task.taskId + ' - ' + task.task;
}

function buildReminderPlainBody_(ss, task, reminderType, dueDate, timezone, daysFromDue) {
  var reminderLine = reminderType === 'follow-up-7-days'
    ? 'This task was due 7 days ago and is still not marked Done.'
    : 'This task is due today.';

  return [
    'Hi ' + task.owner + ',',
    '',
    reminderLine,
    '',
    'Task ID: ' + task.taskId,
    'Task: ' + task.task,
    'Owner: ' + task.owner,
    'Area: ' + task.area,
    'Priority: ' + task.priority,
    'Status: ' + task.status,
    'Due Date: ' + formatTaskDate_(dueDate, timezone),
    'Days from Due: ' + String(daysFromDue),
    'Blocker: ' + (task.blocker || '-'),
    'Next Action: ' + (task.nextAction || '-'),
    'Link: ' + (task.link || '-'),
    'Notes: ' + (task.notes || '-'),
    '',
    'Task Manager sheet: ' + ss.getUrl()
  ].join('\n');
}

function buildReminderHtmlBody_(ss, task, reminderType, dueDate, timezone, daysFromDue) {
  var reminderLine = reminderType === 'follow-up-7-days'
    ? '<p><strong>This task was due 7 days ago and is still not marked Done.</strong></p>'
    : '<p><strong>This task is due today.</strong></p>';

  return (
    '<p>Hi ' + escapeHtml_(task.owner) + ',</p>' +
    reminderLine +
    '<table cellpadding="6" cellspacing="0" style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:14px;">' +
    rowHtml_('Task ID', task.taskId) +
    rowHtml_('Task', task.task) +
    rowHtml_('Owner', task.owner) +
    rowHtml_('Area', task.area) +
    rowHtml_('Priority', task.priority) +
    rowHtml_('Status', task.status) +
    rowHtml_('Due Date', formatTaskDate_(dueDate, timezone)) +
    rowHtml_('Days from Due', String(daysFromDue)) +
    rowHtml_('Blocker', task.blocker || '-') +
    rowHtml_('Next Action', task.nextAction || '-') +
    rowHtml_('Link', task.link || '-') +
    rowHtml_('Notes', task.notes || '-') +
    '</table>' +
    '<p><a href="' + ss.getUrl() + '" style="display:inline-block;background:#8B6C59;color:#fff;text-decoration:none;padding:12px 18px;border-radius:6px;">Open Task Master Sheet</a></p>'
  );
}

function rowHtml_(label, value) {
  return '<tr><td><strong>' + escapeHtml_(label) + '</strong></td><td>' + escapeHtml_(value) + '</td></tr>';
}

function sendEmailFromConfiguredAlias_(recipient, subject, plainBody, htmlBody) {
  var options = {
    htmlBody: htmlBody
  };

  if (CONFIG.NOTIFICATION_FROM) {
    validateNotificationSender_();
    options.from = CONFIG.NOTIFICATION_FROM;
    options.name = CONFIG.NOTIFICATION_FROM_NAME;
    options.replyTo = CONFIG.NOTIFICATION_FROM;
  } else {
    options.name = CONFIG.NOTIFICATION_FROM_NAME;
  }

  GmailApp.sendEmail(recipient, subject, plainBody, options);
}

function validateNotificationSender_() {
  var aliases = GmailApp.getAliases();
  if (aliases.indexOf(CONFIG.NOTIFICATION_FROM) === -1) {
    throw new Error(CONFIG.NOTIFICATION_FROM + ' is not configured as a Gmail send-as alias for this Apps Script account.');
  }
}

function parseTaskDate_(value) {
  if (value instanceof Date && !isNaN(value.getTime())) {
    return value;
  }

  if (typeof value === 'number' && value > 0) {
    return new Date(Math.round((value - 25569) * 86400 * 1000));
  }

  var text = String(value || '').trim();
  if (!text) {
    return null;
  }

  var parsed = new Date(text);
  if (!isNaN(parsed.getTime())) {
    return parsed;
  }

  var match = text.match(/^(\d{4})[\/-](\d{2})[\/-](\d{2})$/);
  if (match) {
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }

  return null;
}

function formatTaskDate_(date, timezone) {
  return Utilities.formatDate(date, timezone, 'dd/MM/yyyy');
}

function dateKey_(date, timezone) {
  return Utilities.formatDate(date, timezone, 'yyyy-MM-dd');
}

function differenceInDays_(laterKey, earlierKey) {
  var later = keyToUtcDate_(laterKey);
  var earlier = keyToUtcDate_(earlierKey);
  return Math.round((later.getTime() - earlier.getTime()) / 86400000);
}

function keyToUtcDate_(key) {
  var parts = String(key || '').split('-');
  return new Date(Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])));
}

function normalizeName_(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function escapeHtml_(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
