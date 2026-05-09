import { app, wahaFetch, SESSION_NAME, type Bindings } from './api';
// @ts-ignore
import astroHandler from '../dist/_worker.js/index.js';

export default {
    // A. FETCH HANDLER: Hono + Astro
    async fetch(request: Request, env: Bindings, ctx: ExecutionContext) {
        const url = new URL(request.url);
        if (url.pathname.startsWith('/api')) {
            return app.fetch(request, env, ctx);
        }
        return astroHandler.fetch(request, env, ctx);
    },

    // B. SCHEDULED HANDLER (PRODUCER): Mendeteksi task & masukkan ke antrean
    async scheduled(event: ScheduledEvent, env: Bindings, ctx: ExecutionContext) {
        const now = new Date();
        const nowIso = now.toISOString();

        try {
            // 1. Mark Finished untuk task yang terlewat
            await env.DB.prepare(
                'UPDATE tasks SET status = "Finished" WHERE deadline < ? AND status = "pending"'
            ).bind(nowIso).run();

            // 2. Ambil task yang masih pending
            const { results: tasks } = await env.DB.prepare('SELECT * FROM tasks WHERE status = "pending"').all();

            for (const task of (tasks as any[])) {
                const deadline = new Date(task.deadline).getTime();
                const diffHours = (deadline - now.getTime()) / (1000 * 60 * 60);
                const hourWib = (now.getUTCHours() + 7) % 24;
                const minWib = now.getUTCMinutes();

                let reminderType = "";
                if (diffHours <= 24 && diffHours > 23.9) reminderType = '24h';
                else if (hourWib === 7 && minWib === 0) {
                    const today = new Date(now.getTime() + 7 * 3600000).toISOString().split('T')[0];
                    const taskDay = new Date(deadline + 7 * 3600000).toISOString().split('T')[0];
                    if (today === taskDay) reminderType = '7am';
                }
                else if (diffHours <= 1 && diffHours > 0.9 && hourWib !== 7) reminderType = '1h';

                if (reminderType) {
                    // Cek apakah sudah pernah dikirim
                    const existing = await env.DB.prepare('SELECT id FROM reminders WHERE task_id = ? AND type = ?')
                        .bind(task.id, reminderType).first();

                    if (!existing) {
                        // Masukkan ke Queue (PRODUCER)
                        await env.REMINDER_QUEUE.send({ task, reminderType });
                        console.log(`Pushed to Queue: ${task.title} (${reminderType})`);
                    }
                }
            }
        } catch (e) { console.error('Cron Error:', e); }
    },

    // C. QUEUE HANDLER (CONSUMER): Melakukan pengiriman nyata
    async queue(batch: MessageBatch<any>, env: Bindings, ctx: ExecutionContext) {
        for (const message of batch.messages) {
            const { task, reminderType } = message.body;

            const msg = `Halo *${task.name}*! 👋\n\n` +
                `Pengingat *${reminderType}* untuk:\n📌 *${task.title}*\n` +
                `⏰ Deadline: ${task.deadline}`;

            try {
                const res = await wahaFetch(env, '/api/sendText', {
                    method: 'POST',
                    body: JSON.stringify({ chatId: `${task.phone_number}@c.us`, text: msg, session: SESSION_NAME })
                });

                if (res.ok) {
                    // Catat sukses di D1
                    await env.DB.prepare('INSERT INTO reminders (task_id, type) VALUES (?, ?)')
                        .bind(task.id, reminderType).run();
                    message.ack(); // Hapus dari antrean
                } else {
                    // Trigger retry otomatis oleh Cloudflare
                    throw new Error(`WAHA error: ${res.status}`);
                }
            } catch (err) {
                console.error('Queue Consumer Error:', err);
                // Jangan ack(), maka Cloudflare akan mencoba ulang sesuai max_retries
            }
        }
    }
};