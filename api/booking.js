// api/booking.js
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { name, email, phone, note, date, time, timeEnd } = req.body;

    if (!name || !email || !phone || !date || !time) {
      return res.status(400).json({ error: '缺少必填欄位' });
    }

    // 檢查時段是否已被預約
    const { data: existing } = await supabase
      .from('bookings')
      .select('id')
      .eq('date', date)
      .eq('time', time)
      .eq('status', 'confirmed')
      .maybeSingle();

    if (existing) {
      return res.status(409).json({ error: '此時段已被預約，請選擇其他時段' });
    }

    // 寫入 Supabase
    const { data, error: dbError } = await supabase
      .from('bookings')
      .insert([{ name, email, phone, note, date, time, time_end: timeEnd, status: 'confirmed' }])
      .select()
      .single();

    if (dbError) throw dbError;

    return res.status(200).json({ success: true, bookingId: data.id });

  } catch (err) {
    console.error('Booking error:', err);
    return res.status(500).json({ error: '系統錯誤，請稍後再試' });
  }
};
