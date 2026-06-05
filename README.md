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
- Task creation for all approved users
- Admin task editing and reassignment
- Admin archive of Done tasks

Daily email reminders come after this core app is stable.

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
    "email": "joaquin@aldea.example",
    "name": "Joaquin",
    "owner": "Joaquin",
    "role": "admin",
    "apps": ["task-manager", "signal"]
  },
  {
    "email": "gustavo@aldea.example",
    "name": "Gustavo",
    "owner": "Gustavo",
    "role": "user",
    "apps": ["task-manager"]
  }
]
```

For non-admin users, `owner` must match the `Owner` column in `2_TASKS`.
Non-admin users can create tasks, but the app always assigns those tasks to their
own owner name. Admin users can create tasks for any owner and filter the dashboard
between `All` and individual owners.

Add every approved user to `ALDEA_USERS_JSON` in both `.env.local` and the Vercel
Environment Variables. Each user needs:

- `email`: the Google account they will use to sign in
- `name`: the display name in the app
- `owner`: the exact owner name from the sheet
- `role`: `admin` or `user`
- `apps`: `task-manager`, `signal`, or both

If `SIGNAL_APP_URL` is set, users with `signal` in their apps can open Signal from
the shell. If it is blank, Signal appears as Coming Soon.

## Development

Install dependencies, then run:

```bash
npm run dev
```

This workspace did not include npm at scaffold time, so dependencies were not installed locally yet.
