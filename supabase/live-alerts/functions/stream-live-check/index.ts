// Saturday Foundry — stream live checker (Supabase Edge Function, Deno)
//
// Deploy as the function `stream-live-check` (see ../SETUP.md). It reads the
// league's stream channels from the v_stream_channels view, probes each one,
// and upserts coach_live_status. On a false→true transition it stamps
// started_at; the app (10.1.41+) reads v_coach_live and lights up THE LINE
// ticker, the Watch badges and the game-card LIVE chips on its own.
//
// Detection:
//   Twitch  — official Helix API (needs TWITCH_CLIENT_ID / TWITCH_CLIENT_SECRET
//             function secrets; skipped silently when unset).
//   YouTube — no API key: fetches the channel's /live page and looks for the
//             live-broadcast marker YouTube embeds in it. Best-effort by
//             nature; if YouTube changes the page, Twitch keeps working and
//             the manual SQL flip in migration.sql still works.
//
// Secrets provided automatically by Supabase: SUPABASE_URL,
// SUPABASE_SERVICE_ROLE_KEY. No other setup is required to deploy.

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const TWITCH_ID = Deno.env.get('TWITCH_CLIENT_ID') || '';
const TWITCH_SECRET = Deno.env.get('TWITCH_CLIENT_SECRET') || '';

const rest = (path: string, init: RequestInit = {}) =>
  fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });

function youtubeLiveUrl(url: string): string {
  try {
    const u = new URL(url);
    const channel = u.pathname.match(/\/channel\/(UC[\w-]+)/);
    if (channel) return `https://www.youtube.com/channel/${channel[1]}/live`;
    const handle = u.pathname.match(/\/(@[\w.-]+)/);
    if (handle) return `https://www.youtube.com/${handle[1]}/live`;
    return url.replace(/\/?$/, '/live');
  } catch {
    return url;
  }
}

async function youtubeIsLive(url: string): Promise<{ live: boolean; title?: string; url?: string }> {
  try {
    const res = await fetch(youtubeLiveUrl(url), {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SaturdayFoundry/1.0)' },
      redirect: 'follow',
    });
    if (!res.ok) return { live: false };
    const html = await res.text();
    // YouTube serves two page variants for /live. The full watch page carries
    // ytInitialPlayerResponse (liveBroadcastDetails.isLiveNow, an itemprop
    // meta flag, videoDetails with "isLive":true) plus a canonical watch URL.
    // The app-shell variant (what this function usually receives) carries
    // NONE of those: its canonical href is literally "undefined", there is no
    // player response, and its data is embedded with escaped quotes — but the
    // broadcast is identified there by currentVideoEndpoint and titled by
    // playerOverlayVideoDetailsRenderer. Detection and extraction therefore
    // run against both the raw page and an unescaped copy (esc).
    // Verified 2026-11-01 against Corey's live "UCONN" broadcast via the
    // function's own ?debug probes (builds diag3/diag4): in the shell
    // variant the ONLY correct id was currentVideoEndpoint's; the first
    // watchEndpoint in the page was a related video.
    const esc = html.replace(/\\"/g, '"');
    const live = (html.includes('"isLiveNow":true') || html.includes('itemprop="isLiveBroadcast" content="True"') || esc.includes('"isLive":true') || (esc.includes('"liveIndicatorText":{"simpleText":"Live"}') && esc.includes('watching now'))) && !esc.includes('"isUpcoming":true');
    if (!live) return { live: false };
    let vid = html.match(/rel="canonical" href="https:\/\/www\.youtube\.com\/watch\?v=([\w-]{11})"/)?.[1] || html.match(/"videoDetails":\{"videoId":"([\w-]{11})"/)?.[1];
    if (!vid) {
      const ci = esc.indexOf('"currentVideoEndpoint"');
      if (ci >= 0) {
        const seg = esc.slice(ci, ci + 1500);
        vid = seg.match(/"watchEndpoint":\{"videoId":"([\w-]{11})"/)?.[1] || seg.match(/"url":"\/watch\?v=([\w-]{11})"/)?.[1];
      }
    }
    if (!vid) vid = esc.match(/"videoDetails":\{"videoId":"([\w-]{11})"/)?.[1] || html.match(/"videoId":"([\w-]{11})"/)?.[1];
    const title = html.match(/"videoDetails":\{"videoId":"[\w-]{11}","title":"([^"]{3,120})"/)?.[1] || esc.match(/"videoDetails":\{"videoId":"[\w-]{11}","title":"([^"]{3,120})"/)?.[1] || esc.match(/"playerOverlayVideoDetailsRenderer":\{"title":\{"simpleText":"([^"]{3,120})"/)?.[1] || html.match(/"title":"([^"]{3,120})","lengthSeconds/)?.[1] || html.match(/property="og:title" content="([^"]{3,120})"/)?.[1];
    return { live: true, title, url: vid ? `https://www.youtube.com/watch?v=${vid}` : undefined };
  } catch {
    return { live: false };
  }
}

function twitchLogin(url: string): string | null {
  try {
    const seg = new URL(url).pathname.split('/').filter(Boolean)[0];
    return seg ? seg.toLowerCase() : null;
  } catch {
    return null;
  }
}

async function twitchLiveSet(logins: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!logins.length || !TWITCH_ID || !TWITCH_SECRET) return out;
  try {
    const tokenRes = await fetch('https://id.twitch.tv/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: TWITCH_ID,
        client_secret: TWITCH_SECRET,
        grant_type: 'client_credentials',
      }),
    });
    if (!tokenRes.ok) return out;
    const { access_token } = await tokenRes.json();
    const qs = logins.map(l => `user_login=${encodeURIComponent(l)}`).join('&');
    const res = await fetch(`https://api.twitch.tv/helix/streams?${qs}`, {
      headers: { 'Client-Id': TWITCH_ID, Authorization: `Bearer ${access_token}` },
    });
    if (!res.ok) return out;
    const body = await res.json();
    for (const s of body.data || []) out.set(String(s.user_login).toLowerCase(), s.title);
  } catch { /* Twitch is best-effort; YouTube and manual flips still work. */ }
  return out;
}

Deno.serve(async () => {
  const channelsRes = await rest('v_stream_channels?select=dynasty_id,person_id,platform,stream_url');
  if (!channelsRes.ok) {
    return Response.json(
      { ok: false, step: 'read v_stream_channels', status: channelsRes.status },
      { status: 500 },
    );
  }
  const channels = await channelsRes.json();

  const logins = channels
    .filter((c: any) => String(c.platform).toLowerCase() === 'twitch')
    .map((c: any) => twitchLogin(c.stream_url))
    .filter(Boolean) as string[];
  const twitch = await twitchLiveSet(logins);

  const results: Record<string, unknown>[] = [];
  for (const c of channels) {
    const platform = String(c.platform || '').toLowerCase();
    let probe = { live: false, title: undefined as string | undefined, url: undefined as string | undefined };
    if (platform === 'youtube') probe = await youtubeIsLive(c.stream_url);
    else if (platform === 'twitch') {
      const login = twitchLogin(c.stream_url);
      if (login && twitch.has(login)) probe = { live: true, title: twitch.get(login) };
    } else continue;

    const prevRes = await rest(
      `coach_live_status?dynasty_id=eq.${c.dynasty_id}&person_id=eq.${c.person_id}&select=is_live,live_title,live_url,started_at`,
    );
    const prev = prevRes.ok ? (await prevRes.json())[0] : null;
    const wasLive = !!prev?.is_live;

    const row: Record<string, unknown> = {
      dynasty_id: c.dynasty_id,
      person_id: c.person_id,
      is_live: probe.live,
      live_title: probe.live ? (probe.title || null) : null,
      live_url: probe.live ? (probe.url || c.stream_url) : null,
      updated_at: new Date().toISOString(),
    };
    if (probe.live && !wasLive) row.started_at = new Date().toISOString();
    if (!probe.live) row.started_at = null;
    // Stream just ended: keep the finished broadcast as the coach's most
    // recent one (Watch tab recents/replay). Otherwise last_* stays as-is.
    if (!probe.live && wasLive && prev?.live_url) {
      row.last_title = prev.live_title ?? null;
      row.last_url = prev.live_url;
      row.last_started_at = prev.started_at ?? null;
      row.last_ended_at = new Date().toISOString();
    }

    const up = await rest('coach_live_status?on_conflict=dynasty_id,person_id', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(row),
    });
    results.push({ person_id: c.person_id, platform, live: probe.live, transition: wasLive !== probe.live, stored: up.ok });
  }

  return Response.json({ ok: true, checked: channels.length, results });
});
