// api/slots.js
// 負責：從 Supabase 查詢指定日期已被預約的時段，回傳給前端

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { date } = req.query;
  if (!date) return res.status(400).json({ error: '請提供日期參數' });

  try {
    const { data, error } = await supabase
      .from('bookings')
      .select('time')
      .eq('date', date)
      .eq('status', 'confirmed');

    if (error) throw error;

    const takenTimes = data.map(row => row.time);
    return res.status(200).json({ takenTimes });

  } catch (err) {
    console.error('Slots error:', err);
    return res.status(500).json({ error: '系統錯誤' });
  }
};
