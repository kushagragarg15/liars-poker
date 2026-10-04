// Hands out TURN relay credentials so players on different networks can connect.
// Configure ONE provider in the Vercel project's environment variables:
//   Metered:    METERED_APP (the "<app>" in <app>.metered.live) + METERED_API_KEY
//   Cloudflare: CF_TURN_KEY_ID + CF_TURN_API_TOKEN
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const { METERED_APP, METERED_API_KEY, CF_TURN_KEY_ID, CF_TURN_API_TOKEN } = process.env;
    let iceServers = null;
    if (METERED_APP && METERED_API_KEY) {
      const r = await fetch(`https://${METERED_APP}.metered.live/api/v1/turn/credentials?apiKey=${encodeURIComponent(METERED_API_KEY)}`);
      if (!r.ok) throw new Error('metered ' + r.status);
      iceServers = await r.json();
    } else if (CF_TURN_KEY_ID && CF_TURN_API_TOKEN) {
      const r = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${CF_TURN_KEY_ID}/credentials/generate-ice-servers`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${CF_TURN_API_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ttl: 86400 }),
      });
      if (!r.ok) throw new Error('cloudflare ' + r.status);
      const j = await r.json();
      iceServers = Array.isArray(j.iceServers) ? j.iceServers : [j.iceServers];
    }
    if (!iceServers) return res.status(404).json({ error: 'No TURN provider configured' });
    res.status(200).json({ iceServers });
  } catch (e) {
    res.status(502).json({ error: String(e.message || e) });
  }
};
