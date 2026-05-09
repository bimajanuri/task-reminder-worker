// src/index.ts
import { app, wahaFetch, SESSION_NAME, type Bindings } from './api';

// Perbaikan Import: Gunakan default import untuk astroHandler
// @ts-ignore
import astroHandler from '../dist/_worker.js/index.js';

export default {
    async fetch(request: Request, env: Bindings, ctx: ExecutionContext) {
        const url = new URL(request.url);

        // API Route
        if (url.pathname.startsWith('/api')) {
            return app.fetch(request, env, ctx);
        }

        // Astro Frontend Route
        // Panggil astroHandler secara langsung jika itu adalah default export
        return astroHandler.fetch(request, env, ctx);
    },

    async scheduled(event: ScheduledEvent, env: Bindings, ctx: ExecutionContext) {
        ctx.waitUntil(handleAutoReminders(env));
    }
};

async function handleAutoReminders(env: Bindings) {
    const now = new Date();
    const { results: tasks } = await env.DB.prepare('SELECT * FROM tasks WHERE status = "pending"').all();

    for (const task of (tasks as any[])) {
        const deadline = new Date(task.deadline).getTime();
        const diffHours = (deadline - now.getTime()) / (1000 * 60 * 60);
        const hourWib = (now.getUTCHours() + 7) % 24;

        if (diffHours <= 24 && diffHours > 23.9) await sendMsg(env, task, '24h');
        if (hourWib === 7 && now.getUTCMinutes() === 0) await sendMsg(env, task, '7am');
        if (diffHours <= 1 && diffHours > 0.9 && hourWib !== 7) await sendMsg(env, task, '1h');
    }
}

async function sendMsg(env: Bindings, task: any, type: string) {
    const msg = `Halo *${task.name}*!\nReminder *${type}*: *${task.title}*`;
    try {
        const res = await wahaFetch(env, '/api/sendText', {
            method: 'POST',
            body: JSON.stringify({ chatId: `${task.phone_number}@c.us`, text: msg, session: SESSION_NAME })
        });
        if (res.ok) {
            await env.DB.prepare('INSERT INTO reminders (task_id, type) VALUES (?, ?)').bind(task.id, type).run();
        }
    } catch (e) { console.error(e); }
}