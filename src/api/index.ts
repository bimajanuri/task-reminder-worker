import { Hono } from 'hono';
import { cors } from 'hono/cors';

export type Bindings = {
    DB: D1Database;
    WAHA_URL: string;
    WAHA_API_KEY: string;
    REMINDER_QUEUE: Queue; // Tambahkan binding queue
};

export const app = new Hono<{ Bindings: Bindings }>().basePath('/api');
export const SESSION_NAME = 'gereja-bot';

app.use('/*', cors());

// Helper Fetch WAHA
export const wahaFetch = (env: Bindings, path: string, options: RequestInit = {}) => {
    return fetch(`${env.WAHA_URL}${path}`, {
        ...options,
        headers: {
            ...options.headers,
            'X-Api-Key': env.WAHA_API_KEY,
            'Content-Type': 'application/json',
        }
    });
};

// --- API WAHA & TASKS (Fungsi sebelumnya dipertahankan penuh) ---
app.get('/wa-status', async (c) => {
    const res = await wahaFetch(c.env, '/api/sessions?all=true');
    return c.json(await res.json());
});

app.post('/wa-login', async (c) => {
    const res = await wahaFetch(c.env, `/api/sessions/${SESSION_NAME}/start`, { method: 'POST' });
    return c.json(await res.json());
});

app.get('/wa-qr', async (c) => {
    const res = await wahaFetch(c.env, `/api/sessions/${SESSION_NAME}/qr`);
    if (!res.ok) return c.json({ error: 'QR belum tersedia' }, 404);
    return new Response(await res.blob(), { headers: { 'Content-Type': 'image/png' } });
});

app.delete('/wa-logout', async (c) => {
    const res = await wahaFetch(c.env, `/api/sessions/${SESSION_NAME}/stop`, { method: 'POST' });
    return c.json(await res.json());
});

app.get('/tasks', async (c) => {
    const { results } = await c.env.DB.prepare('SELECT * FROM tasks ORDER BY deadline ASC').all();
    return c.json(results);
});

app.post('/tasks', async (c) => {
    const { name, title, description, deadline, phone_number } = await c.req.json();
    await c.env.DB.prepare(
        'INSERT INTO tasks (name, title, description, deadline, phone_number) VALUES (?, ?, ?, ?, ?)'
    ).bind(name, title, description, deadline, phone_number).run();
    return c.json({ success: true });
});

app.delete('/tasks/:id', async (c) => {
    const id = c.req.param('id');
    await c.env.DB.prepare('DELETE FROM tasks WHERE id = ?').bind(id).run();
    return c.json({ success: true });
});

// Test Send Manual (Langsung kirim tanpa Queue agar respon cepat)
app.post('/tasks/:id/test-send', async (c) => {
    const id = c.req.param('id');
    const task = await c.env.DB.prepare('SELECT * FROM tasks WHERE id = ?').bind(id).first() as any;
    if (!task) return c.json({ error: 'Task not found' }, 404);

    const message = `🧪 *TEST MANUAL*\nHalo *${task.name}*!\nReminder: *${task.title}*`;
    const res = await wahaFetch(c.env, '/api/sendText', {
        method: 'POST',
        body: JSON.stringify({ chatId: `${task.phone_number}@c.us`, text: message, session: SESSION_NAME })
    });

    if (res.ok) {
        await c.env.DB.batch([
            c.env.DB.prepare('UPDATE tasks SET status = "tested" WHERE id = ?').bind(id),
            c.env.DB.prepare('INSERT INTO reminders (task_id, type) VALUES (?, ?)')
                .bind(id, 'manual_test') // Perbaikan: Parameter binding cocok
        ]);
        return c.json({ success: true, message: 'Sent' });
    }
    return c.json({ error: 'Gagal WAHA' }, 400);
});