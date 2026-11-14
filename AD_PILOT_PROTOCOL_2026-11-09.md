# A/D 10-person pilot: protocol draft

**Version:** 0.1
**Frozen on:** 2026-11-09 (Asia/Tokyo)
**Purpose:** feasibility, data-quality, and procedure pilot. This sample is not powered to establish educational effectiveness.

## Question and conditions

For learners using the relative-pitch slider, does the complete A condition (adaptive weak-interval practice, audible slider, and feedback) show a different pre-to-post change from the D condition (no adaptive weak-interval selection and no slider sound or feedback), under the same test and practice schedule?

This compares the **whole feature bundle**. With only A and D, any difference cannot be attributed to one feature separately.

## Participants and allocation

- Target: 10 learners, A=5 and D=5.
- Use the generated random allocation, with each code assigned to one learner and never shared. Do not swap codes after seeing scores.
- Record attendance number only in the local, access-restricted crosswalk. Supabase receives a random participant UUID and a high-entropy login code hash, not the attendance number or name.
- Before using student data, the school/research lead must approve the participant explanation, consent/assent process, use of student identifiers, retention, and access. Participation should not affect grades. Follow the school's rules for minors and research review.

## Procedure

1. **Pretest 1:** 10 questions; no slider sound or learning feedback.
2. **Pretest 2:** a second 10-question baseline on a separate occasion, before training. Use a different but matched form if available; otherwise document repeated-item exposure as a limitation.
3. **Training:** A or D page only. Keep the number of sessions, questions, time window, instructions, and device/headphone guidance equal between groups. Record attendance/session completion.
4. **Posttest:** 10 questions with the same no-slider-sound/no-feedback test condition as pretests. Ideally use a third matched form and a new reference-note sequence; record the exact targets and references.

Before the first participant, do one supervised dry run with a non-participant code and verify one pretest, both training and posttest flows, trial rows, and exports. Do not use that dry-run data as participant data.

## Confirmatory outcome and decision rule

- **One primary outcome:** each learner's mean absolute pitch error in semitones, averaged over valid non-skipped trials. Baseline is the mean of Pretest 1 and Pretest 2 participant-level means. Change is baseline mean absolute error minus posttest mean absolute error; positive values mean improvement.
- **Primary contrast:** mean change in A minus mean change in D, in semitones. Show each learner's value, each group's mean and standard deviation, the difference, and a participant-level 95% interval. With five learners per arm, intervals will be very wide; emphasize estimates and uncertainty, not a significance claim.
- **Interpretation:** this pilot checks whether the measure, data flow, and lesson procedure work and estimates plausible variability for a later sample-size calculation. Do not label a non-significant result as no effect, or a favorable point estimate as proven effectiveness.
- Do not claim a minimum detectable effect or a stable SESOI from this ten-person pilot. Use pilot variance to plan a larger, independently sized study; choose any educationally meaningful difference with a stated rationale before that study.

## Secondary and exploratory measures

Report these as descriptive/exploratory, with no multiple-comparison fishing:

- exact correctness, within-one-semitone correctness, signed error, and direction correctness;
- response time, first-movement time, time to first enter ±50 cents of target, target crossings, reference crossings, overshoot/deviation, snap count, and slider movement trace;
- practice-session learning curves by question/session, completion, upload failures, missing trials, and device/input type if collected consistently;
- target interval size/direction, reference pitch/register, and black-key status as exploratory item features.

Keep a raw export unchanged. Compute participant-level summaries from a separate analysis copy; retain skipped/missing rows and add exclusion flags with reasons rather than deleting data. Do not use the A group's adaptive practice items as the primary comparison test; adaptive selection makes those items non-comparable.

## Data checks and analysis record

Before analysis, report assigned/enrolled/completed counts by group; session and trial counts; duplicates; missingness; upload failures; out-of-range values; and every exclusion with a prewritten reason. Preserve the exact app version, protocol version, export date, query/script version, and changes from this protocol.

For this pilot, show participant-level pretest 1, pretest 2, and posttest points/lines, with group means and uncertainty. A later efficacy study should use a pre-specified model that accounts for repeated trials nested within learners and item difficulty, and should plan its sample size before recruitment.

## Privacy and security

- Do not put attendance numbers, names, or this crosswalk in GitHub, the public app, Supabase, or a shared analysis export.
- Keep `pilot_ad_roster_crosswalk.csv` encrypted and access-restricted under the school's control. It is a re-identification key; the study records are pseudonymous, not anonymous.
- Give each learner only their own code, privately. Keep a separate record of code distribution and consent status, under the school's approved process.
- Define who can access raw data, how long it is retained, how withdrawal/deletion requests are handled, and when the crosswalk is destroyed before collecting data.

## Changes after freezing

Record any change with date, reason, whether outcomes were already inspected, and affected participants. Never silently change the primary outcome or exclusion rules after seeing results.
