import { createClient } from "npm:@supabase/supabase-js@2";

const allowedOrigins = new Set([
  "https://ihiahipg.github.io",
  "http://localhost:5500",
  "http://127.0.0.1:5500",
]);
const headersFor = (origin: string | null): Record<string, string> => ({
  "Access-Control-Allow-Origin": origin && allowedOrigins.has(origin) ? origin : "https://ihiahipg.github.io",
  "Access-Control-Allow-Headers": "apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
});

function json(body: unknown, status: number, cors: HeadersInit) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json; charset=utf-8" },
  });
}

function validUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function boundedNumber(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
}

function normalizeCode(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.toUpperCase().replace(/[\s-]/g, "");
  return /^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{16}$/.test(normalized) ? normalized : null;
}

async function hmacCode(code: string, pepper: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(pepper),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(code));
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function getAdminClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const secretMap = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
  const secret = secretMap.default || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !secret) throw new Error("Supabase server secrets are missing");
  return createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
}

function validTrace(value: unknown): value is Array<{ t_ms: number; midi: number }> {
  return Array.isArray(value) && value.length <= 900 && value.every((sample) =>
    sample && typeof sample === "object" &&
    boundedNumber((sample as { t_ms?: unknown }).t_ms, 0, 600000) &&
    boundedNumber((sample as { midi?: unknown }).midi, 36, 96)
  );
}

function parseBaseline(value: unknown): { fields: Record<string, unknown>; answers: Array<Record<string, unknown>> } | null {
  if (!value || typeof value !== "object") return null;
  const b = value as Record<string, unknown>;
  const durations = ["none", "under_1", "1_to_3", "3_to_6", "6_plus"];
  const familyControls: Record<string, string> = {
    none: "none", continuous_pitch: "continuous", stepwise_pitch: "stepwise",
    unpitched_percussion: "unpitched", other: "other",
  };
  const bandByDuration: Record<string, number> = {
    none: 3, under_1: 3, "1_to_3": 2, "3_to_6": 1, "6_plus": 1,
  };
  const quiz = b.knowledgeQuiz as Record<string, unknown> | undefined;
  const answerKey: Record<string, string> = { q1: "perfect_fourth", q2: "minor_third", q3: "perfect_fifth", q4: "major_third", q5: "major_sixth" };
  const answerOptions: Record<string, string[]> = {
    q1: ["perfect_fourth", "major_third", "perfect_fifth", "minor_sixth", "dont_know"],
    q2: ["minor_third", "major_third", "perfect_fourth", "minor_second", "dont_know"],
    q3: ["perfect_fifth", "perfect_fourth", "major_sixth", "minor_seventh", "dont_know"],
    q4: ["major_third", "minor_third", "perfect_fourth", "major_second", "dont_know"],
    q5: ["major_sixth", "minor_sixth", "perfect_fifth", "major_seventh", "dont_know"],
  };
  const currentSurvey = b.surveyVersion === "classroom-baseline-v6";
  const legacySurvey = b.surveyVersion === "classroom-baseline-v5";
  if (!durations.includes(String(b.musicExperienceDuration)) ||
      !Object.hasOwn(familyControls, String(b.primaryInstrument)) ||
      (currentSurvey ? typeof b.musicClubExperience !== "boolean" :
        legacySurvey ? typeof b.windBandMember !== "boolean" : true) ||
      !["yes", "no", "unsure"].includes(String(b.absolutePitchSelfReport)) ||
      typeof b.otherPitchAppExperience !== "boolean" ||
      !Number.isInteger(b.relativePitchRating) || Number(b.relativePitchRating) < 1 || Number(b.relativePitchRating) > 5 ||
      !quiz || Object.keys(answerKey).some((key) => typeof quiz[key] !== "string" || !answerOptions[key].includes(String(quiz[key]))) ||
      (!currentSurvey && !legacySurvey)) return null;
  return {
    fields: {
      music_experience_duration: b.musicExperienceDuration,
      music_experience_band: bandByDuration[String(b.musicExperienceDuration)],
      primary_instrument_family: b.primaryInstrument,
      instrument_pitch_control: familyControls[String(b.primaryInstrument)],
      wind_band_member: legacySurvey ? b.windBandMember : null,
      music_club_experience: currentSurvey ? b.musicClubExperience : null,
      music_club_experience_captured_at: currentSurvey ? new Date().toISOString() : null,
      absolute_pitch_self_report: b.absolutePitchSelfReport,
      other_pitch_app_experience: b.otherPitchAppExperience,
      relative_pitch_rating: b.relativePitchRating,
      survey_version: b.surveyVersion,
    },
    answers: Object.entries(answerKey).map(([key, correctOption]) => ({
      question_code: ({ q1: "q1_do_fa_interval", q2: "q2_do_mib_interval", q3: "q3_do_sol_interval", q4: "q4_do_mi_interval", q5: "q5_do_la_interval" } as Record<string, string>)[key],
      selected_option: quiz[key],
      is_correct: quiz[key] === correctOption,
      quiz_version: "interval-knowledge-v3-5q",
    })),
  };
}

Deno.serve(async (request) => {
  const origin = request.headers.get("Origin");
  const cors = headersFor(origin);
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (origin && !allowedOrigins.has(origin)) return json({ error: "origin_not_allowed" }, 403, cors);
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405, cors);
  const contentLength = Number(request.headers.get("Content-Length") || 0);
  if (contentLength > 1_500_000) return json({ error: "payload_too_large" }, 413, cors);

  try {
    const body = await request.json();
    if (!body || typeof body !== "object") return json({ error: "invalid_json" }, 400, cors);
    const code = normalizeCode((body as Record<string, unknown>).participantCode);
    const peppers = [Deno.env.get("PILOT_CODE_PEPPER"), Deno.env.get("PILOT_CODE_PEPPER_AD")]
      .filter((value): value is string => Boolean(value));
    if (!code || peppers.length === 0) return json({ error: "invalid_participant_code" }, 401, cors);

    const admin = getAdminClient();
    let participant: { id: string; assigned_group: string } | null = null;
    let lookupFailed = false;
    for (const pepper of peppers) {
      const codeHash = await hmacCode(code, pepper);
      const result = await admin
        .from("pilot_participants")
        .select("id, assigned_group")
        .eq("code_hash", codeHash)
        .eq("active", true)
        .maybeSingle();
      if (result.error) {
        lookupFailed = true;
        break;
      }
      participant = result.data;
      if (participant) break;
    }
    if (lookupFailed || !participant) return json({ error: "invalid_participant_code" }, 401, cors);

    const action = (body as Record<string, unknown>).action;
    if (action === "start_session") {
      const sessionId = (body as Record<string, unknown>).sessionId;
      const mode = (body as Record<string, unknown>).mode;
      const pageGroup = (body as Record<string, unknown>).pageGroup;
      const appVersion = (body as Record<string, unknown>).appVersion;
      const submittedBaseline = mode === "pretest" ? parseBaseline((body as Record<string, unknown>).baseline) : null;
      if (!validUuid(sessionId) || !["pretest", "training", "posttest"].includes(String(mode))) {
        return json({ error: "invalid_session" }, 400, cors);
      }
      if (typeof appVersion !== "string" || appVersion.length < 1 || appVersion.length > 80) {
        return json({ error: "invalid_app_version" }, 400, cors);
      }
      if (mode === "training" && pageGroup !== participant.assigned_group) {
        return json({ error: "wrong_group_url", assignedGroup: participant.assigned_group }, 403, cors);
      }

      const { data: storedBaselineV3, error: baselineV3ReadError } = await admin
        .from("participant_baseline_v3")
        .select("music_experience_band, survey_version")
        .eq("participant_id", participant.id)
        .maybeSingle();
      if (baselineV3ReadError) return json({ error: "baseline_read_failed" }, 500, cors);
      const { data: legacyBaseline, error: legacyBaselineReadError } = await admin
        .from("participant_baseline")
        .select("participant_id")
        .eq("participant_id", participant.id)
        .maybeSingle();
      if (legacyBaselineReadError) return json({ error: "baseline_read_failed" }, 500, cors);
      if (mode === "pretest" && !submittedBaseline) {
        return json({ error: "baseline_required" }, 400, cors);
      }
      if (mode !== "pretest" && !storedBaselineV3 && !legacyBaseline) {
        return json({ error: "baseline_required" }, 403, cors);
      }
      if (submittedBaseline && !storedBaselineV3) {
        const { error: baselineWriteError } = await admin.from("participant_baseline_v3")
          .insert({ participant_id: participant.id, ...submittedBaseline.fields });
        if (baselineWriteError) {
          const { data: racedBaseline, error: racedReadError } = await admin.from("participant_baseline_v3")
            .select("participant_id").eq("participant_id", participant.id).maybeSingle();
          if (racedReadError || !racedBaseline) return json({ error: "baseline_save_failed" }, 500, cors);
        }
      } else if (submittedBaseline && submittedBaseline.fields.music_club_experience !== null) {
        const { error: clubExperienceWriteError } = await admin.from("participant_baseline_v3")
          .update({
            music_club_experience: submittedBaseline.fields.music_club_experience,
            music_club_experience_captured_at: submittedBaseline.fields.music_club_experience_captured_at,
          }).eq("participant_id", participant.id);
        if (clubExperienceWriteError) return json({ error: "club_experience_save_failed" }, 500, cors);
      }
      if (submittedBaseline) {
        const answerRows = submittedBaseline.answers.map((answer) => ({ participant_id: participant.id, ...answer }));
        const { error: answerError } = await admin.from("participant_knowledge_answers_v3")
          .upsert(answerRows, { onConflict: "participant_id,question_code", ignoreDuplicates: true });
        if (answerError) return json({ error: "knowledge_answers_save_failed" }, 500, cors);
      }

      const { data: previousSessions, error: sessionOrderError } = await admin
        .from("study_sessions")
        .select("session_number")
        .eq("participant_id", participant.id)
        .eq("mode", mode)
        .order("session_number", { ascending: false })
        .limit(1);
      if (sessionOrderError) return json({ error: "session_order_failed" }, 500, cors);
      const sessionNumber = Number(previousSessions?.[0]?.session_number || 0) + 1;
      const assessmentWave = `${mode}_${sessionNumber}`;

      const { error: insertError } = await admin.from("study_sessions").insert({
        id: sessionId,
        participant_id: participant.id,
        assigned_group: participant.assigned_group,
        mode,
        app_version: appVersion,
        session_number: sessionNumber,
        assessment_wave: assessmentWave,
      });
      if (insertError) {
        const { data: existing } = await admin.from("study_sessions")
          .select("id, participant_id, assigned_group, mode")
          .eq("id", sessionId)
          .maybeSingle();
        if (!existing || existing.participant_id !== participant.id || existing.mode !== mode) {
          return json({ error: "session_create_failed" }, 409, cors);
        }
      }
      return json({ sessionId, assignedGroup: participant.assigned_group, musicExperienceBand: storedBaselineV3?.music_experience_band ?? submittedBaseline?.fields.music_experience_band ?? null, sessionNumber, assessmentWave }, 200, cors);
    }

    if (action === "submit_trial") {
      const sessionId = (body as Record<string, unknown>).sessionId;
      const questionNumber = (body as Record<string, unknown>).questionNumber;
      const trial = (body as Record<string, unknown>).trial as Record<string, unknown> | undefined;
      if (!validUuid(sessionId) || !Number.isInteger(questionNumber) || Number(questionNumber) < 1 || Number(questionNumber) > 10 || !trial) {
        return json({ error: "invalid_trial" }, 400, cors);
      }
      const { data: session } = await admin.from("study_sessions")
        .select("id")
        .eq("id", sessionId)
        .eq("participant_id", participant.id)
        .maybeSingle();
      if (!session) return json({ error: "session_not_found" }, 403, cors);

      const referenceMidi = trial.referenceMidi;
      const targetMidi = trial.targetMidi;
      const answerMidi = trial.answerMidi;
      const trace = trial.movementTrace;
      const numericFields = ["responseTimeMs", "targetCrossings", "referenceCrossings", "snapCount"] as const;
      if (!boundedNumber(referenceMidi, 48, 72) || !boundedNumber(targetMidi, 36, 84) ||
          (answerMidi !== null && !boundedNumber(answerMidi, 36, 84)) ||
          typeof trial.correct !== "boolean" || typeof trial.skipped !== "boolean" || !validTrace(trace)) {
        return json({ error: "invalid_trial_values" }, 400, cors);
      }
      const ranges: Record<typeof numericFields[number], [number, number]> = {
        responseTimeMs: [0, 600000], targetCrossings: [0, 1000], referenceCrossings: [0, 1000], snapCount: [0, 1000],
      };
      for (const field of numericFields) {
        const [min, max] = ranges[field];
        if (!boundedNumber(trial[field], min, max) || !Number.isInteger(trial[field])) {
          return json({ error: `invalid_${field}` }, 400, cors);
        }
      }
      for (const field of ["firstMoveMs", "timeToTargetMs"] as const) {
        if (trial[field] !== null && !boundedNumber(trial[field], 0, 600000)) return json({ error: `invalid_${field}` }, 400, cors);
      }
      const targetReplayCount = trial.targetReplayCount === undefined ? 0 : trial.targetReplayCount;
      if (typeof targetReplayCount !== "number" || !Number.isInteger(targetReplayCount) || targetReplayCount < 0 || targetReplayCount > 1000) {
        return json({ error: "invalid_targetReplayCount" }, 400, cors);
      }
      if (trial.maxPostTargetDeviationCents !== null && !boundedNumber(trial.maxPostTargetDeviationCents, 0, 2400)) {
        return json({ error: "invalid_deviation" }, 400, cors);
      }

      const signedError = answerMidi === null ? null : Number(answerMidi) - Number(targetMidi);
      const calculatedCorrect = !trial.skipped && signedError !== null && Math.abs(signedError) < 0.12;
      const { error: trialError } = await admin.from("study_trials").upsert({
        session_id: sessionId,
        question_number: questionNumber,
        reference_midi: referenceMidi,
        target_midi: targetMidi,
        target_interval_semitones: Number(targetMidi) - Number(referenceMidi),
        answer_midi: answerMidi,
        signed_error_semitones: signedError,
        absolute_error_semitones: signedError === null ? null : Math.abs(signedError),
        correct: calculatedCorrect,
        skipped: trial.skipped,
        response_time_ms: trial.responseTimeMs,
        target_crossings: trial.targetCrossings,
        reference_crossings: trial.referenceCrossings,
        first_move_ms: trial.firstMoveMs,
        time_to_target_ms: trial.timeToTargetMs,
        max_post_target_deviation_cents: trial.maxPostTargetDeviationCents,
        snap_count: trial.snapCount,
        target_replay_count: targetReplayCount,
        movement_trace: trace,
      }, { onConflict: "session_id,question_number", ignoreDuplicates: true });
      if (trialError) return json({ error: "trial_write_failed" }, 500, cors);
      return json({ saved: true }, 200, cors);
    }

    if (action === "finish_session") {
      const sessionId = (body as Record<string, unknown>).sessionId;
      if (!validUuid(sessionId)) return json({ error: "invalid_session" }, 400, cors);
      const { error: finishError } = await admin.from("study_sessions")
        .update({ completed_at: new Date().toISOString() })
        .eq("id", sessionId).eq("participant_id", participant.id);
      if (finishError) return json({ error: "session_finish_failed" }, 500, cors);
      return json({ saved: true }, 200, cors);
    }

    return json({ error: "unknown_action" }, 400, cors);
  } catch {
    return json({ error: "request_failed" }, 400, cors);
  }
});
