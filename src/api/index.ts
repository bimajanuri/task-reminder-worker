import { Hono } from 'hono'

type Bindings = {
  DB: D1Database
  WAHA_URL: string
  WAHA_API_KEY: string // API Key untuk autentikasi ke WAHA
}

const app = new Hono<{ Bindings: Bindings }>()

// Helper untuk fetch ke WAHA dengan Auth
const wahaFetch = (env: Bindings, path: string, options: RequestInit = {}) => {
  const url = `${env.WAHA_URL}${path}`
  const headers = {
    ...options.headers,
    'X-Api-Key': env.WAHA_API_KEY, // Header Auth WAHA
    'Content-Type': 'application/json',
  }
  return fetch(url, { ...options, headers })
}

// API Routes
app.get('/', (c) => c.text('Task Reminder API Running'))

// 1. Cek Status Semua Session (Akan mengembalikan Array seperti yang Anda harapkan)
app.get('/api/wa-status', async (c) => {
  try {
    const response = await wahaFetch(c.env, '/api/sessions?all=true') // Gunakan /api/sessions untuk mendapatkan array
    const data = await response.json()
    return c.json(data)
  } catch (error) {
    return c.json({ error: 'Failed to fetch WAHA status' }, 500)
  }
})

// 2. Start Session (Gunakan nama session 'gereja-bot' atau sesuaikan)
app.post('/api/wa-login', async (c) => {
  const sessionName = 'gereja-bot' // Sesuaikan dengan nama session Anda
  try {
    // Pastikan session sudah start/exist sebelum minta QR
    const response = await wahaFetch(c.env, `/api/sessions/${sessionName}/start`)
    if (response.status === 404) {
      return c.json({ error: `Session ${sessionName} belum dibuat atau sedang offline.` }, 404)
    }
    const data = await response.json()
    return c.json(data)
  } catch (error) {
    return c.json({ error: 'Failed to Start' }, 500)
  }
})

// 3. Logout / Stop Session
app.delete('/api/wa-logout', async (c) => {
  const sessionName = 'gereja-bot'
  try {
    const response = await wahaFetch(c.env, `/api/sessions/${sessionName}/stop`, {
      method: 'POST'
    })
    const data = await response.json()
    return c.json(data)
  } catch (error) {
    return c.json({ error: 'Failed to logout WAHA' }, 500)
  }
})

// --- Task Management ---

// Simpan Task Baru
app.post('/api/tasks', async (c) => {
  const { name, title, description, deadline, phone_number } = await c.req.json()

  const result = await c.env.DB.prepare(
    'INSERT INTO tasks (name, title, description, deadline, phone_number) VALUES (?, ?, ?, ?, ?)'
  ).bind(name, title, description, deadline, phone_number).run()

  return c.json({ success: true, result })
})

// List Semua Task
app.get('/api/tasks', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT * FROM tasks ORDER BY deadline ASC').all()
  return c.json(results)
})

export default {
  fetch: app.fetch,
  async scheduled(event: ScheduledEvent, env: Bindings, ctx: ExecutionContext) {
    console.log('Cron Trigger Running:', new Date().toISOString())
    // Jalankan sync status dan pengecekan reminder
    ctx.waitUntil(syncSessionStatus(env))
    ctx.waitUntil(handleReminders(env))
  }
}

// --- Background Logic ---

async function syncSessionStatus(env: Bindings) {
  try {
    const response = await wahaFetch(env, '/api/sessions/default')
    const data = await response.json() as any
    await env.DB.prepare(
      'INSERT INTO wa_sessions (session_id, status, last_check) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(session_id) DO UPDATE SET status = EXCLUDED.status, last_check = EXCLUDED.last_check'
    ).bind('default', data.status || 'UNKNOWN').run()
  } catch (error) {
    console.error('Failed to sync session status', error)
  }
}

async function handleReminders(env: Bindings) {
  const now = new Date()
  const nowUtc = now.getTime()

  // Ambil task yang belum selesai
  const { results: tasks } = await env.DB.prepare('SELECT * FROM tasks WHERE status = "pending"').all()

  for (const task of (tasks as any[])) {
    const deadlineDate = new Date(task.deadline)
    const deadlineUtc = deadlineDate.getTime()
    const diffMs = deadlineUtc - nowUtc
    const diffHours = diffMs / (1000 * 60 * 60)

    const hourWib = (now.getUTCHours() + 7) % 24
    const minWib = now.getUTCMinutes()

    // 1. Logic T-24h
    if (diffHours <= 24 && diffHours > 23) {
      await sendReminder(env, task, '24h')
    }

    // 2. Logic 7 AM WIB (Hari H)
    if (hourWib === 7 && minWib === 0) {
      const todayWib = new Date(nowUtc + (7 * 60 * 60 * 1000)).toISOString().split('T')[0]
      const taskDayWib = new Date(deadlineUtc + (7 * 60 * 60 * 1000)).toISOString().split('T')[0]

      if (todayWib === taskDayWib) {
        await sendReminder(env, task, '7am')
      }
    }

    // 3. Logic T-1h (Jangan kirim jika sedang jam 7 pagi)
    if (diffHours <= 1 && diffHours > 0) {
      if (hourWib !== 7) {
        await sendReminder(env, task, '1h')
      }
    }
  }
}

// --- Manual Test Sending ---

// --- Manual Test Sending with Database Update ---

app.post('/api/tasks/:id/test-send', async (c) => {
  const id = c.req.param('id')
  const sessionName = 'gereja-bot'

  try {
    // 1. Ambil data task dari D1
    const task = await c.env.DB.prepare(
      'SELECT * FROM tasks WHERE id = ?'
    ).bind(id).first() as any

    if (!task) {
      return c.json({ error: 'Task not found' }, 404)
    }

    // 2. Susun pesan
    const message =
      `🧪 *TEST KIRIM MANUAL*\n\n` +
      `Halo *${task.name}*!\n` +
      `Pesan uji coba untuk tugas:\n` +
      `📌 *${task.title}*\n\n` +
      `📝 Deskripsi: ${task.description || '-'}\n` +
      `⏰ Deadline: ${task.deadline}`

    // 3. Kirim ke WAHA
    const res = await wahaFetch(c.env, '/api/sendText', {
      method: 'POST',
      body: JSON.stringify({
        chatId: `${task.phone_number}@c.us`,
        text: message,
        session: sessionName
      })
    })

    const result = await res.json()

    // 4. Jika pengiriman berhasil, update database
    if (res.ok) {
      // Kita gunakan batch untuk menjalankan dua perintah sekaligus agar efisien
      await c.env.DB.batch([
        // Update status task menjadi 'sent' atau 'tested'
        c.env.DB.prepare(
          'UPDATE tasks SET status = ? WHERE id = ?'
        ).bind('tested', id),

        // Catat di tabel reminders bahwa pengiriman manual telah dilakukan
        c.env.DB.prepare(
          'INSERT INTO reminders (task_id, type, sent_at) VALUES (?, ?, CURRENT_TIMESTAMP)'
        ).bind(id, 'manual_test')
      ])

      return c.json({
        success: true,
        message: `Pesan berhasil dikirim dan database telah diperbarui.`,
        task_id: id,
        new_status: 'tested'
      })
    } else {
      return c.json({
        success: false,
        error: 'WAHA gagal mengirim pesan',
        details: result
      }, res.status)
    }

  } catch (error: any) {
    console.error('Error during test-send:', error)
    return c.json({ error: 'Internal Server Error', details: error.message }, 500)
  }
})

async function sendReminder(env: Bindings, task: any, type: string) {
  // Cek apakah reminder tipe ini sudah dikirim untuk task tersebut
  const existing = await env.DB.prepare(
    'SELECT id FROM reminders WHERE task_id = ? AND type = ?'
  ).bind(task.id, type).first()

  if (existing) return

  // Susun Pesan Personal
  const message =
    `Halo *${task.name}*! 👋\n\n` +
    `Ini adalah pengingat *${type === '24h' ? 'H-1' : type === '7am' ? 'Pagi ini' : '1 Jam lagi'}* untuk tugas Anda:\n` +
    `📌 *${task.title}*\n\n` +
    `📝 Deskripsi:\n${task.description || '-'}\n\n` +
    `⏰ Deadline: ${task.deadline}\n\n` +
    `Mohon segera diselesaikan ya!`

  try {
    const res = await wahaFetch(env, '/api/sendText', {
      method: 'POST',
      body: JSON.stringify({
        chatId: `${task.phone_number}@c.us`,
        text: message,
        session: 'default'
      })
    })

    if (res.ok) {
      await env.DB.prepare(
        'INSERT INTO reminders (task_id, type) VALUES (?, ?)'
      ).bind(task.id, type).run()
      console.log(`Reminder ${type} sent to ${task.name}`)
    }
  } catch (error) {
    console.error(`Failed to send ${type} message to ${task.phone_number}`, error)
  }
}