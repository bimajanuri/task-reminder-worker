# Task Reminder Worker

A Cloudflare Worker that sends WhatsApp reminders for tasks using WAHA.

## Features

- **3-Step Reminder Logic**:
  - T-24 hours
  - 07:00 AM (Day of)
  - T-1 hour (skipped if at 07:00 AM)
- **WAHA Integration**: Session management and message sending.
- **D1 Database**: Persistent storage for tasks and reminder logs.

## Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Create D1 Database**:
   ```bash
   npx wrangler d1 create task_reminder_db
   ```
   Copy the `database_id` to `wrangler.toml`.

3. **Initialize Schema**:
   ```bash
   npx wrangler d1 execute task_reminder_db --local --file=./schema.sql
   npx wrangler d1 execute task_reminder_db --remote --file=./schema.sql
   ```

4. **Set Environment Variables**:
   Update `WAHA_URL` in `wrangler.toml` or use `npx wrangler secret put WAHA_URL`.

5. **Deploy**:
   ```bash
   npx wrangler deploy
   ```

## API Endpoints

- `GET /`: Health check.
- `GET /api/wa-status`: Get WAHA session status.
- `GET /api/wa-login`: Get WAHA QR code.
- `DELETE /api/wa-logout`: Logout WAHA session.
- `POST /api/tasks`: Add a new task (`title`, `deadline`, `phone_number`).
- `GET /api/tasks`: List all tasks.

## Scheduler

The worker runs every minute to check for pending reminders. Timezone is handled for Asia/Jakarta (WIB).
