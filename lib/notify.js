import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendTelegram(text) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!token || !chatId) {
        console.warn('Telegram not configured');
        return;
    }

    try {
        const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text,
                parse_mode: 'HTML',
                disable_web_page_preview: false
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

    if (!from || !to) {
        console.warn('Email not configured');
        return;
    }

    try {
        await resend.emails.send({ from, to, subject, html });
    } catch (e) {
        console.error('Email send failed:', e);
    }
}

export async function notifyNewBooking(b) {
    const svcNames = {
        standard: 'Standard cleaning',
        deep: 'Deep cleaning',
        reno: 'After renovation',
        upholstery: 'Upholstery cleaning'
    };

    const tgText =
        `🧹 <b>Новая заявка!</b>

👤 <b>${b.name}</b>
📞 <a href="tel:${b.phone}">${b.phone}</a>

🏠 ${b.addr}${b.map_link ? `\n📍 <a href="${b.map_link}">Google Maps</a>` : ''}

🛠 ${svcNames[b.service] || b.service}${b.size && b.size !== '—' ? ` · ${b.size}` : ''}
📅 ${b.booking_date} · ${b.booking_time}
${b.notes ? `\n📝 ${b.notes}` : ''}
${b.promo_code ? `🏷 Промо: ${b.promo_code}` : ''}

💰 <b>€${b.total}</b>`;

    const emailHtml = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
      <h2 style="color:#117559">Новая заявка на уборку</h2>
      <table style="width:100%;border-collapse:collapse">
        <tr><td style="padding:8px;border-bottom:1px solid #eee"><b>Имя:</b></td><td style="padding:8px;border-bottom:1px solid #eee">${b.name}</td></tr>
        <tr><td style="padding:8px;border-bottom:1px solid #eee"><b>Телефон:</b></td><td style="padding:8px;border-bottom:1px solid #eee"><a href="tel:${b.phone}">${b.phone}</a></td></tr>
        <tr><td style="padding:8px;border-bottom:1px solid #eee"><b>Адрес:</b></td><td style="padding:8px;border-bottom:1px solid #eee">${b.addr}</td></tr>
        ${b.map_link ? `<tr><td style="padding:8px;border-bottom:1px solid #eee"><b>Карта:</b></td><td style="padding:8px;border-bottom:1px solid #eee"><a href="${b.map_link}">Open in Google Maps</a></td></tr>` : ''}
        <tr><td style="padding:8px;border-bottom:1px solid #eee"><b>Услуга:</b></td><td style="padding:8px;border-bottom:1px solid #eee">${svcNames[b.service] || b.service}${b.size && b.size !== '—' ? ` (${b.size})` : ''}</td></tr>
        <tr><td style="padding:8px;border-bottom:1px solid #eee"><b>Когда:</b></td><td style="padding:8px;border-bottom:1px solid #eee">${b.booking_date} в ${b.booking_time}</td></tr>
        ${b.notes ? `<tr><td style="padding:8px;border-bottom:1px solid #eee"><b>Комментарий:</b></td><td style="padding:8px;border-bottom:1px solid #eee">${b.notes}</td></tr>` : ''}
        ${b.promo_code ? `<tr><td style="padding:8px;border-bottom:1px solid #eee"><b>Промокод:</b></td><td style="padding:8px;border-bottom:1px solid #eee">${b.promo_code}</td></tr>` : ''}
        <tr><td style="padding:8px;font-size:18px"><b>Итого:</b></td><td style="padding:8px;font-size:18px;color:#117559"><b>€${b.total}</b></td></tr>
      </table>
    </div>
  `;

    await Promise.all([
        sendTelegram(tgText),
        sendEmail(`🧹 Новая заявка: ${b.name}`, emailHtml)
    ]);
}