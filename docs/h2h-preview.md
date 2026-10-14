# User vs user preview — 9.10.12

The preview adds a gold USER vs USER banner, both users' names, and a validation status to shared GameDay cards. My Week rows get the same badge. Pending opponent validations remain in an inbox after the active week advances. Disputed results appear in Commissioner.

One participant enters the shared final. Only the opposing participant can explicitly confirm or flag it. A matching duplicate save is idempotent and does not confirm the result; a different duplicate score cannot overwrite it. Confirmation checks the result version and canonical home/away scores. Disputes preserve the scoreboard. Commissioners resolve disputes with a note; edits invalidate earlier confirmation. Events retain actor, timestamps, and before/after state. Existing historical finals are labeled not validated rather than assigned a fabricated submitter.

## Preview QA

Open `h2h-qa.html` for an isolated interactive demo. Enter a score as Corey or Pete, switch to the opponent, and confirm or flag it. Switch to Commissioner to resolve a flag. Demo data exists only in this tab's memory and never writes league data.

Open `index.html` for the integrated app preview. New H2H submit/edit actions are blocked until the backend readiness endpoint exists. Existing CPU score entry remains unchanged. No production SQL has been applied.

## Release after explicit approval

1. Apply the staged `docs/h2h-validation.sql` transaction to the Supabase project, then verify the RPCs with participant and commissioner accounts.
2. Check Supabase security advisors for regressions. Internal ledger/events tables use RLS, have no client table grants, and sit in the private schema. Public RPCs revoke PUBLIC/anon execution and explicitly check auth.uid, dynasty membership, participant ownership or commissioner role. SECURITY DEFINER is required to update game records that the existing RLS restricts to commissioners; each mutation performs authorization before touching data.
3. Release the matching frontend and replace the preview badge with the approved production version.

The staged SQL was executed and tested against local PGlite PostgreSQL fixtures. Tests cover first submission, duplicate saves, opponent-only validation, stale versions, dispute preservation, edited-score invalidation, commissioner resolution, membership boundaries, anonymous RPC privileges, and serialized concurrent saves. This does not substitute for production verification after deployment. No schema migration history is changed during preview.
