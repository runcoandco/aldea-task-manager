# ALDEA Team Task Manager Handover

Version: 2026 05

File: `ALDEA Team Task Manager.xlsx`

Purpose: provide ALDEA with a simple Google Sheets based team task manager that centralizes ownership, deadlines, blockers, and weekly action visibility without replacing WhatsApp, Gmail, or the existing Drive structure.

## 1. System role

The workbook is the team operating layer for tasks and follow up.

| Tool | Role |
|---|---|
| WhatsApp | Fast communication and informal coordination |
| Gmail | External correspondence and source of follow up items |
| Google Drive | Storage for documents, decks, PDFs, and working files |
| Google Sheets Task Manager | Shared task ownership, deadlines, blockers, and action dashboard |

Core rule:

If something has an owner, deadline, blocker, or follow up, it should become a row in `2_TASKS`.

## 2. Workbook structure

The workbook has three tabs.

| Tab | Function |
|---|---|
| `1_DASHBOARD` | Action view filtered by Owner and Area |
| `2_TASKS` | Main task database |
| `0_SETUP` | Editable dropdown lists |

No Google Groups, Google Chat, meeting notes tab, files index, or decision log are included in this version.

## 3. `2_TASKS` tab

`2_TASKS` is the source of truth. Every task should be entered here.

| Column | Field | Use |
|---|---|---|
| A | Task ID | Auto generated ID for reference |
| B | Task | Clear description of the task |
| C | Owner | Person accountable for completion |
| D | Area | Workstream |
| E | Priority | Urgent, High, Medium, or Low |
| F | Status | Current task state |
| G | Due Date | Deadline or target date |
| H | Next Action | Immediate next step |
| I | Blocker | What is stopping progress |
| J | Link | Gmail thread, Drive file, Sheet, PDF, Doc, or other reference |
| K | Notes | Short context only |

### 3.1 Task ID logic

Task IDs are generated from the row number once a Task is entered in column B.

Formula in `TASKS!A2`, copied down:

```gs
=IF(B2="";"";"TASK-"&TEXT(ROW()-1;"0000"))
```

Example:

| Row | Task ID |
|---|---|
| 2 | TASK 0001 |
| 3 | TASK 0002 |
| 4 | TASK 0003 |

Note: the visible workbook formula may appear with commas if opened in Excel. In Google Sheets with Portugal or European locale, use semicolons.

### 3.2 Completion logic

There is no Done checkbox.

A task is complete only when:

```text
Status = Done
```

This avoids conflicts between a checkbox and a status field.

### 3.3 Default entry logic

New tasks can be entered quickly even if incomplete.

Recommended defaults:

| Field | Default |
|---|---|
| Priority | Medium |
| Status | To Do |
| Owner | Blank until assigned |
| Area | Blank until sorted |
| Due Date | Blank until known |

## 4. `1_DASHBOARD` tab

The dashboard is the action view. It is not a reporting dashboard and does not show charts or totals in this version.

### 4.1 Selectors

The dashboard has two selectors.

| Selector | Purpose |
|---|---|
| Owner | Show all tasks or tasks for one person |
| Area | Show all workstreams or one workstream |

Selector behavior:

| Owner | Area | Result |
|---|---|---|
| ALL | ALL | Full team action view |
| Joaquin | ALL | Joaquin’s action view |
| ALL | Legal | Legal action view |
| Manuela | Sales | Manuela’s Sales tasks |

### 4.2 Dashboard blocks

The dashboard uses vertical blocks. Each block returns the top 5 matching tasks.

| Block | Meaning |
|---|---|
| Overdue | Open tasks with Due Date before today |
| Due This Week | Open tasks due from today through the next 7 days |
| Urgent and High Priority Open | Open tasks marked Urgent or High |
| Blocked | Open tasks with Status = Blocked |
| Waiting | Open tasks with Status = Waiting |

### 4.3 Dashboard output fields

Each block shows the same task fields:

| Field |
|---|
| Task ID |
| Task |
| Owner |
| Area |
| Priority |
| Status |
| Due Date |
| Next Action |

### 4.4 Dashboard formulas

The dashboard formulas use the same base pattern.

They filter `2_TASKS`, exclude completed tasks when needed, apply Owner and Area selectors, sort results, and return the first 5 rows.

In Google Sheets with European locale, formulas should use semicolons. Example logic for Overdue:

```gs
=IFERROR(TAKE(SORT(FILTER({TASKS!A2:A500\TASKS!B2:B500\TASKS!C2:C500\TASKS!D2:D500\TASKS!E2:E500\TASKS!F2:F500\TASKS!G2:G500\TASKS!H2:H500};TASKS!F2:F500<>"Done";TASKS!G2:G500<TODAY();TASKS!G2:G500<>"";IF($B$3="ALL";TRUE;TASKS!C2:C500=$B$3);IF($B$4="ALL";TRUE;TASKS!D2:D500=$B$4));7;TRUE);5);"")
```

Depending on Google Sheets locale, the inline array separator may need to be adjusted. If the formula fails after importing from Excel, rebuild it directly in Google Sheets using the local separator rules shown by the sheet.

## 5. `0_SETUP` tab

`0_SETUP` stores editable dropdown values.

### 5.1 Owners

Initial owner list:

| Owner | Email |
|---|---|
| Joaquin | |
| Manuela | |
| Jimena | |
| Cristián | |
| Arnold | |
| Arturo | |

This list can be edited as the team changes.

### 5.2 Areas

Initial area list:

| Area |
|---|
| Sales |
| Legal |
| Finance |
| Banks |
| Construction |
| Marketing |
| Operations |
| Admin |

### 5.3 Priorities

| Priority |
|---|
| Urgent |
| High |
| Medium |
| Low |

### 5.4 Statuses

| Status |
|---|
| To Do |
| Doing |
| Waiting |
| Blocked |
| Done |

### 5.5 Selector lists

The dashboard selectors should include `ALL` plus the relevant list values from `0_SETUP`.

| Selector | Source |
|---|---|
| Owner selector | ALL plus Owners |
| Area selector | ALL plus Areas |

## 6. Operating rules

### 6.1 Who can add tasks

Everyone can add tasks directly into `2_TASKS`.

The system is intentionally designed to allow incomplete first entry. It is better to capture a task roughly than lose it in WhatsApp or Gmail.

### 6.2 Who cleans the sheet

Joaquin, or whoever owns operations governance, should clean the sheet during review.

Cleanup means:

| Cleanup action |
|---|
| Assign missing Owner |
| Assign missing Area |
| Confirm Priority |
| Confirm Status |
| Add Due Date when needed |
| Clarify vague task descriptions |
| Add missing Drive or Gmail links |
| Move completed work to Status = Done |

### 6.3 WhatsApp workflow

WhatsApp remains the main communication channel.

Rule:

If a WhatsApp message creates a real follow up, add one task row in `2_TASKS`.

Do not copy every WhatsApp message. Only capture tasks, blockers, commitments, deadlines, and follow ups.

### 6.4 Gmail workflow

Gmail remains the external communication layer.

Rule:

If an email requires follow up, create a task and paste the Gmail thread link in `Link`.

### 6.5 Drive workflow

Drive remains the file storage layer.

Rule:

If a task depends on a document, deck, Sheet, PDF, or folder, paste the relevant Drive link in `Link`.

## 7. Status definitions

| Status | Meaning |
|---|---|
| To Do | Task has not started |
| Doing | Work is actively moving |
| Waiting | Waiting for another person, reply, file, or external input |
| Blocked | Cannot move until a blocker is resolved |
| Done | Complete and no longer active |

Use `Waiting` when progress depends on someone else but nothing is wrong.

Use `Blocked` when progress cannot continue and needs intervention.

## 8. Priority definitions

| Priority | Meaning |
|---|---|
| Urgent | Needs immediate attention, usually today or tomorrow |
| High | Important and should stay visible |
| Medium | Normal active work |
| Low | Useful but not pressing |

Do not overuse Urgent. If everything is Urgent, the dashboard loses value.

### 8.1 Due date email reminders

The Task Master spreadsheet sends morning reminders using a bound Google Apps Script.

Reminder rules:

- send one email when `Due Date` is today and `Status` is not `Done`
- send one extra email exactly 7 days later if the task is still not `Done`

The Apps Script reads owner email addresses from `0_SETUP` columns A:B.
It also writes a reminder log so the same reminder is not sent twice.

## 9. Import and localization notes

The workbook was generated as an `.xlsx` file for upload into Google Drive.

Recommended import process:

1. Upload `ALDEA Team Task Manager.xlsx` to Google Drive.
2. Open with Google Sheets.
3. Confirm the formulas work after conversion.
4. Set the spreadsheet locale to Portugal if needed.
5. Save as a native Google Sheets file.
6. Move it into the final ALDEA Drive folder.

Because Excel and Google Sheets use different formula localization rules, formulas may require adjustment after upload.

Main difference:

| Environment | Argument separator |
|---|---|
| Excel English style | Comma |
| Google Sheets European locale | Semicolon |

## 10. Maintenance guidance

Keep this workbook lean.

Do not add new tabs unless the team is already using the core system reliably.

Potential future additions only if needed:

| Future addition | Trigger |
|---|---|
| Decision log | Decisions start disappearing in WhatsApp or meetings |
| Meeting notes tab | Meetings create too many uncaptured actions |
| Files index | Drive remains too hard to navigate after folder cleanup |
| Dashboard totals | Weekly management requires summary counts |
| Google Groups | Shared email routing becomes a real operational problem |

Current recommendation:

Keep version 1 limited to `1_DASHBOARD`, `2_TASKS`, and `0_SETUP`.

## 11. Governance summary

| Rule | Owner |
|---|---|
| Anyone can add a task | Whole team |
| Every task should have an Owner | Ops governance |
| Every active task should have a Status | Task owner |
| Completed tasks must use Status = Done | Task owner |
| Dashboard is reviewed through Owner and Area selectors | Team |
| Dropdown lists are maintained in `0_SETUP` | Ops governance |

## 12. Key design decisions

| Decision | Final choice |
|---|---|
| Platform | Google Sheets |
| System type | Task Manager plus Dashboard |
| Tabs | `1_DASHBOARD`, `2_TASKS`, `0_SETUP` |
| Dashboard layout | Vertical action blocks |
| Dashboard selectors | Owner and Area |
| Personal view | Same dashboard filtered by Owner |
| Task completion | Status = Done |
| Task ID | Auto generated from row number |
| Google Groups | Not included |
| Google Chat | Not used |
| Separate personal dashboards | Not included |
| Separate decision log | Not included in version 1 |
