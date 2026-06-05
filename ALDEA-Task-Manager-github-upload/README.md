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
- Admin and user roles
- Per-user task visibility
- Server-side Google Sheets reads and writes
- Task dashboard sections
- Mark Done
- Status changes
- Notes updates
- Admin task creation
- Admin task editing and reassignment
- Admin archive of Done tasks

Daily email reminders and the shared ALDEA shell come after this core app is stable.

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

## Development

Install dependencies, then run:

```bash
npm run dev
```

This workspace did not include npm at scaffold time, so dependencies were not installed locally yet.
