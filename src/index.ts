import { Hono } from 'hono';
import { cors } from 'hono/cors';
// @ts-ignore - File ini baru tersedia setelah perintah 'npm run build' (astro build) dijalankan
import { handler as astroHandler } from '../dist/server/entry.mjs';

type Bindings = {
    DB: D1Database;
    WAHA_URL: string;
    WAHA_API_KEY: string;
};

const app = new Hono<{ Bindings: Bindings }>();

// Konfigurasi Session WAHA
const SESSION_NAME = 'gereja-bot';

// Middleware CORS agar dashboard bisa memanggil API jika diakses dari domain berbeda
app.use('/api/*', cors());

// Helper untuk fetch ke WAHA dengan Autentikasi
const wahaFetch = (env: Bindings, path: string, options: RequestInit = {}) => {
    const url = `${env.WAHA_URL}${path}`;
    const headers = {
        ...options.headers,
        'X-Api-Key': env.WAHA_API_KEY,
        'Content-Type': 'application/json',
    };
    return fetch(url, { ...options, headers });
};

// --- API ROUTES (Hono) ---

// 1. Cek Status Semua Session
app.get('/api/wa-status', async (c) => {
    try {
        const response = await wahaFetch(c.env, '/api/sessions?all=true');
        const data = await response.json();
        return c.json(data);
    } catch (error) {
        return c.json({ error: 'Gagal mengambil status WAHA' }, 500);
    }
});

// 2. Start Session (POST)
app.post('/api/wa-login', async (c) => {
    try {
        const response = await wahaFetch(c.env, `/api/sessions/${SESSION_NAME}/start`, {
            method: 'POST'
        });
        const data = await response.json();
        return c.json(data);
    } catch (error) {
        return c.json({ error: 'Gagal memulai session' }, 500);
    }
});

// 3. Ambil Gambar QR (GET)
app.get('/api/wa-qr', async (c) => {
    try {
        const response = await wahaFetch(c.env, `/api/sessions/${SESSION_NAME}/qr`);
        if (!response.ok) return c.json({ error: 'QR tidak tersedia. Jalankan wa-login dahulu.' }, 404);

        const blob = await response.blob();
        return new Response(blob, {
            headers: { 'Content-Type': 'image/png' }
        });
    } catch (error) {
        return c.json({ error: 'Gagal mengambil QR Code' }, 500);
    }
});

// 4. Logout / Stop Session
app.delete('/api/wa-logout', async (c) => {
    try {
        const response = await wahaFetch(c.env, `/api/sessions/${SESSION_NAME}/stop`, {
            method: 'POST'
        });
        const data = await response.json();
        return c.json(data);
    } catch (error) {
        return c.json({ error: 'Gagal logout' }, 500);
    }
});

// --- TASK MANAGEMENT ---

app.post('/api/tasks', async (c) => {
    const { name, title, description, deadline, phone_number } = await c.req.json();
    const result = await c.env.DB.prepare(
        'INSERT INTO tasks (name, title, description, deadline, phone_number) VALUES (?, ?, ?, ?, ?)'
    ).bind(name, title, description, deadline, phone_number).run();
    return c.json({ success: true, result });
});

app.get('/api/tasks', async (c) => {
    const { results } = await c.env.DB.prepare('SELECT * FROM tasks ORDER BY deadline ASC').all();
    return c.json(results);
});

app.delete('/api/tasks/:id', async (c) => {
    const id = c.req.param('id');
    try {
        await c.env.DB.prepare('DELETE FROM tasks WHERE id = ?').bind(id).run();
        return c.json({ success: true, message: 'Tugas berhasil dihapus' });
    } catch (error) {
        return c.json({ error: 'Gagal menghapus tugas' }, 500);
    }
});

app.post('/api/tasks/:id/test-send', async (c) => {
    const id = c.req.param('id');
    try {
        const task = await c.env.DB.prepare('SELECT * FROM tasks WHERE id = ?').bind(id).first() as any;
        if (!task) return c.json({ error: 'Tugas tidak ditemukan' }, 404);

        const message = `🧪 *TEST MANUAL*\n\nHalo *${task.name}*!\nPengingat untuk: *${task.title}*\nDeadline: ${task.deadline}`;

        const res = await wahaFetch(c.env, '/api/sendText', {
            method: 'POST',
            body: JSON.stringify({
                chatId: `${task.phone_number}@c.us`,
                text: message,
                session: SESSION_NAME
            })
        });

        if (res.ok) {
            await c.env.DB.batch([
                c.env.DB.prepare('UPDATE tasks SET status = ? WHERE id = ?').bind('tested', id),
                c.env.DB.prepare('INSERT INTO reminders (task_id, type) VALUES (?, ?)').bind(id, 'manual_test')
            ]);
            return c.json({ success: true, message: 'Pesan terkirim & DB diperbarui' });
        }
        return c.json({ error: 'WAHA menolak permintaan' }, 400);
    } catch (error) {
        return c.json({ error: 'Internal Server Error' }, 500);
    }
});

// --- ASTRO FALLBACK ---
// Semua request yang tidak diawali /api akan ditangani oleh Astro
app.all('*', (c) => {
    return astroHandler(c.req.raw, {
        env: c.env,
        executionCtx: c.executionCtx,
    });
});

// --- WORKER EXPORT ---

export default {
    fetch: app.fetch,

    // Handler untuk Cron Trigger
    async scheduled(event: any, env: Bindings, ctx: ExecutionContext) {
        console.log('Cron Trigger Berjalan:', new Date().toISOString());
        ctx.waitUntil(syncSessionStatus(env));
        ctx.waitUntil(handleReminders(env));
    }
};

// --- LOGIC BACKGROUND ---

async function syncSessionStatus(env: Bindings) {
    try {
        const response = await wahaFetch(env, `/api/sessions/${SESSION_NAME}`);
        if (response.ok) {
            const data = await response.json() as any;
            await env.DB.prepare(
                'INSERT INTO wa_sessions (session_id, status) VALUES (?, ?) ON CONFLICT(session_id) DO UPDATE SET status = EXCLUDED.status'
            ).bind(SESSION_NAME, data.status).run();
        }
    } catch (e) { console.error('Gagal sinkronisasi status:', e); }
}

async function handleReminders(env: Bindings) {
    const now = new Date();
    const nowUtc = now.getTime();
    const { results: tasks } = await env.DB.prepare('SELECT * FROM tasks WHERE status = "pending"').all();

    for (const task of (tasks as any[])) {
        const deadlineUtc = new Date(task.deadline).getTime();
        const diffHours = (deadlineUtc - nowUtc) / (1000 * 60 * 60);
        const hourWib = (now.getUTCHours() + 7) % 24;
        const minWib = now.getUTCMinutes();

        // 1. T-24h
        if (diffHours <= 24 && diffHours > 23.9) {
            await sendReminder(env, task, '24h');
        }

        // 2. Jam 7 Pagi WIB Hari H
        if (hourWib === 7 && minWib === 0) {
            const today = new Date(nowUtc + 7 * 3600000).toISOString().split('T')[0];
            const taskDay = new Date(deadlineUtc + 7 * 3600000).toISOString().split('T')[0];
            if (today === taskDay) await sendReminder(env, task, '7am');
        }

        // 3. T-1h (Lewati jika sedang jam 7 pagi)
        if (diffHours <= 1 && diffHours > 0.9 && hourWib !== 7) {
            await sendReminder(env, task, '1h');
        }
    }
}

async function sendReminder(env: Bindings, task: any, type: string) {
    const existing = await env.DB.prepare('SELECT id FROM reminders WHERE task_id = ? AND type = ?').bind(task.id, type).first();
    if (existing) return;

    const message = `Halo *${task.name}*! 👋\n\n` +
        `Ini pengingat *${type === '24h' ? 'H-1' : type === '7am' ? 'Pagi ini' : '1 jam lagi'}* untuk tugas:\n` +
        `📌 *${task.title}*\n\n` +
        `📝 Detail: ${task.description || '-'}\n` +
        `⏰ Deadline: ${task.deadline}`;

    try {
        const res = await wahaFetch(env, '/api/sendText', {
            method: 'POST',
            body: JSON.stringify({
                chatId: `${task.phone_number}@c.us`,
                text: message,
                session: SESSION_NAME
            })
        });
        if (res.ok) {
            await env.DB.prepare('INSERT INTO reminders (task_id, type) VALUES (?, ?)').bind(task.id, type).run();
        }
    } catch (e) { console.error(`Gagal mengirim reminder ${type}:`, e); }
}