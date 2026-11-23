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
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json; charset=utf-8" } });
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
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pepper), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
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
    boundedNumber((sample as { midi?: unknown }).midi, 36, 96));
}
function parseBaseline(value: unknown): { fields: Record<string, unknown>; answers: Array<Record<string, unknown>> } | null {
  if (!value || typeof value !== "object") return null;
  const b = value as Record<string, unknown>;
  const durations = ["none", "under_1", "1_to_3", "3_to_6", "6_plus"];
  const familyControls: Record<string, string> = {
    none: "none", keyboard: "stepwise", woodwind: "stepwise", valved_brass: "stepwise",
    slide_brass: "continuous", bowed_strings: "continuous", fretted_strings: "stepwise",
    pitched_percussion: "stepwise", unpitched_percussion: "unpitched", other: "other",
  };
  const bandByDuration: Record<string, number> = {
    none: 3, under_1: 3, "1_to_3": 2, "3_to_6": 1, "6_plus": 1,
  };
  const quiz = b.knowledgeQuiz as Record<string, unknown> | undefined;
  const answerKey: Record<string, string> = { q1: "perfect_fourth", q2: "minor_third", q3: "perfect_fifth" };
  const answerOptions: Record<string, string[]> = {
    q1: ["perfect_fourth", "major_third", "perfect_fifth", "minor_sixth", "dont_know"],
    q2: ["minor_third", "major_third", "perfect_fourth", "minor_second", "dont_know"],
    q3: ["perfect_fifth", "perfect_fourth", "major_sixth", "minor_seventh", "dont_know"],
  };
  if (!durations.includes(String(b.musicExperienceDuration)) ||
      !Object.hasOwn(familyControls, String(b.primaryInstrument)) ||
      typeof b.windBandMember !== "boolean" ||
      !["yes", "no", "unsure"].includes(String(b.absolutePitchSelfReport)) ||
      typeof b.otherPitchAppExperience !== "boolean" ||
      !Number.isInteger(b.relativePitchRating) || Number(b.relativePitchRating) < 1 || Number(b.relativePitchRating) > 5 ||
      !quiz || Object.keys(answerKey).some((key) => typeof quiz[key] !== "string" || !answerOptions[key].includes(String(quiz[key]))) ||
      b.surveyVersion !== "classroom-baseline-v4") return null;
  return {
    fields: {
      music_experience_duration: b.musicExperienceDuration,
      music_experience_band: bandByDuration[String(b.musicExperienceDuration)],
      primary_instrument_family: b.primaryInstrument,
      instrument_pitch_control: familyControls[String(b.primaryInstrument)],
      wind_band_member: b.windBandMember,
      absolute_pitch_self_report: b.absolutePitchSelfReport,
      other_pitch_app_experience: b.otherPitchAppExperience,
      relative_pitch_rating: b.relativePitchRating,
      survey_version: b.surveyVersion,
    },
    answers: Object.entries(answerKey).map(([key, correctOption]) => ({
      question_code: key === "q1" ? "q1_do_fa_interval" : key === "q2" ? "q2_do_mib_interval" : "q3_do_sol_interval",
      selected_option: quiz[key],
      is_correct: quiz[key] === correctOption,
      quiz_version: "interval-knowledge-v2",
    })),
  };
}

Deno.serve(async (request) => {
  const origin = request.headers.get("Origin");
  const cors = headersFor(origin);
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (origin && !allowedOrigins.has(origin)) return json({ error: "origin_not_allowed" }, 403, cors);
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405, cors);
  if (Number(request.headers.get("Content-Length") || 0) > 1_500_000) return json({ error: "payload_too_large" }, 413, cors);

  try {
    const body = await request.json();
    if (!body || typeof body !== "object") return json({ error: "invalid_json" }, 400, cors);
    const requestBody = body as Record<string, unknown>;
    const code = normalizeCode(requestBody.participantCode);
    const pepper = Deno.env.get("CLASSROOM_CODE_PEPPER");
    if (!code || !pepper) return json({ error: "invalid_participant_code" }, 401, cors);
    const admin = getAdminClient();
    const digest = await hmacCode(code, pepper);
    const { data: participant, error: participantError } = await admin.from("participants")
      .select("id").eq("code_hash", digest).eq("active", true).maybeSingle();
    if (participantError || !participant) return json({ error: "invalid_participant_code" }, 401, cors);

    const action = requestBody.action;
    if (action === "start_session") {
      const sessionId = requestBody.sessionId;
      const mode = requestBody.mode;
      const pageGroup = requestBody.pageGroup;
      const appVersion = requestBody.appVersion;
      const headphoneType = requestBody.headphoneType;
      if (!validUuid(sessionId) || !["pretest", "training", "posttest"].includes(String(mode))) return json({ error: "invalid_session" }, 400, cors);
      if (typeof appVersion !== "string" || appVersion.length < 1 || appVersion.length > 80) return json({ error: "invalid_app_version" }, 400, cors);
      if (!["speaker", "wired", "bluetooth", "other"].includes(String(headphoneType))) return json({ error: "invalid_headphone_type" }, 400, cors);

      // Reusing a session UUID is idempotent. The protocol allows two pretest sets,
      // but only one posttest; starting a fresh UUID cannot bypass those limits.
      if (mode === "pretest" || mode === "posttest") {
        const { data: sameSession, error: sameSessionError } = await admin.from("study_sessions")
          .select("id, session_number, assessment_wave")
          .eq("id", sessionId).eq("participant_id", participant.id).eq("mode", mode).maybeSingle();
        if (sameSessionError) return json({ error: "assessment_lookup_failed" }, 500, cors);
        if (sameSession) {
          const { data: priorAssignment, error: priorAssignmentError } = await admin.from("randomization_assignments")
            .select("assigned_group").eq("participant_id", participant.id).maybeSingle();
          if (priorAssignmentError) return json({ error: "assignment_lookup_failed" }, 500, cors);
          return json({
            sessionId: sameSession.id,
            assignedGroup: priorAssignment?.assigned_group ?? null,
            sessionNumber: sameSession.session_number,
            assessmentWave: sameSession.assessment_wave,
          }, 200, cors);
        }
        const { data: priorSessions, error: priorSessionError } = await admin.from("study_sessions")
          .select("session_number")
          .eq("participant_id", participant.id).eq("mode", mode)
          .order("session_number", { ascending: false }).limit(1);
        if (priorSessionError) return json({ error: "assessment_lookup_failed" }, 500, cors);
        const { count: completedCount, error: completedCountError } = await admin.from("study_sessions")
          .select("id", { count: "exact", head: true })
          .eq("participant_id", participant.id).eq("mode", mode).not("completed_at", "is", null);
        if (completedCountError) return json({ error: "assessment_lookup_failed" }, 500, cors);
        if (mode === "pretest" && (completedCount || 0) >= 2) return json({ error: "pretest_limit_reached" }, 409, cors);
        if (mode === "posttest" && (completedCount || 0) >= 1) return json({ error: "posttest_already_submitted" }, 409, cors);
      }

      const { data: storedBaseline, error: baselineReadError } = await admin.from("participant_baseline_v3")
        .select("participant_id").eq("participant_id", participant.id).maybeSingle();
      if (baselineReadError) return json({ error: "baseline_read_failed" }, 500, cors);
      const parsedBaseline = mode === "pretest" ? parseBaseline(requestBody.baseline) : null;
      if (mode === "pretest" && !parsedBaseline) return json({ error: "baseline_required" }, 400, cors);
      if (!storedBaseline) {
        if (mode !== "pretest") return json({ error: "pretest_required" }, 403, cors);
        const { error } = await admin.from("participant_baseline_v3").insert({ participant_id: participant.id, ...parsedBaseline!.fields });
        if (error) {
          const { data: racedBaseline } = await admin.from("participant_baseline_v3")
            .select("participant_id").eq("participant_id", participant.id).maybeSingle();
          if (!racedBaseline) return json({ error: "baseline_save_failed" }, 500, cors);
        }
      }
      if (parsedBaseline) {
        const answerRows = parsedBaseline.answers.map((answer) => ({ participant_id: participant.id, ...answer }));
        const { error } = await admin.from("participant_knowledge_answers_v3")
          .upsert(answerRows, { onConflict: "participant_id,question_code", ignoreDuplicates: true });
        if (error) return json({ error: "knowledge_answers_save_failed" }, 500, cors);
      }

      const { data: assignment, error: assignmentError } = await admin.from("randomization_assignments")
        .select("assigned_group").eq("participant_id", participant.id).maybeSingle();
      if (assignmentError) return json({ error: "assignment_lookup_failed" }, 500, cors);
      const assignedGroup = assignment?.assigned_group ?? null;
      if (mode === "training" || mode === "posttest") {
        if (!assignedGroup) return json({ error: "group_not_assigned" }, 403, cors);
        if (mode === "training" && pageGroup !== assignedGroup) return json({ error: "wrong_group_url", assignedGroup }, 403, cors);
      }

      const { data: previousSessions, error: orderError } = await admin.from("study_sessions")
        .select("session_number").eq("participant_id", participant.id).eq("mode", mode)
        .order("session_number", { ascending: false }).limit(1);
      if (orderError) return json({ error: "session_order_failed" }, 500, cors);
      const sessionNumber = Number(previousSessions?.[0]?.session_number || 0) + 1;
      const assessmentWave = `${mode}_${sessionNumber}`;
      const { error: insertError } = await admin.from("study_sessions").insert({
        id: sessionId, participant_id: participant.id, mode, session_number: sessionNumber,
        assessment_wave: assessmentWave, headphone_type: headphoneType, app_version: appVersion,
      });
      if (insertError) {
        const { data: existing } = await admin.from("study_sessions").select("id, participant_id, mode").eq("id", sessionId).maybeSingle();
        if (!existing || existing.participant_id !== participant.id || existing.mode !== mode) return json({ error: "session_create_failed" }, 409, cors);
      }
      return json({ sessionId, assignedGroup, sessionNumber, assessmentWave }, 200, cors);
    }

    if (action === "submit_trial") {
      const sessionId = (body as Record<string, unknown>).sessionId;
      const questionNumber = (body as Record<string, unknown>).questionNumber;
      const trial = (body as Record<string, unknown>).trial as Record<string, unknown> | undefined;
      if (!validUuid(sessionId) || !Number.isInteger(questionNumber) || Number(questionNumber) < 1 || Number(questionNumber) > 10 || !trial) {
        return json({ error: "invalid_trial" }, 400, cors);
      }
      const { data: session, error: sessionReadError } = await admin.from("study_sessions")
        .select("id, completed_at")
        .eq("id", sessionId)
        .eq("participant_id", participant.id)
        .maybeSingle();
      if (sessionReadError) return json({ error: "session_lookup_failed" }, 500, cors);
      if (!session) return json({ error: "session_not_found" }, 403, cors);
      if (session.completed_at) return json({ error: "session_already_completed" }, 409, cors);

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
      const sessionId = requestBody.sessionId;
      if (!validUuid(sessionId)) return json({ error: "invalid_session" }, 400, cors);
      const { data: session, error: sessionReadError } = await admin.from("study_sessions")
        .select("id, mode, completed_at")
        .eq("id", sessionId).eq("participant_id", participant.id).maybeSingle();
      if (sessionReadError) return json({ error: "session_lookup_failed" }, 500, cors);
      if (!session) return json({ error: "session_not_found" }, 403, cors);
      if (session.completed_at) return json({ saved: true }, 200, cors);
      const { count: trialCount, error: trialCountError } = await admin.from("study_trials")
        .select("id", { count: "exact", head: true }).eq("session_id", sessionId);
      if (trialCountError) return json({ error: "trial_count_failed" }, 500, cors);
      if (trialCount !== 10) return json({ error: "session_incomplete" }, 409, cors);
      if (session.mode === "posttest") {
        const { count: completedPosttests, error: posttestCountError } = await admin.from("study_sessions")
          .select("id", { count: "exact", head: true })
          .eq("participant_id", participant.id).eq("mode", "posttest").not("completed_at", "is", null);
        if (posttestCountError) return json({ error: "assessment_lookup_failed" }, 500, cors);
        if ((completedPosttests || 0) >= 1) return json({ error: "posttest_already_submitted" }, 409, cors);
      }
      if (session.mode === "pretest") {
        const { count: completedPretests, error: pretestCountError } = await admin.from("study_sessions")
          .select("id", { count: "exact", head: true })
          .eq("participant_id", participant.id).eq("mode", "pretest").not("completed_at", "is", null);
        if (pretestCountError) return json({ error: "assessment_lookup_failed" }, 500, cors);
        if ((completedPretests || 0) >= 2) return json({ error: "pretest_limit_reached" }, 409, cors);
      }
      const { error: finishError } = await admin.from("study_sessions").update({ completed_at: new Date().toISOString() })
        .eq("id", sessionId).eq("participant_id", participant.id);
      if (finishError) return json({ error: "session_finish_failed" }, 500, cors);
      return json({ saved: true }, 200, cors);
    }

    return json({ error: "unknown_action" }, 400, cors);
  } catch {
    return json({ error: "request_failed" }, 400, cors);
  }
});
