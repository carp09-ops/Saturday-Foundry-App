import { runCapture } from '../../../score-capture/runner.mjs';
// Saturday Foundry — stream live checker (Supabase Edge Function, Deno)
//
// Deploy as the function `stream-live-check` (see ../SETUP.md). It reads the
// league's stream channels from the v_stream_channels view, probes each
// coach's channel once, and upserts coach_live_status per dynasty. A stream
// counts as live only in the leagues whose active-season team the stream
// title names (coaches put their team name in the title); if the title names
// none of the coach's teams it falls back to all of their leagues. On a
// false→true transition it stamps started_at; the app (10.1.41+) reads
// v_coach_live and lights up THE LINE ticker, the Watch badges and the
// game-card LIVE chips on its own.
//
// Detection:
//   Twitch  — official Helix API (needs TWITCH_CLIENT_ID / TWITCH_SECRET
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
const TWITCH_SECRET = Deno.env.get('TWITCH_SECRET') || '';

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

// League matching (2026-11-02): coaches name their team in the stream title,
// and a stream should light up only in the league it belongs to. The title
// is matched against each of the coach's active-season teams (from
// v_stream_channels); the stream counts as live only in matching dynasties.
// If the title names none of the coach's teams, the stream falls back to
// showing in all of their leagues, exactly as before — a forgotten title
// never hides a stream.
const TEAM_ALIASES: Record<string, string[]> = {
  'FLORIDA': ['GATORS'], 'UCONN': ['HUSKIES'], 'WEST VIRGINIA': ['WVU', 'MOUNTAINEERS'],
  'KANSAS': ['JAYHAWKS'], 'GEORGIA TECH': ['YELLOW JACKETS'], 'ARMY': ['BLACK KNIGHTS'],
  'MISSOURI': ['MIZZOU'], 'NORTH CAROLINA': ['TAR HEELS'], 'CALIFORNIA': ['GOLDEN BEARS'],
  'APPALACHIAN STATE': ['APP STATE'], 'OREGON STATE': ['BEAVERS'], 'TEXAS STATE': ['BOBCATS'],
  'OHIO': ['BOBCATS'], 'UTEP': ['MINERS'], 'PURDUE': ['BOILERMAKERS'],
  'RUTGERS': ['SCARLET KNIGHTS'], 'ARIZONA STATE': ['SUN DEVILS'], 'NC STATE': ['WOLFPACK'],
  'TEXAS TECH': ['RED RAIDERS'], 'NORTH DAKOTA STATE': ['BISON'], 'DELAWARE': ['BLUE HENS'],
  'KENNESAW STATE': ['OWLS'],
};

function normTitleText(s: string): string {
  return ' ' + String(s || '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').replace(/\s+/g, ' ').trim() + ' ';
}

function titleMatchesTeam(title: string | undefined, teamName?: string, abbr?: string, slug?: string): boolean {
  const t = normTitleText(title || '');
  if (!t.trim()) return false;
  const cands = new Set<string>();
  if (teamName) {
    cands.add(teamName.toUpperCase());
    for (const a of TEAM_ALIASES[teamName.toUpperCase()] || []) cands.add(a);
  }
  if (abbr) cands.add(String(abbr).toUpperCase());
  if (slug) cands.add(String(slug).replace(/-/g, ' ').toUpperCase());
  for (const c of cands) {
    const n = normTitleText(c);
    if (n.trim() && t.includes(n)) return true;
  }
  return false;
}

Deno.serve(async () => {
  const channelsRes = await rest('v_stream_channels?select=dynasty_id,person_id,platform,stream_url,team_name,team_slug,abbreviation');
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
  // One probe per coach (their channel is the same in every league); the
  // per-dynasty rows then decide live-ness by title match.
  const byPerson = new Map<string, any[]>();
  for (const c of channels) {
    if (!byPerson.has(c.person_id)) byPerson.set(c.person_id, []);
    byPerson.get(c.person_id)!.push(c);
  }
  for (const [person_id, rows] of byPerson) {
    const first = rows[0];
    const platform = String(first.platform || '').toLowerCase();
    let probe = { live: false, title: undefined as string | undefined, url: undefined as string | undefined };
    if (platform === 'youtube') probe = await youtubeIsLive(first.stream_url);
    else if (platform === 'twitch') {
      const login = twitchLogin(first.stream_url);
      if (login && twitch.has(login)) probe = { live: true, title: twitch.get(login) };
    } else continue;

    const matched = probe.live
      ? rows.filter((c: any) => titleMatchesTeam(probe.title, c.team_name, c.abbreviation, c.team_slug))
      : [];
    // Title names one of the coach's teams -> live only there. Names none ->
    // fall back to every league (pre-2026-11-02 behavior).
    const liveDynasties = new Set(
      (matched.length ? matched : rows).map((c: any) => c.dynasty_id),
    );

    for (const c of rows) {
      const rowLive = probe.live && liveDynasties.has(c.dynasty_id);
      const prevRes = await rest(
        `coach_live_status?dynasty_id=eq.${c.dynasty_id}&person_id=eq.${c.person_id}&select=is_live,live_title,live_url,started_at`,
      );
      const prev = prevRes.ok ? (await prevRes.json())[0] : null;
      const wasLive = !!prev?.is_live;

      const row: Record<string, unknown> = {
        dynasty_id: c.dynasty_id,
        person_id: c.person_id,
        is_live: rowLive,
        live_title: rowLive ? (probe.title || null) : null,
        live_url: rowLive ? (probe.url || c.stream_url) : null,
        updated_at: new Date().toISOString(),
      };
      if (rowLive && !wasLive) row.started_at = new Date().toISOString();
      if (!rowLive) row.started_at = null;
      // Stream actually ended: keep the finished broadcast as the coach's
      // most recent one in the leagues it showed in (Watch tab recents).
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
      results.push({ person_id, platform, team: c.team_name || null, live: rowLive, matched: matched.length > 0, transition: wasLive !== rowLive, stored: up.ok });
    }
  }

  let score_capture;
  try { score_capture = await runCapture({rest,channels,key:Deno.env.get('OPENAI_API_KEY')||'',enabled:Deno.env.get('SCORE_CAPTURE_ENABLED')==='true'}); }
  catch { score_capture = {state:'error'}; }
  return Response.json({ ok: true, checked: channels.length, results, score_capture });
});
