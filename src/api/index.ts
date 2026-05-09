// src/api/index.ts
import { Hono } from 'hono';
import { cors } from 'hono/cors';

export type Bindings = {
    DB: D1Database;
    WAHA_URL: string;
    WAHA_API_KEY: string;
};

// EXPORT app agar bisa dibaca src/index.ts
export const app = new Hono<{ Bindings: Bindings }>().basePath('/api');

export const SESSION_NAME = 'gereja-bot';

app.use('/*', cors());

// EXPORT helper agar bisa digunakan di Cron
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

// --- Routes ---
app.get('/wa-status', async (c) => {
    const res = await wahaFetch(c.env, '/api/sessions?all=true');
    return c.json(await res.json());
});

app.post('/tasks', async (c) => {
    const { name, title, description, deadline, phone_number } = await c.req.json();
    await c.env.DB.prepare(
        'INSERT INTO tasks (name, title, description, deadline, phone_number) VALUES (?, ?, ?, ?, ?)'
    ).bind(name, title, description, deadline, phone_number).run();
    return c.json({ success: true });
});

app.get('/tasks', async (c) => {
    const { results } = await c.env.DB.prepare('SELECT * FROM tasks ORDER BY deadline ASC').all();
    return c.json(results);
});

app.delete('/tasks/:id', async (c) => {
    const id = c.req.param('id');
    await c.env.DB.prepare('DELETE FROM tasks WHERE id = ?').bind(id).run();
    return c.json({ success: true });
});