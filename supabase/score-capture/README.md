# Stream score proposal pilot

Server-side sampling runs with stream-live-check, independent of viewers. It NEVER writes official results. ChatGPT checks the candidate queue hourly and asks Corey to approve here. Only an explicit reply approving a specific candidate authorizes entering that result, after rechecking the current game and preserving existing result validation.

## Activation
Set OPENAI_API_KEY in Supabase Edge Function Secrets (never in chat or source). Set SCORE_CAPTURE_ENABLED=true to enable paid image analysis, or false to stop it. Without both, capture is inactive and the checker returns disabled or needs_api_key. Existing stream discovery remains functional.

## Sources and limits
Twitch uses its cached 1920x1080 preview. YouTube uses maxresdefault_live.jpg for the exact detected video ID, only when available. YouTube custom/static thumbnails are NOT reliable live frames: proposals require a different earlier preview classified in_progress for the same video in the previous day. This is a conservative pilot, not guaranteed video recording or VOD recovery. A briefly displayed final can be missed. YouTube must be verified against a live broadcast before claiming end-to-end success.

Main-game FINAL/postgame evidence is required. A 0:00 clock alone, unrelated ticker finals, ties, ambiguous league/week matches, and already completed games are rejected. Home/away comes from the schedule. Overtime can remain unknown for review. Candidates retain captured JPEG evidence. Scans are capped at four coaches per run, 96 per coach per UTC day, deduplicated in five-minute buckets. No secret is returned by the detector.

A real negative example: Saif's Kansas 24–West Virginia 14 at 4th quarter 7:36 appeared above a ticker saying Bowling Green 24–Kent State 16 FINAL. Neither is valid evidence of the current game's final.
