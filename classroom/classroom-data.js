(() => {
  const config = window.PILOT_DATA_CONFIG || {};
  const projectUrl = typeof config.projectUrl === "string" ? config.projectUrl.replace(/\/$/, "") : "";
  const publishableKey = typeof config.publishableKey === "string" ? config.publishableKey.trim() : "";
  const enabled = /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(projectUrl) &&
    (publishableKey.startsWith("sb_publishable_") || publishableKey.startsWith("eyJ"));
  const endpoint = enabled ? `${projectUrl}/functions/v1/classroom-data` : "";
  const OUTBOX_KEY = "pitchTrainerClassroomOutboxV1";
  const FINISH_OUTBOX_KEY = "pitchTrainerClassroomFinishOutboxV1";
  const PARTICIPANT_CODE_KEY = "pitchTrainerClassroomParticipantCodeV1";
  const BASELINE_CACHE_PREFIX = "pitchTrainerClassroomBaselineV4-";
  let enrollmentPage = false;

  function getSavedParticipantCode() {
    try {
      return localStorage.getItem(PARTICIPANT_CODE_KEY) || "";
    } catch {
      return "";
    }
  }

  function saveParticipantCode(code) {
    try {
      localStorage.setItem(PARTICIPANT_CODE_KEY, code);
      return true;
    } catch {
      return false;
    }
  }

  function clearSavedParticipantCode() {
    try {
      localStorage.removeItem(PARTICIPANT_CODE_KEY);
      return true;
    } catch {
      return false;
    }
  }

  function setStatus(message, isError = false) {
    const node = document.querySelector("#pilotDataStatus");
    if (!node) return;
    node.textContent = message;
    node.classList.toggle("error", isError);
    const hasPending = readOutbox().length > 0 || readFinishOutbox().length > 0;
    const panel = document.querySelector("#pilotEntry");
    if (panel && hasPending) {
      panel.hidden = false;
      if (!enrollmentPage) {
        const codeInput = document.querySelector("#participantCode");
        const codeLabel = panel.querySelector('label[for="participantCode"]');
        const experience = document.querySelector("#experienceSurvey");
        if (codeInput) codeInput.hidden = true;
        if (codeLabel) codeLabel.hidden = true;
        if (experience) experience.hidden = true;
      }
    }
    const retry = document.querySelector("#retryPilotUpload");
    if (retry && enabled) retry.hidden = !hasPending;
  }

  function readOutbox() {
    try {
      const value = JSON.parse(localStorage.getItem(OUTBOX_KEY) || "[]");
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }

  function writeOutbox(value) {
    try {
      localStorage.setItem(OUTBOX_KEY, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }

  function readFinishOutbox() {
    try {
      const value = JSON.parse(localStorage.getItem(FINISH_OUTBOX_KEY) || "[]");
      return Array.isArray(value) ? value.filter((id) => typeof id === "string") : [];
    } catch {
      return [];
    }
  }

  function writeFinishOutbox(value) {
    try {
      localStorage.setItem(FINISH_OUTBOX_KEY, JSON.stringify([...new Set(value)]));
      return true;
    } catch {
      return false;
    }
  }

  function queueFinish(sessionId) {
    const pending = readFinishOutbox();
    if (!pending.includes(sessionId)) pending.push(sessionId);
    return writeFinishOutbox(pending);
  }

  async function flushPendingFinishes(code) {
    const remaining = [];
    for (const sessionId of readFinishOutbox()) {
      if (readOutbox().some((item) => item.sessionId === sessionId)) {
        remaining.push(sessionId);
        continue;
      }
      try {
        await post({ action: "finish_session", participantCode: code, sessionId });
      } catch {
        remaining.push(sessionId);
      }
    }
    writeFinishOutbox(remaining);
    return remaining.length;
  }

  async function post(body) {
    let response;
    try {
      response = await fetch(endpoint, {
        method: "POST",
        headers: { apikey: publishableKey, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch (cause) {
      const message = location.protocol === "file:"
        ? "HTMLファイルを直接開いているため、ブラウザーがSupabase接続を止めました。GitHub PagesのURLか http://localhost:5500/classroom/pretest/ を開いてください。"
        : "Supabaseに接続できませんでした。通信環境、Project URL、Edge Functionの状態を確認してください。";
      const error = new Error(message);
      error.cause = cause;
      throw error;
    }
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(result.error || `HTTP ${response.status}`);
      error.status = response.status;
      error.serverResult = result;
      throw error;
    }
    return result;
  }

  async function sendTrial(code, queued) {
    return post({
      action: "submit_trial",
      participantCode: code,
      sessionId: queued.sessionId,
      questionNumber: queued.questionNumber,
      trial: queued.trial,
    });
  }

  async function flushOutbox(code) {
    const pending = readOutbox();
    if (!pending.length) return 0;
    const remaining = [];
    for (const item of pending) {
      try {
        await sendTrial(code, item);
      } catch {
        remaining.push(item);
      }
    }
    if (!writeOutbox(remaining)) {
      setStatus("未送信データを端末に保存できませんでした。画面を閉じずに先生へ知らせてください。", true);
      return pending.length;
    }
    return remaining.length;
  }

  async function baselineCacheKey(code) {
    const normalized = code.toUpperCase().replace(/[\s-]/g, "");
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(normalized));
    const hex = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
    return `${BASELINE_CACHE_PREFIX}${hex}`;
  }

  async function cacheBaseline(code, baseline) {
    if (!baseline) return;
    try { localStorage.setItem(await baselineCacheKey(code), JSON.stringify(baseline)); } catch {}
  }

  async function restoreBaselineForm(code) {
    if (!code) return;
    try {
      const raw = localStorage.getItem(await baselineCacheKey(code));
      if (!raw) return;
      const baseline = JSON.parse(raw);
      const ids = {
        musicExperienceDuration: "musicExperienceDuration",
        primaryInstrument: "primaryInstrument",
        windBandMember: "windBandMember",
        absolutePitchSelfReport: "absolutePitchSelfReport",
        otherPitchAppExperience: "otherPitchAppExperience",
        relativePitchRating: "relativePitchRating",
        "knowledgeQuiz.q1": "knowledgeQ1",
        "knowledgeQuiz.q2": "knowledgeQ2",
        "knowledgeQuiz.q3": "knowledgeQ3",
        "knowledgeQuiz.q4": "knowledgeQ4",
        "knowledgeQuiz.q5": "knowledgeQ5",
      };
      for (const [key, id] of Object.entries(ids)) {
        const input = document.getElementById(id);
        const value = key.startsWith("knowledgeQuiz.")
          ? baseline.knowledgeQuiz?.[key.split(".")[1]]
          : baseline[key];
        if (input && value !== null && value !== undefined) input.value = String(value);
      }
      const legend = document.querySelector("#experienceSurvey legend");
      if (legend) legend.textContent = "事前アンケート（この端末に入力済み）";
      const survey = document.querySelector("#experienceSurvey");
      if (survey) survey.disabled = true;
    } catch {}
  }

  async function startSession({ code, mode, pageGroup, sessionId, appVersion, baseline, headphoneType }) {
    const pendingCount = await flushOutbox(code);
    if (pendingCount === 0) await flushPendingFinishes(code);
    const result = await post({
      action: "start_session",
      participantCode: code,
      mode,
      pageGroup,
      sessionId,
      appVersion,
      baseline,
      headphoneType,
    });
    if (mode === "pretest" && baseline) await cacheBaseline(code, baseline);
    if (pendingCount) setStatus(`${pendingCount}件の前回データが未送信です。前回と同じ参加コードで再試行してください。`, true);
    else setStatus("参加コードを確認しました。回答と音の動きは送信されます。");
    return { ...result, pendingCount };
  }

  async function submitTrial({ code, sessionId, questionNumber, trial }) {
    const item = { sessionId, questionNumber, trial };
    try {
      await flushOutbox(code);
      await sendTrial(code, item);
      const pendingCount = readOutbox().length;
      setStatus(pendingCount ? `${pendingCount}件の前回データが未送信です。` : "この問題のデータを送信しました。", pendingCount > 0);
    } catch (error) {
      if (!error.status || error.status >= 500) {
        const pending = readOutbox();
        if (!pending.some((entry) => entry.sessionId === sessionId && entry.questionNumber === questionNumber)) {
          pending.push(item);
        }
        if (writeOutbox(pending)) {
          setStatus(`通信できず、この問題を端末に一時保存しました（未送信 ${pending.length}件）。`, true);
        } else {
          setStatus("送信と端末保存に失敗しました。画面を閉じずに先生へ知らせてください。", true);
        }
      } else {
        setStatus(`データを受け付けられませんでした（${error.message}）。先生へ知らせてください。`, true);
      }
    }
  }

  async function finishSession({ code, sessionId }) {
    try {
      const pendingCount = await flushOutbox(code);
      if (pendingCount > 0) {
        queueFinish(sessionId);
        setStatus(`未送信の回答が${pendingCount}件あります。通信が戻ったら「未送信データを再送」を押してください。全10問が届くまで完了扱いにしません。`, true);
        return;
      }
      await post({ action: "finish_session", participantCode: code, sessionId });
      writeFinishOutbox(readFinishOutbox().filter((id) => id !== sessionId));
      setStatus("全10問のデータを送信しました。");
    } catch (error) {
      queueFinish(sessionId);
      setStatus("回答は端末に残っています。通信が戻ったら「未送信データを再送」を押してください。", true);
    }
  }

  function initialize({ entryMode = "saved" } = {}) {
    const panel = document.querySelector("#pilotEntry");
    if (!panel) return;
    const experience = document.querySelector("#experienceSurvey");
    const isEnrollmentPage = entryMode === "pretest";
    enrollmentPage = isEnrollmentPage;
    if (experience) experience.hidden = !isEnrollmentPage;
    if (!enabled) {
      panel.hidden = false;
      setStatus("授業用Supabaseの接続設定が未完了です。先生に授業用サイトの設定を確認してください。", true);
      return;
    }
    const input = document.querySelector("#participantCode");
    const savedCode = getSavedParticipantCode();
    if (input && savedCode) input.value = savedCode;
    const hasPending = readOutbox().length > 0 || readFinishOutbox().length > 0;
    panel.hidden = !isEnrollmentPage && Boolean(savedCode) && !hasPending;
    if (hasPending && !isEnrollmentPage) {
      if (input) input.hidden = true;
      const codeLabel = panel.querySelector('label[for="participantCode"]');
      if (codeLabel) codeLabel.hidden = true;
    }
    if (isEnrollmentPage && savedCode) void restoreBaselineForm(savedCode);
    setStatus(isEnrollmentPage
      ? "参加コードと音楽経験を確認して、事前テストを開始してください。"
      : savedCode
        ? "この端末に保存された参加コードで開始できます。"
        : "保存された参加コードがありません。事前テストで使ったコードを入力してください。入力後はこの端末に保存されます。");
    const retry = document.querySelector("#retryPilotUpload");
    if (retry) retry.hidden = readOutbox().length === 0 && readFinishOutbox().length === 0;
    retry?.addEventListener("click", async () => {
      const code = getSavedParticipantCode() || input?.value.trim();
      if (!code) return setStatus("参加コードを入力してください。", true);
      retry.disabled = true;
      const count = await flushOutbox(code);
      const finishCount = count === 0 ? await flushPendingFinishes(code) : readFinishOutbox().length;
      retry.disabled = false;
      retry.hidden = count === 0 && finishCount === 0;
      setStatus(count
        ? `未送信データが${count}件あります。通信が戻ったら再度送信してください。`
        : (finishCount ? "回答データは送信済みです。終了記録を再送できませんでした。もう一度お試しください。" : "未送信データを送信しました。"), count > 0 || finishCount > 0);
      if (count === 0 && finishCount === 0 && !enrollmentPage && panel) panel.hidden = true;
    });
  }

  function showCodeFallback() {
    const panel = document.querySelector("#pilotEntry");
    if (!panel) return;
    panel.hidden = false;
    const experience = document.querySelector("#experienceSurvey");
    if (experience) experience.hidden = true;
  }

  window.PilotStudyData = {
    enabled,
    initialize,
    setStatus,
    getSavedParticipantCode,
    saveParticipantCode,
    startSession,
    showCodeFallback,
    submitTrial,
    finishSession,
  };
})();
