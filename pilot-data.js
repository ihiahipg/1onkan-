(() => {
  const config = window.PILOT_DATA_CONFIG || {};
  const projectUrl = typeof config.projectUrl === "string" ? config.projectUrl.replace(/\/$/, "") : "";
  const publishableKey = typeof config.publishableKey === "string" ? config.publishableKey.trim() : "";
  const enabled = /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(projectUrl) &&
    (publishableKey.startsWith("sb_publishable_") || publishableKey.startsWith("eyJ"));
  const endpoint = enabled ? `${projectUrl}/functions/v1/pilot-data` : "";
  const OUTBOX_KEY = "pitchTrainerPilotOutboxV1";

  function setStatus(message, isError = false) {
    const node = document.querySelector("#pilotDataStatus");
    if (!node) return;
    node.textContent = message;
    node.classList.toggle("error", isError);
    const retry = document.querySelector("#retryPilotUpload");
    if (retry && enabled) retry.hidden = readOutbox().length === 0;
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

  async function post(body) {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { apikey: publishableKey, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
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

  async function startSession({ code, mode, pageGroup, sessionId, appVersion }) {
    const pendingCount = await flushOutbox(code);
    const result = await post({
      action: "start_session",
      participantCode: code,
      mode,
      pageGroup,
      sessionId,
      appVersion,
    });
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
      await flushOutbox(code);
      await post({ action: "finish_session", participantCode: code, sessionId });
      const pendingCount = readOutbox().length;
      setStatus(pendingCount ? `終了を記録しました。未送信データが${pendingCount}件あります。` : "全10問のデータを送信しました。");
    } catch {
      setStatus("終了記録を送信できませんでした。回答データは未送信のまま残る場合があります。", true);
    }
  }

  function initialize() {
    const panel = document.querySelector("#pilotEntry");
    if (!panel) return;
    panel.hidden = !enabled;
    if (enabled) {
      setStatus("研究参加コードを入力してください。データ収集について説明を受けた参加者のみ利用してください。");
      const retry = document.querySelector("#retryPilotUpload");
      if (retry) retry.hidden = readOutbox().length === 0;
      retry?.addEventListener("click", async () => {
        const code = document.querySelector("#participantCode")?.value.trim();
        if (!code) return setStatus("参加コードを入力してください。", true);
        retry.disabled = true;
        const count = await flushOutbox(code);
        retry.disabled = false;
        retry.hidden = count === 0;
        setStatus(count ? `未送信データが${count}件あります。前回と同じ参加コードを確認してください。` : "未送信データを送信しました。");
      });
    }
  }

  window.PilotStudyData = { enabled, initialize, setStatus, startSession, submitTrial, finishSession };
})();
