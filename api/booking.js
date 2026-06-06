// api/booking.js
// 負責：接收預約表單 → 寫入 Supabase → 寄確認信給客人

const { createClient } = require('@supabase/supabase-js');
const nodemailer = require('nodemailer');

// ── Supabase 連線 ──────────────────────────────────────────
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// ── Gmail 寄件設定 ─────────────────────────────────────────
function createTransporter() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,      // 你的 Gmail 信箱
      pass: process.env.GMAIL_APP_PASS,  // Gmail 應用程式密碼（非登入密碼）
    },
  });
}

// ── 確認信 HTML 模板 ───────────────────────────────────────
function buildEmailHTML({ name, date, time, timeEnd, phone, note }) {
  return `
<!DOCTYPE html>
<html lang="zh-Hant">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#F7F4EF;font-family:'Noto Sans TC',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:40px 16px;">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;border:1px solid rgba(0,0,0,0.08);">
        <!-- Header -->
        <tr>
          <td style="background:#1A1815;padding:28px 32px;text-align:center;">
            <p style="margin:0;font-size:20px;color:#D4B07A;letter-spacing:0.12em;font-weight:600;">光影人像工作室</p>
            <p style="margin:6px 0 0;font-size:11px;color:rgba(255,255,255,0.4);letter-spacing:0.15em;">PORTRAIT PHOTOGRAPHY STUDIO</p>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:32px;">
            <p style="margin:0 0 8px;font-size:18px;font-weight:600;color:#1A1815;">預約確認通知</p>
            <p style="margin:0 0 24px;font-size:14px;color:#8A8580;line-height:1.7;">
              親愛的 ${name} 您好，<br>
              感謝您預約光影人像工作室的拍攝服務。以下是您的預約詳情：
            </p>
            <!-- Detail box -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#F7F4EF;border-radius:12px;overflow:hidden;">
              ${detailRow('📅', '預約日期', date)}
              ${detailRow('⏰', '預約時段', `${time} – ${timeEnd}`)}
              ${detailRow('📞', '聯絡電話', phone)}
              ${note ? detailRow('📝', '拍攝需求', note) : ''}
              ${detailRow('💰', '訂金說明', '請於到場時以現金繳付，工作人員將協助確認')}
            </table>
            <!-- Note -->
            <p style="margin:24px 0 0;font-size:13px;color:#8A8580;line-height:1.8;border-top:1px solid rgba(0,0,0,0.07);padding-top:16px;">
              如需修改或取消預約，請提前 <strong>24 小時</strong>與我們聯絡。<br>
              期待與您見面，為您留下美好的影像！
            </p>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#F7F4EF;padding:16px 32px;text-align:center;border-top:1px solid rgba(0,0,0,0.07);">
            <p style="margin:0;font-size:11px;color:#8A8580;">光影人像工作室　｜　營業時間 週一至週六 09:00–17:00</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function detailRow(emoji, label, value) {
  return `
    <tr>
      <td style="padding:12px 16px;border-bottom:1px solid rgba(0,0,0,0.06);">
        <span style="font-size:12px;color:#8A8580;">${emoji} ${label}</span><br>
        <span style="font-size:14px;color:#1A1815;font-weight:500;">${value}</span>
      </td>
    </tr>`;
}

// ── 主要 API Handler ───────────────────────────────────────
module.exports = async function handler(req, res) {
  // CORS 設定（允許你的網頁呼叫此 API）
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { name, email, phone, note, date, time, timeEnd } = req.body;

    // 1. 驗證必填欄位
    if (!name || !email || !phone || !date || !time) {
      return res.status(400).json({ error: '缺少必填欄位' });
    }

    // 2. 檢查時段是否已被預約
    const { data: existing } = await supabase
      .from('bookings')
      .select('id')
      .eq('date', date)
      .eq('time', time)
      .eq('status', 'confirmed')
      .single();

    if (existing) {
      return res.status(409).json({ error: '此時段已被預約，請選擇其他時段' });
    }

    // 3. 寫入 Supabase
    const { data, error: dbError } = await supabase
      .from('bookings')
      .insert([{ name, email, phone, note, date, time, time_end: timeEnd, status: 'confirmed' }])
      .select()
      .single();

    if (dbError) throw dbError;

    // 4. 寄確認信給客人
    const transporter = createTransporter();
    await transporter.sendMail({
      from: `"光影人像工作室" <${process.env.GMAIL_USER}>`,
      to: email,
      subject: `【預約確認】${date} ${time} 人像拍攝`,
      html: buildEmailHTML({ name, date, time, timeEnd, phone, note }),
    });

    // 5. 寄通知信給工作室（可選）
    await transporter.sendMail({
      from: `"預約系統" <${process.env.GMAIL_USER}>`,
      to: process.env.GMAIL_USER,
      subject: `【新預約通知】${date} ${time}｜${name}`,
      html: buildEmailHTML({ name, date, time, timeEnd, phone, note }),
    });

    return res.status(200).json({ success: true, bookingId: data.id });

  } catch (err) {
    console.error('Booking error:', err);
    return res.status(500).json({ error: '系統錯誤，請稍後再試' });
  }
};
