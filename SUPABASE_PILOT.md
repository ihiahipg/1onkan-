# Supabase pilot data collection

## What this pilot stores

- A randomly generated participant code maps to one fixed A/B/C/D assignment. The database stores an HMAC of the code, not the code itself. Pilot-only records use the `pilot_participants` table so they cannot collide with any existing `participants` table.
- Every session records mode (`pretest`, `training`, `posttest`), assigned group, app version, and server start/end times.
- Every trial records reference/target/answer pitch (MIDI semitones), signed and absolute error, exact correctness, skip status, response time, baseline crossings, target crossings, first movement, first entry into the target's ±50-cent zone, snap count, maximum post-entry deviation, and a movement trace sampled at most every 100 ms (maximum 900 samples per question).
- `pilot_batch` separates the original four-group code set from the later A/D 10-person pilot. The A/D cohort has its own pepper secret and participant UUIDs; the original codes remain valid.
- The browser outbox stores failed trial uploads locally without storing the participant code. A participant must re-enter the same code to retry those uploads.
- No names, email addresses, or class rosters belong in this database. Keep any code-to-roster mapping separately under the school's control.

## Security design

The public GitHub Pages app contains only the Supabase Project URL and Publishable key. These are expected to be visible in browser code. The database tables have RLS enabled and direct browser grants revoked. The `pilot-data` Edge Function validates the high-entropy participant code, reads the assigned group, rejects a training URL for a different group, and writes via a server-only secret key. Never place a Supabase Secret/service-role key in `pilot-data-config.js` or any HTML/JS file.

The static site cannot stop a determined learner from editing their own browser code or sharing their participant code. For this small supervised pilot, give each learner one code, supervise the assigned links, and treat group/condition fidelity as a protocol item. This is not a fully authenticated production system.

## Supabase project setup

1. Create a separate Supabase project for this pilot. Do not reuse a personal or classroom production project. The later classroom deployment should use its own separate Supabase project and credentials. Keep the database password private.
2. Install the Supabase CLI. On macOS, use Homebrew or install the CLI as a project dependency; the current CLI also requires Node.js 20+ when run through `npx`.
3. From this repository, sign in and link the CLI to the new project (`supabase login`, then `supabase link`).
4. Apply the checked-in migration with `supabase db push --remote`. It creates only `pilot_participants`, `study_sessions`, and `study_trials`, with RLS enabled and browser grants revoked; any existing `participants` table is left untouched.
5. From this folder, run `python3 scripts/setup_pilot_codes.py`. It checks that this checkout is linked to the pilot project, creates a random pepper in memory, sends it to the Edge Function secrets store using a temporary mode-600 file outside the repository, deletes that file, and generates 10 participant codes using that same pepper. The pepper is never printed. Do not send it to Codex or put it in Git. To generate a different number, pass `--count N`.
6. Keep `pilot_codes_private.csv` private for distribution. `pilot_participants.sql` contains only HMAC hashes; run it once in the Supabase SQL Editor. Both output files are ignored by Git. The generator refuses to overwrite an existing code set.
7. Run the generated seed SQL once in the Supabase SQL Editor. Distribute codes privately; the generated groups are balanced as evenly as possible and randomized.
8. Deploy the function using `supabase functions deploy pilot-data`. Its `verify_jwt = false` setting is intentional because learners use participant codes rather than Supabase accounts; the function itself validates each code before database access.
9. Copy only the Project URL and Publishable key into `pilot-data-config.js`. Never use a Secret/service-role key there. Confirm the URL is the new pilot project.
10. Publish the app. Start with a small supervised dry run using one code per group. Verify one pretest, one training session at that code's group URL, and one posttest per code. Check the tables and export query before giving out the full pilot set.

## Add a separate A/D 5+5 pilot batch

The repository has an additive A/D batch workflow. It does not overwrite the original four-group pepper or existing participants.

1. Apply all pending migrations with `supabase db push --remote --dry-run`, review the listed migration, then run `supabase db push --remote`. Migration `202611090001_pilot_batches.sql` adds a batch label.
2. From this folder, run `python3 scripts/setup_ad_pilot_codes.py`. It sets a new Edge Function secret `PILOT_CODE_PEPPER_AD` without changing `PILOT_CODE_PEPPER`, then creates 10 codes balanced A=5/D=5 with random participant UUIDs. It refuses to overwrite outputs.
3. Keep `pilot_ad_codes_private.csv` and `pilot_ad_roster_crosswalk.csv` encrypted and outside GitHub. Fill in attendance numbers only in the local crosswalk under school-approved access controls. `pilot_ad_participants.sql` contains hashes, UUIDs, groups, and batch label but no participant codes or attendance numbers; run it once in the SQL Editor.
4. Deploy `supabase functions deploy pilot-data` so it checks the original and A/D pepper. Confirm old and new code validation in a dry run, then distribute only the corresponding A/D group link and code privately.
5. In SQL Editor, run `supabase/queries/verify_pilot_seed.sql` and `supabase/queries/pilot_export.sql`. Filter/report by `pilot_batch`; do not combine the old four-group and A/D cohorts in one estimate.

The A/D protocol draft and its pre-specified primary outcome are in `AD_PILOT_PROTOCOL_2026-11-09.md`.

## What to review before students use it

- The school/research lead must approve the participant explanation, consent process, retention period, and who can access the data. The app displays a plain-language summary but is not a substitute for that approval.
- The pre/post pages still draw their 10 target notes randomly. For score-change claims, replace this with fixed or psychometrically matched test forms before the main study; the pilot should first validate that the logging works.
- The database records a participant UUID, group, and trial history. This is pseudonymous study data, not anonymous data if the school keeps a code-to-student roster.
- For 10 learners split across four groups, treat results as feasibility and data-quality checks only; do not infer the groups' comparative effectiveness from that sample.

## Export and analysis

Run `supabase/queries/pilot_export.sql` in the Supabase SQL Editor and export both result sets to CSV. Keep the raw trial export unchanged. Work from a separate analysis copy; record the app version, exclusions, and derived-variable definitions. `reference_crossings` uses an 8-cent hysteresis threshold around the reference pitch; `target_crossings` uses the same threshold around the target pitch. Movement points are capped at 10 per second. The first target entry is defined as reaching within ±50 cents.

The repository intentionally contains no participant codes, pepper, or project Secret key. The browser Publishable key may be checked in only after RLS and the function are in place.
