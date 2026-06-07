# ALDEA Task Manager

Internal web app that translates the existing ALDEA Google Sheets Task Manager into a secure web interface.

The app keeps the current Master Sheet as the source of truth and mirrors the existing dashboard rules:

1. Overdue
2. Blocked
3. Waiting
4. This Week
5. Open Urgent / High Priority

Each task appears in only one section, following that priority order.

## Current Scope

- Google login
- Approved-user access
- Shared app shell after login
- Admin and user roles
- Per-user task visibility
- Admin owner filtering
- Server-side Google Sheets reads and writes
- Task dashboard sections
- Mark Done
- Status changes
- Notes updates
- Task creation for all approved users, with selectable owners
- Task editing and reassignment
- Task deletion from edit mode
- Admin archive of Done tasks

Daily email reminders are handled in the Task Master Google Sheet with a bound Apps Script.

## Environment

Copy `.env.example` to `.env.local` and fill in the values.

Required Google setup:

- Google OAuth client for login
- Google service account for Sheets API access
- Share the Task Master Google Sheet with the service account email
- Add the OAuth callback URL:

```text
http://localhost:3000/api/auth/callback
```

For Vercel production, also add:

```text
https://YOUR_DOMAIN/api/auth/callback
```

After login, `/` shows the ALDEA app shell. The Task Manager lives at:

```text
/task-manager
```

## User Mapping

`ALDEA_USERS_JSON` controls who can access the app and what they can see.

Example:

```json
[
  {
    "email": "jbrillembourg@gmail.com",
    "name": "Joaquin",
    "owner": "Joaquin",
    "signalOwner": "Joaquin Brillembourg",
    "role": "admin",
    "apps": ["task-manager", "signal"]
  },
  {
    "email": "manusalvatierra@gmail.com",
    "name": "Manuela",
    "owner": "Manuela",
    "signalOwner": "Manuela Salvatierra",
    "role": "admin",
    "apps": ["task-manager", "signal"]
  },
  {
    "email": "jsalvat86@gmail.com",
    "name": "Jimena",
    "owner": "Jimena",
    "signalOwner": "Jimena Salvatierra",
    "role": "user",
    "apps": ["task-manager", "signal"]
  },
  {
    "email": "gustavomoncada5@gmail.com",
    "name": "Gustavo",
    "owner": "Gustavo",
    "role": "user",
    "apps": ["task-manager", "signal"]
  },
  {
    "email": "pedromazamezzoni@gmail.com",
    "name": "Pedro",
    "owner": "Pedro",
    "role": "user",
    "apps": ["task-manager", "signal"]
  },
  {
    "email": "montanarella.marina@gmail.com",
    "name": "Marina",
    "owner": "Marina",
    "role": "user",
    "apps": ["task-manager", "signal"]
  },
  {
    "email": "mafaldacpestana@gmail.com",
    "name": "Mafalda",
    "owner": "Mafalda",
    "role": "user",
    "apps": ["task-manager", "signal"]
  },
  {
    "email": "cristianroberts@gmail.com",
    "name": "Cristián",
    "owner": "Cristián",
    "signalOwner": "Cristián Roberts",
    "role": "user",
    "apps": ["task-manager", "signal"]
  }
]
```

For non-admin users, `owner` must match the `Owner` column in `2_TASKS`.
Any approved user can create tasks and choose any approved owner from the sheet.
Tasks stay visible to the assigned owner, the creator, and admins, so the person who logged the task can still open Edit Task and delete a mistake or duplicate.
Admin users can also filter the dashboard between `All` and individual owners.

Add every approved user to `ALDEA_USERS_JSON` in both `.env.local` and the Vercel
Environment Variables. Each user needs:

- `email`: the Google account they will use to sign in
- `name`: the display name in the app
- `owner`: the exact owner name from the sheet
- `signalOwner`: the exact owner name from Signal's CRM sheet, when different from `owner`
- `role`: `admin` or `user`
- `apps`: `task-manager`, `signal`, or both

If `SIGNAL_APP_URL` is set, users with `signal` in their apps can open Signal from
the shell. If it is blank, Signal appears as Coming Soon.

## Due Date Email Reminders

The Task Manager spreadsheet can send morning reminders directly from Google Apps Script.

Reminder rule:

- send one email when a task is due today and still not `Done`
- send one extra email 7 days later if the task is still not `Done`

Setup:

- add `Created By` as column `L` in `2_TASKS` if it is not there yet
- add `Owner` in column A and `Email` in column B of `0_SETUP`
- paste `Task_Manager_Due_Date_Reminders.gs` into the Task Master spreadsheet Apps Script
- run `installTaskReminderTrigger()` once to create the daily morning trigger

The reminder email includes the task details, due date, blocker, next action, link, and notes.

## Development

Install dependencies, then run:

```bash
npm run dev
```

This workspace did not include npm at scaffold time, so dependencies were not installed locally yet.
