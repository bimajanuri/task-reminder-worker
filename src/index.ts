import './polyfill';
import { Hono } from 'hono';
import api from './api';

// Import Astro handler hasil build. 
// Menggunakan @ts-ignore agar tidak error di editor/local (saat folder dist belum ter-generate)
// @ts-ignore
import astroApp from '../dist/_worker.js/index.js';

// Tambahkan WAHA_API_KEY ke dalam Bindings
const app = new Hono<{ Bindings: { DB: D1Database, WAHA_URL: string, WAHA_API_KEY: string } }>();

// Mount API routes
app.route('/api', api);

// Export worker
export default {
    // Untuk HTTP Requests (Frontend & API)
    async fetch(request: Request, env: any, ctx: ExecutionContext) {
        const url = new URL(request.url);

        // 1. Jika request menuju '/api', tangani dengan Hono API
        if (url.pathname.startsWith('/api')) {
            return app.fetch(request, env, ctx);
        }

        // 2. Fallback ke Astro SSR untuk me-render halaman web (UI)
        return astroApp.fetch(request, env, ctx);
    },

    // Untuk CRON Jobs (Logika Reminder Otomatis)
    // Tambahkan WAHA_API_KEY di parameter env
    async scheduled(event: ScheduledEvent, env: { DB: D1Database, WAHA_URL: string, WAHA_API_KEY: string }, ctx: ExecutionContext) {
        console.log("Menjalankan pengecekan task otomatis...");

        // Fallback URL WAHA & Ambil API Key
        const wahaUrl = env.WAHA_URL || 'http://localhost:3000';
        const apiKey = env.WAHA_API_KEY || ''; // Mengambil API Key dari environment variables

        // Helper: Fungsi untuk mengirimkan WA
        const sendWhatsappReminder = async (task: any, reminderType: string) => {
            let phoneNumber = task.phone_number.trim();
            if (phoneNumber.startsWith('0')) {
                phoneNumber = '62' + phoneNumber.substring(1);
            }
            const chatId = `${phoneNumber}@c.us`;

            let prefix = "";
            if (reminderType === "1st") prefix = "[Reminder H-1]";
            else if (reminderType === "2nd") prefix = "[Reminder Pagi Hari]";
            else if (reminderType === "3rd") prefix = "[Reminder 1 Jam Terakhir]";

            const textMessage = `Halo ${task.name},\n\n${prefix} Ini adalah pengingat otomatis untuk pekerjaan Anda:\n*${task.title}*\n\nTenggat Waktu: ${task.deadline}\nDeskripsi: ${task.description || '-'}\n\nTerima kasih.`;

            try {
                const response = await fetch(`${wahaUrl}/api/sendText`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                        'X-Api-Key': apiKey, // Menambahkan API Key di sini
                        'Authorization': `Bearer ${apiKey}` // Opsi fallback tambahan
                    },
                    body: JSON.stringify({
                        chatId: chatId,
                        text: textMessage,
                        session: 'default'
                    })
                });

                if (!response.ok) {
                    console.error(`Gagal kirim WA untuk Task ${task.id}:`, await response.text());
                } else {
                    console.log(`WA terkirim untuk Task ${task.id} (${reminderType})`);
                }
            } catch (error) {
                console.error(`Error memanggil WAHA untuk Task ${task.id}:`, error);
            }
        };

        // 1. Apabila deadline sudah lewat -> CLOSED
        await env.DB.prepare(`
      UPDATE tasks 
      SET status = 'Closed' 
      WHERE deadline < datetime('now') AND status != 'Finished' AND status != 'Closed'
    `).run();

        // 2. Reminder 1: 24 jam sebelum deadline -> SEND 1ST
        const tasks1st = await env.DB.prepare(`
      SELECT * FROM tasks 
      WHERE status = 'Pending' 
      AND deadline <= datetime('now', '+24 hours')
      AND deadline > datetime('now', '+12 hours')
    `).all();

        if (tasks1st.results) {
            for (const task of tasks1st.results) {
                await sendWhatsappReminder(task, "1st");
                await env.DB.prepare("UPDATE tasks SET status = 'Send 1st' WHERE id = ?").bind(task.id).run();
            }
        }

        // 3. Reminder 2: Pukul 7 pagi sebelum deadline -> SEND 2ND
        // 00 UTC = 07:00 WIB
        const tasks2nd = await env.DB.prepare(`
      SELECT * FROM tasks 
      WHERE status IN ('Pending', 'Send 1st')
      AND date(deadline) = date('now')
      AND strftime('%H', 'now') = '00' 
    `).all();

        if (tasks2nd.results) {
            for (const task of tasks2nd.results) {
                await sendWhatsappReminder(task, "2nd");
                await env.DB.prepare("UPDATE tasks SET status = 'Send 2nd' WHERE id = ?").bind(task.id).run();
            }
        }

        // 4. Reminder 3: 1 jam sebelum deadline -> FINISHED
        const tasks3rd = await env.DB.prepare(`
      SELECT * FROM tasks 
      WHERE status NOT IN ('Finished', 'Closed')
      AND deadline <= datetime('now', '+1 hour')
      AND deadline >= datetime('now')
    `).all();

        if (tasks3rd.results) {
            for (const task of tasks3rd.results) {
                await sendWhatsappReminder(task, "3rd");
                await env.DB.prepare("UPDATE tasks SET status = 'Finished' WHERE id = ?").bind(task.id).run();
            }
        }
    },

    // Tambahkan handler antrean (queue) ini agar Cloudflare tidak error
    async queue(batch: MessageBatch<any>, env: any): Promise<void> {
        console.log(`Memproses ${batch.messages.length} pesan dari antrean.`);

        for (const message of batch.messages) {
            try {
                console.log("Pesan diproses:", message.body);
                message.ack();
            } catch (error) {
                console.error("Gagal memproses pesan:", error);
                message.retry();
            }
        }
    }
};