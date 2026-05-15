import { sql } from '../lib/db.js';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ALLOWED_IDS = (process.env.TELEGRAM_ALLOWED_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
const SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;

const SVC_NAMES = {
    standard: 'Standard cleaning',
    deep: 'Deep cleaning',
    reno: 'After renovation',
    upholstery: 'Upholstery cleaning'
};
const SIZE_NAMES = {
    studio: 'Studio',
    '1br': '1-bedroom',
    '2br': '2-bedroom',
    '3br': '3-bedroom',
    '4br': '4-bedroom'
};
const STATUS_NAMES = {
    new: '🆕 New',
    confirmed: '✅ Confirmed',
    done: '✓✓ Done',
    cancelled: '❌ Cancelled'
};

async function tg(method, body) {
    const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    return r.json();
}

function formatDate(d, time) {
    const date = new Date(d);
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${date.getUTCDate()} ${months[date.getUTCMonth()]} ${time}`;
}

function bookingText(b) {
    const dateStr = formatDate(b.booking_date, b.booking_time);
    const svc = SVC_NAMES[b.service] || b.service;
    const size = b.size && b.size !== '—' ? `, ${SIZE_NAMES[b.size] || b.size}` : '';
    const addr = b.map_link ? `<a href="${b.map_link}">${b.addr}</a>` : b.addr;
    let extras = '';
    if (b.service !== 'upholstery' && b.extras) {
        const items = Object.entries(b.extras).filter(([_, q]) => q > 0).map(([k, q]) => `${k} ×${q}`);
        if (items.length) extras = ` + ${items.join(', ')}`;
    }
    if (b.service === 'upholstery' && b.uph_items) {
        const items = Object.entries(b.uph_items).filter(([_, q]) => q > 0).map(([k, q]) => `${k} ×${q}`);
        if (items.length) extras = `: ${items.join(', ')}`;
    }
    return `🧹 <b>Booking #${b.id}</b>  ·  ${STATUS_NAMES[b.status] || b.status}

<b>Name:</b> ${b.name}
<b>Phone:</b> <a href="tel:${b.phone}">${b.phone}</a>
<b>Address:</b> ${addr}
<b>Service:</b> ${svc}${size}${extras}
<b>Date:</b> ${dateStr}
${b.notes ? `<b>Notes:</b> ${b.notes}\n` : ''}${b.promo_code ? `<b>Promo:</b> ${b.promo_code}\n` : ''}<b>Price:</b> €${b.total}`;
}

function bookingKeyboard(b) {
    const rows = [];
    if (b.status === 'new') {
        rows.push([
            { text: '✅ Confirm', callback_data: `confirm:${b.id}` },
            { text: '❌ Cancel', callback_data: `cancel:${b.id}` }
        ]);
    }
    if (b.status === 'confirmed') {
        rows.push([
            { text: '✓✓ Mark Done', callback_data: `done:${b.id}` },
            { text: '❌ Cancel', callback_data: `cancel:${b.id}` }
        ]);
    }
    if (b.status === 'done' || b.status === 'cancelled') {
        rows.push([
            { text: '↩️ Reopen', callback_data: `reopen:${b.id}` }
        ]);
    }
    rows.push([
        { text: '🗑 Delete', callback_data: `delconfirm:${b.id}` }
    ]);
    return { inline_keyboard: rows };
}

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();

    if (SECRET) {
        const got = req.headers['x-telegram-bot-api-secret-token'];
        if (got !== SECRET) return res.status(401).end();
    }

    const update = req.body || {};

    try {
        if (update.message) {
            await handleMessage(update.message);
        } else if (update.callback_query) {
            await handleCallback(update.callback_query);
        }
    } catch (e) {
        console.error('Webhook handler failed:', e);
    }

    return res.status(200).json({ ok: true });
}

function isAllowed(userId) {
    return ALLOWED_IDS.includes(String(userId));
}

async function handleMessage(msg) {
    const userId = msg.from?.id;
    const chatId = msg.chat?.id;
    const text = (msg.text || '').trim();

    if (!isAllowed(userId)) {
        await tg('sendMessage', { chat_id: chatId, text: '⛔ You are not authorized to use this bot.' });
        return;
    }

    if (text === '/start' || text === '/help') {
        await tg('sendMessage', {
            chat_id: chatId,
            text: `👋 <b>clean.agency admin bot</b>

Commands:
/today — bookings for today
/tomorrow — bookings for tomorrow
/week — bookings for the next 7 days
/pending — all new bookings awaiting confirmation
/stats — month statistics
/help — this message

You can also press buttons under any booking notification to manage it.`,
            parse_mode: 'HTML'
        });
        return;
    }

    if (text === '/today' || text === '/tomorrow' || text === '/week' || text === '/pending') {
        await listBookings(chatId, text);
        return;
    }

    if (text === '/stats') {
        await sendStats(chatId);
        return;
    }

    await tg('sendMessage', {
        chat_id: chatId,
        text: '❓ Unknown command. Send /help to see what I can do.'
    });
}

async function listBookings(chatId, cmd) {
    const today = new Date().toISOString().split('T')[0];
    const tmrw = new Date(); tmrw.setDate(tmrw.getDate() + 1);
    const tmrwStr = tmrw.toISOString().split('T')[0];
    const weekEnd = new Date(); weekEnd.setDate(weekEnd.getDate() + 7);
    const weekEndStr = weekEnd.toISOString().split('T')[0];

    let rows;
    let title;
    if (cmd === '/today') {
        rows = await sql`SELECT * FROM bookings WHERE booking_date = ${today} AND status != 'cancelled' ORDER BY booking_time`;
        title = `📅 Today (${today})`;
    } else if (cmd === '/tomorrow') {
        rows = await sql`SELECT * FROM bookings WHERE booking_date = ${tmrwStr} AND status != 'cancelled' ORDER BY booking_time`;
        title = `📅 Tomorrow (${tmrwStr})`;
    } else if (cmd === '/week') {
        rows = await sql`SELECT * FROM bookings WHERE booking_date BETWEEN ${today} AND ${weekEndStr} AND status != 'cancelled' ORDER BY booking_date, booking_time`;
        title = `📅 Next 7 days`;
    } else {
        rows = await sql`SELECT * FROM bookings WHERE status = 'new' ORDER BY booking_date, booking_time LIMIT 20`;
        title = `🆕 Pending bookings`;
    }

    if (!rows.length) {
        await tg('sendMessage', { chat_id: chatId, text: `${title}\n\n<i>No bookings.</i>`, parse_mode: 'HTML' });
        return;
    }

    await tg('sendMessage', { chat_id: chatId, text: `${title}\n<i>${rows.length} booking(s)</i>`, parse_mode: 'HTML' });

    for (const b of rows) {
        await tg('sendMessage', {
            chat_id: chatId,
            text: bookingText(b),
            parse_mode: 'HTML',
            reply_markup: bookingKeyboard(b),
            disable_web_page_preview: true
        });
    }
}

async function sendStats(chatId) {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

    const rows = await sql`
    SELECT
      COUNT(*)::int as total,
      COUNT(*) FILTER (WHERE status = 'new')::int as new_cnt,
      COUNT(*) FILTER (WHERE status = 'confirmed')::int as confirmed_cnt,
      COUNT(*) FILTER (WHERE status = 'done')::int as done_cnt,
      COUNT(*) FILTER (WHERE status = 'cancelled')::int as cancelled_cnt,
      COALESCE(SUM(total) FILTER (WHERE status != 'cancelled'), 0)::int as revenue
    FROM bookings
    WHERE booking_date BETWEEN ${firstDay} AND ${lastDay}
  `;
    const s = rows[0];

    const monthName = now.toLocaleString('en', { month: 'long', year: 'numeric' });
    await tg('sendMessage', {
        chat_id: chatId,
        text: `📊 <b>Stats for ${monthName}</b>

<b>Total bookings:</b> ${s.total}
🆕 New: ${s.new_cnt}
✅ Confirmed: ${s.confirmed_cnt}
✓✓ Done: ${s.done_cnt}
❌ Cancelled: ${s.cancelled_cnt}

💰 <b>Revenue (excl. cancelled):</b> €${s.revenue}`,
        parse_mode: 'HTML'
    });
}

async function handleCallback(cb) {
    const userId = cb.from?.id;
    const chatId = cb.message?.chat?.id;
    const messageId = cb.message?.message_id;
    const data = cb.data || '';

    if (!isAllowed(userId)) {
        await tg('answerCallbackQuery', { callback_query_id: cb.id, text: '⛔ Not authorized', show_alert: true });
        return;
    }

    const [action, idStr, sub] = data.split(':');
    const id = parseInt(idStr);
    if (!id) return;

    if (action === 'delconfirm') {
        await tg('editMessageReplyMarkup', {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: {
                inline_keyboard: [[
                    { text: '⚠️ Yes, delete', callback_data: `del:${id}` },
                    { text: '↩️ Keep', callback_data: `back:${id}` }
                ]]
            }
        });
        await tg('answerCallbackQuery', { callback_query_id: cb.id, text: 'Confirm deletion?' });
        return;
    }

    if (action === 'del') {
        await sql`DELETE FROM bookings WHERE id = ${id}`;
        await tg('editMessageText', {
            chat_id: chatId,
            message_id: messageId,
            text: `🗑 <b>Booking #${id} deleted</b>`,
            parse_mode: 'HTML'
        });
        await tg('answerCallbackQuery', { callback_query_id: cb.id, text: '🗑 Deleted' });
        return;
    }

    if (action === 'back') {
        const rows = await sql`SELECT * FROM bookings WHERE id = ${id} LIMIT 1`;
        const b = rows[0];
        if (!b) {
            await tg('answerCallbackQuery', { callback_query_id: cb.id, text: 'Booking not found' });
            return;
        }
        await tg('editMessageText', {
            chat_id: chatId,
            message_id: messageId,
            text: bookingText(b),
            parse_mode: 'HTML',
            reply_markup: bookingKeyboard(b),
            disable_web_page_preview: true
        });
        await tg('answerCallbackQuery', { callback_query_id: cb.id });
        return;
    }

    let newStatus = null;
    if (action === 'confirm') newStatus = 'confirmed';
    else if (action === 'done') newStatus = 'done';
    else if (action === 'cancel') newStatus = 'cancelled';
    else if (action === 'reopen') newStatus = 'new';

    if (!newStatus) {
        await tg('answerCallbackQuery', { callback_query_id: cb.id, text: 'Unknown action' });
        return;
    }

    await sql`UPDATE bookings SET status = ${newStatus} WHERE id = ${id}`;
    const rows = await sql`SELECT * FROM bookings WHERE id = ${id} LIMIT 1`;
    const b = rows[0];
    if (!b) {
        await tg('answerCallbackQuery', { callback_query_id: cb.id, text: 'Booking not found' });
        return;
    }

    await tg('editMessageText', {
        chat_id: chatId,
        message_id: messageId,
        text: bookingText(b),
        parse_mode: 'HTML',
        reply_markup: bookingKeyboard(b),
        disable_web_page_preview: true
    });
    await tg('answerCallbackQuery', { callback_query_id: cb.id, text: `→ ${STATUS_NAMES[newStatus]}` });
}