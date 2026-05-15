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
const MAIN_MENU = {
    keyboard: [
        [{ text: '🆕 Pending' }, { text: '📅 Today' }],
        [{ text: '📅 Tomorrow' }, { text: '📅 Week' }],
        [{ text: '🔍 Find' }, { text: '🏷 Promos' }],
        [{ text: '🚫 Block slot' }, { text: '📊 Stats' }],
        [{ text: '❓ Help' }]
    ],
    resize_keyboard: true,
    is_persistent: true
};
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

    if (text === '/start' || text === '/help' || text === '❓ Help') {
        await tg('sendMessage', {
            chat_id: chatId,
            text: `👋 <b>clean.agency admin bot</b>

📅 <b>View bookings:</b>
- <b>Today</b> / <b>Tomorrow</b> / <b>Week</b>
- <b>Pending</b> — awaiting confirmation

🔍 <b>Find a booking:</b>
<code>/find Maria</code> — by name
<code>/find 357991</code> — by phone

🏷 <b>Manage promo codes:</b>
<code>/promos</code> — list all codes with usage
<code>/promo SUMMER25 25%</code> — create new, unlimited
<code>/promo VIP10 10 50</code> — €10 off, max 50 uses
<code>/delpromo SUMMER25</code> — delete by code

🚫 <b>Block a time slot:</b>
<code>/block 2026-05-20 14:00</code> — block slot
<code>/unblock 2026-05-20 14:00</code> — unblock

📊 <b>Stats</b> — month overview

Tip: press buttons under any booking notification to manage it directly.`,
            parse_mode: 'HTML',
            reply_markup: MAIN_MENU
        });
        return;
    }

    const buttonMap = {
        '📅 Today': '/today',
        '📅 Tomorrow': '/tomorrow',
        '📅 Week': '/week',
        '🆕 Pending': '/pending',
        '📊 Stats': '/stats',
        '🔍 Find': '/find',
        '🏷 Promos': '/promos',
        '🚫 Block slot': '/block'
    };
    const normalized = buttonMap[text] || text;

    if (normalized === '/today' || normalized === '/tomorrow' || normalized === '/week' || normalized === '/pending') {
        await listBookings(chatId, normalized);
        return;
    }

    if (normalized === '/stats') {
        await sendStats(chatId);
        return;
    }

    if (normalized.startsWith('/find')) {
        const query = normalized.slice(5).trim();
        await findBookings(chatId, query);
        return;
    }

    if (normalized === '/promos') {
        await listPromos(chatId);
        return;
    }

    if (normalized.startsWith('/delpromo')) {
        const code = normalized.slice(9).trim();
        await deletePromoByCode(chatId, code);
        return;
    }

    if (normalized.startsWith('/promo')) {
        const args = normalized.slice(6).trim();
        await createPromo(chatId, args);
        return;
    }

    if (normalized.startsWith('/block') || normalized.startsWith('/unblock')) {
        const isBlock = normalized.startsWith('/block');
        const args = normalized.slice(isBlock ? 6 : 8).trim();
        await blockSlot(chatId, args, isBlock);
        return;
    }

    await tg('sendMessage', {
        chat_id: chatId,
        text: '❓ Unknown command. Tap a button or send /help.',
        reply_markup: MAIN_MENU
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
async function findBookings(chatId, query) {
    if (!query) {
        await tg('sendMessage', {
            chat_id: chatId,
            text: '🔍 <b>Find a booking</b>\n\nUsage:\n<code>/find Maria</code> — search by name\n<code>/find 357991</code> — search by phone',
            parse_mode: 'HTML'
        });
        return;
    }

    const q = '%' + query.toLowerCase() + '%';
    const rows = await sql`
        SELECT * FROM bookings
        WHERE LOWER(name) LIKE ${q} OR LOWER(phone) LIKE ${q}
        ORDER BY booking_date DESC, booking_time DESC
        LIMIT 20
    `;

    if (!rows.length) {
        await tg('sendMessage', {
            chat_id: chatId,
            text: `🔍 No bookings found for: <i>${query}</i>`,
            parse_mode: 'HTML'
        });
        return;
    }

    await tg('sendMessage', {
        chat_id: chatId,
        text: `🔍 <b>Found ${rows.length} booking(s)</b> for: <i>${query}</i>`,
        parse_mode: 'HTML'
    });

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

async function createPromo(chatId, args) {
    if (!args) {
        await tg('sendMessage', {
            chat_id: chatId,
            text: `🏷 <b>Create a promo code</b>

<b>Usage:</b>
<code>/promo CODE VALUE[%] [MAX_USES]</code>

📌 <b>Parameters:</b>
- <b>CODE</b> — name customers will type (e.g. SUMMER25)
- <b>VALUE</b> — discount: 25% (percent) or 10 (euros)
- <b>MAX_USES</b> — optional, how many times the code can be used. Skip or put 0 for unlimited.

<b>Examples:</b>
<code>/promo SUMMER25 25%</code>
   → 25% off, unlimited uses

<code>/promo SUMMER25 25% 100</code>
   → 25% off, first 100 customers only

<code>/promo VIP10 10 50</code>
   → €10 off, max 50 uses

<code>/promo WELCOME 5%</code>
   → 5% off, unlimited

After 1st value comes the discount. After 2nd value (optional) — uses limit.`,
            parse_mode: 'HTML'
        });
        return;
    }

    const parts = args.split(/\s+/);
    if (parts.length < 2) {
        await tg('sendMessage', {
            chat_id: chatId,
            text: '❌ Not enough arguments. Use <code>/promo</code> for help.',
            parse_mode: 'HTML'
        });
        return;
    }

    const code = parts[0].toUpperCase();
    const valueRaw = parts[1];
    const maxUses = parts[2] ? parseInt(parts[2]) : 0;

    let type, value;
    if (valueRaw.endsWith('%')) {
        type = 'percent';
        value = parseInt(valueRaw.slice(0, -1));
    } else {
        type = 'fixed';
        value = parseInt(valueRaw);
    }

    if (!code || !value || isNaN(value) || value <= 0) {
        await tg('sendMessage', {
            chat_id: chatId,
            text: '❌ Invalid arguments. Code and positive value required.',
            parse_mode: 'HTML'
        });
        return;
    }

    if (type === 'percent' && value > 100) {
        await tg('sendMessage', {
            chat_id: chatId,
            text: '❌ Percentage discount cannot exceed 100%.',
            parse_mode: 'HTML'
        });
        return;
    }

    try {
        await sql`
            INSERT INTO promo_codes (code, discount_type, discount_value, max_uses, used)
            VALUES (${code}, ${type}, ${value}, ${maxUses}, 0)
        `;

        const discountStr = type === 'percent' ? value + '%' : '€' + value;
        const usesStr = maxUses === 0 ? '∞ unlimited activations' : maxUses + ' activations';

        await tg('sendMessage', {
            chat_id: chatId,
            text: `✅ <b>Promo code created!</b>

<b>Code:</b> <code>${code}</code>
<b>Discount:</b> ${discountStr} off
<b>Activations:</b> ${usesStr}

Share it with customers — they enter it in the booking form on the website.`,
            parse_mode: 'HTML'
        });
    } catch (e) {
        if (String(e.message).includes('duplicate')) {
            await tg('sendMessage', {
                chat_id: chatId,
                text: `❌ Code <code>${code}</code> already exists. Use a different one.`,
                parse_mode: 'HTML'
            });
        } else {
            await tg('sendMessage', { chat_id: chatId, text: '❌ Failed to create promo: ' + e.message });
        }
    }
}
async function listPromos(chatId) {
    const rows = await sql`SELECT * FROM promo_codes ORDER BY created_at DESC`;

    if (!rows.length) {
        await tg('sendMessage', {
            chat_id: chatId,
            text: '🏷 <b>No promo codes yet.</b>\n\nUse <code>/promo CODE VALUE [MAX]</code> to create one.',
            parse_mode: 'HTML'
        });
        return;
    }

    await tg('sendMessage', {
        chat_id: chatId,
        text: `🏷 <b>Promo codes (${rows.length})</b>`,
        parse_mode: 'HTML'
    });

    for (const p of rows) {
        const discountStr = p.discount_type === 'percent' ? p.discount_value + '%' : '€' + p.discount_value;
        const usesStr = p.max_uses === 0 ? '∞ unlimited' : `${p.used} / ${p.max_uses}`;
        const isExpired = p.max_uses > 0 && p.used >= p.max_uses;
        const status = isExpired ? ' · ⛔ EXPIRED' : '';

        await tg('sendMessage', {
            chat_id: chatId,
            text: `<code>${p.code}</code>${status}

<b>Discount:</b> ${discountStr} off
<b>Used:</b> ${usesStr}`,
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [[
                    { text: '🗑 Delete', callback_data: `delpromo:${p.id}` }
                ]]
            }
        });
    }
}

async function deletePromoByCode(chatId, code) {
    if (!code) {
        await tg('sendMessage', {
            chat_id: chatId,
            text: '🗑 <b>Delete a promo code</b>\n\nUsage:\n<code>/delpromo CODE</code>\n\nExample:\n<code>/delpromo SUMMER25</code>\n\nOr use <code>/promos</code> to see all codes with Delete buttons.',
            parse_mode: 'HTML'
        });
        return;
    }

    const upperCode = code.toUpperCase();
    const result = await sql`DELETE FROM promo_codes WHERE code = ${upperCode} RETURNING id`;

    if (!result.length) {
        await tg('sendMessage', {
            chat_id: chatId,
            text: `❌ Promo code <code>${upperCode}</code> not found.`,
            parse_mode: 'HTML'
        });
        return;
    }

    await tg('sendMessage', {
        chat_id: chatId,
        text: `✅ Promo code <code>${upperCode}</code> deleted.`,
        parse_mode: 'HTML'
    });
}
async function blockSlot(chatId, args, isBlock) {
    if (!args) {
        await tg('sendMessage', {
            chat_id: chatId,
            text: `🚫 <b>Block / Unblock a time slot</b>

<b>Usage:</b>
<code>/block YYYY-MM-DD HH:MM</code> — block a slot
<code>/unblock YYYY-MM-DD HH:MM</code> — unblock

<b>Examples:</b>
<code>/block 2026-05-20 14:00</code>
<code>/unblock 2026-05-20 14:00</code>

Available times: 08:00 — 19:00 (hourly)`,
            parse_mode: 'HTML'
        });
        return;
    }

    const parts = args.split(/\s+/);
    if (parts.length < 2) {
        await tg('sendMessage', {
            chat_id: chatId,
            text: '❌ Need both date and time. Example: <code>/block 2026-05-20 14:00</code>',
            parse_mode: 'HTML'
        });
        return;
    }

    const date = parts[0];
    const time = parts[1];

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        await tg('sendMessage', {
            chat_id: chatId,
            text: '❌ Date must be in YYYY-MM-DD format. Example: 2026-05-20',
            parse_mode: 'HTML'
        });
        return;
    }

    if (!/^\d{2}:\d{2}$/.test(time)) {
        await tg('sendMessage', {
            chat_id: chatId,
            text: '❌ Time must be in HH:MM format. Example: 14:00',
            parse_mode: 'HTML'
        });
        return;
    }

    const existing = await sql`
        SELECT id FROM bookings 
        WHERE booking_date = ${date} AND booking_time = ${time} AND status != 'cancelled'
        LIMIT 1
    `;
    if (existing.length > 0 && isBlock) {
        await tg('sendMessage', {
            chat_id: chatId,
            text: `⚠️ This slot already has a booking (#${existing[0].id}). Cancel or delete it first.`,
            parse_mode: 'HTML'
        });
        return;
    }

    if (isBlock) {
        await sql`
            INSERT INTO blocked_slots (slot_date, slot_time)
            VALUES (${date}, ${time})
            ON CONFLICT (slot_date, slot_time) DO NOTHING
        `;
        await tg('sendMessage', {
            chat_id: chatId,
            text: `🚫 Slot <b>${date} ${time}</b> blocked. Customers won't be able to book it.`,
            parse_mode: 'HTML'
        });
    } else {
        const result = await sql`DELETE FROM blocked_slots WHERE slot_date = ${date} AND slot_time = ${time}`;
        await tg('sendMessage', {
            chat_id: chatId,
            text: `✅ Slot <b>${date} ${time}</b> unblocked. It's now available for booking.`,
            parse_mode: 'HTML'
        });
    }
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
    if (action === 'delpromo') {
        const promos = await sql`SELECT code FROM promo_codes WHERE id = ${id} LIMIT 1`;
        if (!promos.length) {
            await tg('answerCallbackQuery', { callback_query_id: cb.id, text: 'Promo not found' });
            return;
        }
        const code = promos[0].code;
        await sql`DELETE FROM promo_codes WHERE id = ${id}`;
        await tg('editMessageText', {
            chat_id: chatId,
            message_id: messageId,
            text: `🗑 <b>Promo code ${code} deleted</b>`,
            parse_mode: 'HTML'
        });
        await tg('answerCallbackQuery', { callback_query_id: cb.id, text: '🗑 Deleted' });
        return;
    }
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