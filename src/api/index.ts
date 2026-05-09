import { Hono } from 'hono'
import { cors } from 'hono/cors' // Perbaikan Poin 6: Import CORS

type Bindings = {
  DB: D1Database
  WAHA_URL: string
  WAHA_API_KEY: string
}

const app = new Hono<{ Bindings: Bindings }>()

// SESSION_NAME konsisten menggunakan 'gereja-bot' sesuai response WAHA Anda
const SESSION_NAME = 'gereja-bot'

// Perbaikan Poin 6: Aktifkan CORS agar Frontend Astro bisa mengakses API
app.use('/api/*', cors())

// Helper untuk fetch ke WAHA dengan Autentikasi
const wahaFetch = (env: Bindings, path: string, options: RequestInit = {}) => {
  const url = `${env.WAHA_URL}${path}`
  const headers = {
    ...options.headers,
    'X-Api-Key': env.WAHA_API_KEY,
    'Content-Type': 'application/json',
  }
  return fetch(url, { ...options, headers })
}

// --- API WAHA ---

// 1. Cek Status Semua Session
app.get('/api/wa-status', async (c) => {
  try {
    const response = await wahaFetch(c.env, '/api/sessions?all=true')
    const data = await response.json()
    return c.json(data)
  } catch (error) {
    return c.json({ error: 'Failed to fetch WAHA status' }, 500)
  }
})

// 2. Perbaikan Poin 3: API Terpisah untuk Start Session (POST)
app.post('/api/wa-login', async (c) => {
  try {
    const response = await wahaFetch(c.env, `/api/sessions/${SESSION_NAME}/start`, {
      method: 'POST'
    })
    const data = await response.json()
    return c.json(data)
  } catch (error) {
    return c.json({ error: 'Failed to Start Session' }, 500)
  }
})

// 3. Perbaikan Poin 3: API Terpisah untuk Ambil Gambar QR (GET)
app.get('/api/wa-qr', async (c) => {
  try {
    const response = await wahaFetch(c.env, `/api/sessions/${SESSION_NAME}/qr`)
    if (!response.ok) return c.json({ error: 'QR not available. Start session first.' }, 404)

    const blob = await response.blob()
    return new Response(blob, {
      headers: { 'Content-Type': 'image/png' }
    })
  } catch (error) {
    return c.json({ error: 'Failed to fetch QR Code' }, 500)
  }
})

// 4. Logout / Stop Session
app.delete('/api/wa-logout', async (c) => {
  try {
    const response = await wahaFetch(c.env, `/api/sessions/${SESSION_NAME}/stop`, {
      method: 'POST'
    })
    const data = await response.json()
    return c.json(data)
  } catch (error) {
    return c.json({ error: 'Failed to logout' }, 500)
  }
})

// --- Task Management ---

app.post('/api/tasks', async (c) => {
  const { name, title, description, deadline, phone_number } = await c.req.json()
  const result = await c.env.DB.prepare(
    'INSERT INTO tasks (name, title, description, deadline, phone_number) VALUES (?, ?, ?, ?, ?)'
  ).bind(name, title, description, deadline, phone_number).run()
  return c.json({ success: true, result })
})

app.get('/api/tasks', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT * FROM tasks ORDER BY deadline ASC').all()
  return c.json(results)
})

// Perbaikan Poin 5: API untuk Menghapus Task
app.delete('/api/tasks/:id', async (c) => {
  const id = c.req.param('id')
  try {
    await c.env.DB.prepare('DELETE FROM tasks WHERE id = ?').bind(id).run()
    return c.json({ success: true, message: 'Task deleted successfully' })
  } catch (error) {
    return c.json({ error: 'Failed to delete task' }, 500)
  }
})

// --- Manual Test Sending ---

app.post('/api/tasks/:id/test-send', async (c) => {
  const id = c.req.param('id')
  try {
    const task = await c.env.DB.prepare('SELECT * FROM tasks WHERE id = ?').bind(id).first() as any
    if (!task) return c.json({ error: 'Task not found' }, 404)

    const message = `🧪 *TEST MANUAL*\n\nHallo *${task.name}*!\nReminder: *${task.title}*\nDue: ${task.deadline}`

    const res = await wahaFetch(c.env, '/api/sendText', {
      method: 'POST',
      body: JSON.stringify({
        chatId: `${task.phone_number}@c.us`,
        text: message,
        session: SESSION_NAME
      })
    })

    if (res.ok) {
      await c.env.DB.batch([
        c.env.DB.prepare('UPDATE tasks SET status = ? WHERE id = ?').bind('tested', id),
        c.env.DB.prepare('INSERT INTO reminders (task_id, type) VALUES (?, ?)').bind(id, 'manual_test')
      ])
      return c.json({ success: true, message: 'Message sent & DB updated' })
    }
    return c.json({ error: 'WAHA rejected request' }, 400)
  } catch (error) {
    return c.json({ error: 'Internal Server Error' }, 500)
  }
})

// --- Cron Scheduler Export ---

export default {
  fetch: app.fetch,
  async scheduled(event: ScheduledEvent, env: Bindings, ctx: ExecutionContext) {
    ctx.waitUntil(syncSessionStatus(env))
    ctx.waitUntil(handleReminders(env))
  }
}

// --- Background Logic (WIB Timezone) ---

async function syncSessionStatus(env: Bindings) {
  try {
    const response = await wahaFetch(env, `/api/sessions/${SESSION_NAME}`)
    if (response.ok) {
      const data = await response.json() as any
      await env.DB.prepare(
        'INSERT INTO wa_sessions (session_id, status) VALUES (?, ?) ON CONFLICT(session_id) DO UPDATE SET status = EXCLUDED.status'
      ).bind(SESSION_NAME, data.status).run()
    }
  } catch (e) { console.error(e) }
}

async function handleReminders(env: Bindings) {
  const now = new Date()
  const nowUtc = now.getTime()
  const { results: tasks } = await env.DB.prepare('SELECT * FROM tasks WHERE status = "pending"').all()

  for (const task of (tasks as any[])) {
    const deadlineUtc = new Date(task.deadline).getTime()
    const diffHours = (deadlineUtc - nowUtc) / (1000 * 60 * 60)
    const hourWib = (now.getUTCHours() + 7) % 24
    const minWib = now.getUTCMinutes()

    // T-24h
    if (diffHours <= 24 && diffHours > 23) await sendReminder(env, task, '24h')

    // 7 AM WIB Hari H
    if (hourWib === 7 && minWib === 0) {
      const today = new Date(nowUtc + 7 * 3600000).toISOString().split('T')[0]
      const taskDay = new Date(deadlineUtc + 7 * 3600000).toISOString().split('T')[0]
      if (today === taskDay) await sendReminder(env, task, '7am')
    }

    // T-1h (Skip if 7 AM)
    if (diffHours <= 1 && diffHours > 0 && hourWib !== 7) await sendReminder(env, task, '1h')
  }
}

async function sendReminder(env: Bindings, task: any, type: string) {
  const existing = await env.DB.prepare('SELECT id FROM reminders WHERE task_id = ? AND type = ?').bind(task.id, type).first()
  if (existing) return

  const message = `Halo *${task.name}*! 👋\nPengingat *${type}* untuk: *${task.title}*\n\n${task.description || ''}\nDeadline: ${task.deadline}`

  try {
    const res = await wahaFetch(env, '/api/sendText', {
      method: 'POST',
      body: JSON.stringify({ chatId: `${task.phone_number}@c.us`, text: message, session: SESSION_NAME })
    })
    if (res.ok) {
      await env.DB.prepare('INSERT INTO reminders (task_id, type) VALUES (?, ?)').bind(task.id, type).run()
    }
  } catch (e) { console.error(e) }
}