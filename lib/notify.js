import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

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

const EXTRA_NAMES = {
    balcony: 'Balcony',
    extrabath: 'Extra bathroom',
    window: 'Window',
    balcondoor: 'Balcony door',
    tray: 'Baking tray',
    oven: 'Oven',
    fridge: 'Fridge',
    microwave: 'Microwave',
    bedlinen: 'Bed linen change'
};

const UPH_NAMES = {
    sofa: 'Sofa',
    mattress: 'Mattress',
    armchair: 'Armchair',
    chair: 'Chair'
};

function formatDate(d, time) {
    const date = new Date(d);
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${date.getUTCDate()} ${months[date.getUTCMonth()]} ${time}`;
}

function formatService(b) {
    const svc = SVC_NAMES[b.service] || b.service;
    if (b.service === 'upholstery') {
        const items = Object.entries(b.uph_items || {})
            .filter(([_, q]) => q > 0)
            .map(([k, q]) => `${UPH_NAMES[k] || k} ×${q}`)
            .join(', ');
        return items ? `${svc}: ${items}` : svc;
    }
    const size = SIZE_NAMES[b.size] || b.size;
    const extras = Object.entries(b.extras || {})
        .filter(([_, q]) => q > 0)
        .map(([k, q]) => `${EXTRA_NAMES[k] || k} ×${q}`)
        .join(', ');
    let result = `${svc}, ${size}`;
    if (extras) result += ` + ${extras}`;
    return result;
}

export async function sendTelegram(text) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (!token || !chatId) return;
    try {
        const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text,
                parse_mode: 'HTML',
                disable_web_page_preview: true
            })
        });
        if (!r.ok) console.error('Telegram error:', await r.text());
    } catch (e) {
        console.error('Telegram fetch failed:', e);
    }
}

export async function sendEmail(subject, html) {
    const from = process.env.EMAIL_FROM;
    const to = process.env.EMAIL_TO;
    if (!from || !to) return;
    try {
        await resend.emails.send({ from, to, subject, html });
    } catch (e) {
        console.error('Email send failed:', e);
    }
}

export async function notifyNewBooking(b) {
    const dateStr = formatDate(b.booking_date, b.booking_time);
    const serviceStr = formatService(b);
    const addrLine = b.map_link
        ? `<a href="${b.map_link}">${b.addr}</a>`
        : b.addr;

    const tgText =
        `🧹 <b>New booking #${b.id}</b>

<b>Name:</b> ${b.name}
<b>Phone:</b> <a href="tel:${b.phone}">${b.phone}</a>
<b>Address:</b> ${addrLine}
<b>Service:</b> ${serviceStr}
<b>Date:</b> ${dateStr}
${b.notes ? `<b>Notes:</b> ${b.notes}\n` : ''}${b.promo_code ? `<b>Promo:</b> ${b.promo_code}\n` : ''}<b>Price:</b> €${b.total}`;

    const replyMarkup = {
        inline_keyboard: [
            [
                { text: '✅ Confirm', callback_data: `confirm:${b.id}` },
                { text: '❌ Cancel', callback_data: `cancel:${b.id}` }
            ],
            [
                { text: '🗑 Delete', callback_data: `delconfirm:${b.id}` }
            ]
        ]
    };

    const emailHtml = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px">
      <h2 style="color:#117559;margin:0 0 20px">🧹 New booking</h2>
      <table style="width:100%;border-collapse:collapse">
        <tr><td style="padding:10px 8px;border-bottom:1px solid #eee;width:140px"><strong>Name:</strong></td><td style="padding:10px 8px;border-bottom:1px solid #eee">${b.name}</td></tr>
        <tr><td style="padding:10px 8px;border-bottom:1px solid #eee"><strong>Phone:</strong></td><td style="padding:10px 8px;border-bottom:1px solid #eee"><a href="tel:${b.phone}" style="color:#117559;text-decoration:none">${b.phone}</a></td></tr>
        <tr><td style="padding:10px 8px;border-bottom:1px solid #eee"><strong>Address:</strong></td><td style="padding:10px 8px;border-bottom:1px solid #eee">${b.addr}${b.map_link ? ` &nbsp; <a href="${b.map_link}" style="color:#117559">📍 Open in Maps</a>` : ''}</td></tr>
        <tr><td style="padding:10px 8px;border-bottom:1px solid #eee"><strong>Service:</strong></td><td style="padding:10px 8px;border-bottom:1px solid #eee">${serviceStr}</td></tr>
        <tr><td style="padding:10px 8px;border-bottom:1px solid #eee"><strong>Date:</strong></td><td style="padding:10px 8px;border-bottom:1px solid #eee">${dateStr}</td></tr>
        ${b.notes ? `<tr><td style="padding:10px 8px;border-bottom:1px solid #eee"><strong>Notes:</strong></td><td style="padding:10px 8px;border-bottom:1px solid #eee">${b.notes}</td></tr>` : ''}
        ${b.promo_code ? `<tr><td style="padding:10px 8px;border-bottom:1px solid #eee"><strong>Promo:</strong></td><td style="padding:10px 8px;border-bottom:1px solid #eee">${b.promo_code}</td></tr>` : ''}
        <tr><td style="padding:14px 8px;font-size:18px"><strong>Price:</strong></td><td style="padding:14px 8px;font-size:20px;color:#117559"><strong>€${b.total}</strong></td></tr>
      </table>
    </div>
  `;

    await Promise.all([
        sendTelegram(tgText, replyMarkup).catch(e => console.error('Telegram failed:', e)),
        sendEmail(`New booking: ${b.name} · €${b.total}`, emailHtml).catch(e => console.error('Email failed:', e))
    ]);
}