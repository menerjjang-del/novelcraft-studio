/**
 * NovelCraft Studio - Frontend Application Logic
 */

// ==========================================
// 0. Apps Script API 통신 헬퍼
// (API_BASE는 config.js에서 정의됩니다)
// ==========================================

async function apiGet(action, params = {}) {
  const url = new URL(API_BASE);
  url.searchParams.set("action", action);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), { method: "GET" });
  return res.json();
}

async function apiPost(action, data = {}) {
  // Content-Type을 text/plain으로 보내면 브라우저의 CORS preflight(OPTIONS)를
  // 피할 수 있어 Apps Script와 통신이 안정적입니다.
  const res = await fetch(API_BASE, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action, ...data })
  });
  return res.json();
}

// State
let state = {
  projects: [],
  currentProject: null,
  currentEpNum: 1,
  activeTab: "tab-plan",
  isSaving: false,
  saveTimeout: null,
  pendingAiAction: null // AI 모달에서 [적용하기] 시 실행할 콜백
};

// DOM Elements
const el = {
  projectSelect: document.getElementById("projectSelect"),
  btnNewProject: document.getElementById("btnNewProject"),
  saveStatus: document.getElementById("saveStatus"),
  btnSaveAll: document.getElementById("btnSaveAll"),
  btnOpenSettings: document.getElementById("btnOpenSettings"),
  tabButtons: document.querySelectorAll(".tab-btn"),
  tabContents: document.querySelectorAll(".tab-content"),

  // Step 1
  planTitle: document.getElementById("planTitle"),
  planGenre: document.getElementById("planGenre"),
  planKeywords: document.getElementById("planKeywords"),
  planIdea: document.getElementById("planIdea"),
  planLogline: document.getElementById("planLogline"),
  planWorldRules: document.getElementById("planWorldRules"),
  btnAiLogline: document.getElementById("btnAiLogline"),

  // Step 2
  characterList: document.getElementById("characterList"),
  btnAddCharacter: document.getElementById("btnAddCharacter"),
  btnAiCharacter: document.getElementById("btnAiCharacter"),

  // Step 3
  episodeList: document.getElementById("episodeList"),
  btnAddEpisode: document.getElementById("btnAddEpisode"),
  charCountWithSpace: document.getElementById("charCountWithSpace"),
  charCountWithoutSpace: document.getElementById("charCountWithoutSpace"),
  charProgressPercent: document.getElementById("charProgressPercent"),
  progressBar: document.getElementById("progressBar"),
  btnExportTxt: document.getElementById("btnExportTxt"),
  epTitleInput: document.getElementById("epTitleInput"),
  epContentInput: document.getElementById("epContentInput"),
  epGoalInput: document.getElementById("epGoalInput"),
  btnAiSuggestGoal: document.getElementById("btnAiSuggestGoal"),
  btnRefreshGoal: document.getElementById("btnRefreshGoal"),
  goalSyncToast: document.getElementById("goalSyncToast"),
  epPlotInput: document.getElementById("epPlotInput"),
  btnRefreshPlotFromGoal: document.getElementById("btnRefreshPlotFromGoal"),
  btnAiPlot: document.getElementById("btnAiPlot"),
  btnAiDraft: document.getElementById("btnAiDraft"),
  btnAiPolish: document.getElementById("btnAiPolish"),

  // Modals
  charModal: document.getElementById("charModal"),
  charModalTitle: document.getElementById("charModalTitle"),
  charId: document.getElementById("charId"),
  charName: document.getElementById("charName"),
  charRole: document.getElementById("charRole"),
  charTrait: document.getElementById("charTrait"),
  charVoice: document.getElementById("charVoice"),
  charSecret: document.getElementById("charSecret"),
  btnSaveChar: document.getElementById("btnSaveChar"),
  btnDeleteChar: document.getElementById("btnDeleteChar"),
  btnCancelCharModal: document.getElementById("btnCancelCharModal"),
  btnCloseCharModal: document.getElementById("btnCloseCharModal"),

  aiModal: document.getElementById("aiModal"),
  aiModalTitle: document.getElementById("aiModalTitle"),
  aiOutputText: document.getElementById("aiOutputText"),
  aiPromptText: document.getElementById("aiPromptText"),
  btnCopyPrompt: document.getElementById("btnCopyPrompt"),
  btnCopyOutput: document.getElementById("btnCopyOutput"),
  btnApplyAiResult: document.getElementById("btnApplyAiResult"),
  btnCloseAiModal: document.getElementById("btnCloseAiModal"),

  settingsModal: document.getElementById("settingsModal"),
  settingApiType: document.getElementById("settingApiType"),
  settingApiKey: document.getElementById("settingApiKey"),
  settingModelName: document.getElementById("settingModelName"),
  btnSaveSettings: document.getElementById("btnSaveSettings"),
  btnCancelSettings: document.getElementById("btnCancelSettings"),
  btnCloseSettingsModal: document.getElementById("btnCloseSettingsModal"),
};

// ==========================================
// 1. Initialization & Project Loading
// ==========================================

async function init() {
  bindEvents();
  await loadProjects();
  setupKeyboardShortcuts();
}

async function loadProjects() {
  try {
    state.projects = await apiGet("list");
    renderProjectDropdown();

    if (state.projects.length > 0) {
      await loadProjectDetail(state.projects[0].id);
    } else {
      createNewProject();
    }
  } catch (err) {
    console.error("프로젝트 로딩 실패:", err);
  }
}

function renderProjectDropdown() {
  el.projectSelect.innerHTML = "";
  state.projects.forEach(p => {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = `${p.title} (${p.genre || "장르미정"})`;
    el.projectSelect.appendChild(opt);
  });
}

async function loadProjectDetail(projId) {
  try {
    state.currentProject = await apiGet("get", { id: projId });
    el.projectSelect.value = projId;
    state.currentEpNum = state.currentProject.episodes && state.currentProject.episodes.length > 0 
      ? state.currentProject.episodes[0].num 
      : 1;

    renderStep1();
    renderStep2();
    renderStep3();
    setSaveStatus("저장됨");
  } catch (err) {
    console.error("프로젝트 상세 조회 실패:", err);
  }
}

function createNewProject() {
  const newId = "proj_" + Date.now();
  state.currentProject = {
    id: newId,
    title: "새 웹소설 프로젝트",
    genre: "현대 판타지 / 재벌·전문가물",
    keywords: "",
    idea: "",
    logline: "",
    world_rules: "",
    characters: [
      {
        id: "char_" + Date.now(),
        name: "주인공 (이름)",
        role: "주인공",
        trait: "냉철하고 빠른 판단력.",
        voice: "차분하고 절제된 어조.",
        secret: ""
      }
    ],
    episodes: [
      {
        num: 1,
        title: "제1화. 시작",
        goal: "주인공의 결핍과 첫 번째 기회 포착",
        plot: "",
        content: ""
      }
    ]
  };
  state.currentEpNum = 1;
  saveCurrentProject(true);
}

// ==========================================
// 2. Render Functions
// ==========================================

function renderStep1() {
  if (!state.currentProject) return;
  const p = state.currentProject;
  el.planTitle.value = p.title || "";
  el.planGenre.value = p.genre || "현대 판타지 / 재벌·전문가물";
  el.planKeywords.value = p.keywords || "";
  el.planIdea.value = p.idea || "";
  el.planLogline.value = p.logline || "";
  el.planWorldRules.value = p.world_rules || "";
}

function renderStep2() {
  if (!state.currentProject) return;
  el.characterList.innerHTML = "";
  const chars = state.currentProject.characters || [];

  chars.forEach(c => {
    const card = document.createElement("div");
    card.className = "char-card";
    
    let roleClass = "role-other";
    if (c.role.includes("주인공")) roleClass = "role-hero";
    else if (c.role.includes("악역") || c.role.includes("빌런")) roleClass = "role-villain";
    else if (c.role.includes("조력자") || c.role.includes("멘토")) roleClass = "role-helper";

    card.innerHTML = `
      <span class="char-card-role ${roleClass}">${escapeHtml(c.role)}</span>
      <h3 class="char-card-name">${escapeHtml(c.name)}</h3>
      <p class="char-card-desc">${escapeHtml(c.trait || "특징 없음")}</p>
      ${c.voice ? `<div class="char-card-voice">🗣️ "${escapeHtml(c.voice)}"</div>` : ""}
    `;
    card.addEventListener("click", () => openCharModal(c));
    el.characterList.appendChild(card);
  });
}

function renderStep3() {
  if (!state.currentProject) return;
  const episodes = state.currentProject.episodes || [];
  
  // 회차 목록 사이드바 렌더링
  el.episodeList.innerHTML = "";
  episodes.forEach(ep => {
    const li = document.createElement("li");
    li.className = `ep-nav-item ${ep.num === state.currentEpNum ? "active" : ""}`;
    li.textContent = ep.title || `제${ep.num}화`;
    li.addEventListener("click", () => selectEpisode(ep.num));
    el.episodeList.appendChild(li);
  });

  // 현재 회차 에디터 렌더링
  const curEp = episodes.find(e => e.num === state.currentEpNum) || episodes[0];
  if (curEp) {
    el.epTitleInput.value = curEp.title || `제${curEp.num}화`;
    el.epContentInput.value = curEp.content || "";
    el.epGoalInput.value = curEp.goal || "";
    el.epPlotInput.value = curEp.plot || "";
    updateCharacterCount();
  }
}

function selectEpisode(epNum) {
  saveCurrentEpisodeData();
  state.currentEpNum = epNum;
  renderStep3();
}

function saveCurrentEpisodeData() {
  if (!state.currentProject || !state.currentProject.episodes) return;
  const curEp = state.currentProject.episodes.find(e => e.num === state.currentEpNum);
  if (curEp) {
    curEp.title = el.epTitleInput.value;
    curEp.content = el.epContentInput.value;
    curEp.goal = el.epGoalInput.value;
    curEp.plot = el.epPlotInput.value;
  }
}

function updateCharacterCount() {
  const text = el.epContentInput.value || "";
  const withSpace = text.length;
  const withoutSpace = text.replace(/\s+/g, "").length;

  el.charCountWithSpace.textContent = withSpace.toLocaleString();
  el.charCountWithoutSpace.textContent = withoutSpace.toLocaleString();

  // 웹소설 표준 5,000자 기준 퍼센트 계산
  const target = 5000;
  const percent = Math.min(100, Math.round((withSpace / target) * 100));
  el.charProgressPercent.textContent = `${percent}%`;
  el.progressBar.style.width = `${percent}%`;

  if (withSpace >= 4500 && withSpace <= 5500) {
    el.progressBar.style.background = "linear-gradient(90deg, #10b981, #059669)"; // 달성 녹색
  } else if (withSpace > 5500) {
    el.progressBar.style.background = "linear-gradient(90deg, #f59e0b, #d97706)"; // 초과 주황
  } else {
    el.progressBar.style.background = "linear-gradient(90deg, #6366f1, #10b981)"; // 진행 중
  }
}

// ==========================================
// 3. Saving & Synchronization
// ==========================================

function syncStep1Inputs() {
  if (!state.currentProject) return;
  state.currentProject.title = el.planTitle.value;
  state.currentProject.genre = el.planGenre.value;
  state.currentProject.keywords = el.planKeywords.value;
  state.currentProject.idea = el.planIdea.value;
  state.currentProject.logline = el.planLogline.value;
  state.currentProject.world_rules = el.planWorldRules.value;
}

async function saveCurrentProject(reloadList = false) {
  if (!state.currentProject) return;
  syncStep1Inputs();
  saveCurrentEpisodeData();

  setSaveStatus("저장 중...");
  try {
    const data = await apiPost("save", { data: state.currentProject });
    if (data.success) {
      state.currentProject.id = data.id;
      setSaveStatus("저장됨");
      if (reloadList) {
        await loadProjects();
        el.projectSelect.value = state.currentProject.id;
      }
    }
  } catch (err) {
    setSaveStatus("저장 실패");
    console.error("저장 실패:", err);
  }
}

function triggerAutoSave() {
  setSaveStatus("수정됨...");
  if (state.saveTimeout) clearTimeout(state.saveTimeout);
  state.saveTimeout = setTimeout(() => {
    saveCurrentProject();
  }, 1500);
}

function setSaveStatus(text) {
  el.saveStatus.textContent = text;
}

// ==========================================
// 4. AI Engine Interaction
// ==========================================

async function requestAiTask(task, params = {}) {
  syncStep1Inputs();
  saveCurrentEpisodeData();

  const settings = await getSavedSettings();
  const directCall = Boolean(settings.api_key); // API 키가 있으면 직접 호출, 없으면 프롬프트 생성 모드

  el.aiOutputText.textContent = directCall 
    ? "✨ AI가 웹소설 특화 분석 및 생성을 진행 중입니다..." 
    : "프롬프트 구성 완료! 아래 [프롬프트 복사]를 눌러 무료 ChatGPT/Claude에 붙여넣으세요.";

  openModal(el.aiModal);

  try {
    const data = await apiPost("generate", {
      task: task,
      direct_call: directCall,
      project_data: state.currentProject,
      ...params
    });

    if (data.prompt) {
      el.aiPromptText.value = data.prompt;
    }

    if (directCall) {
      if (data.success && data.text) {
        el.aiOutputText.textContent = data.text;
      } else {
        el.aiOutputText.textContent = `❌ 오류 발생: ${data.error || "호출 실패"}\n\n[프롬프트 복사] 버튼을 눌러 웹에서 직접 사용해보세요.`;
      }
    } else {
      el.aiOutputText.textContent = "💡 API 키가 등록되지 않아 [프롬프트 자동 조립 모드]로 동작했습니다.\n\n아래 '📋 프롬프트 복사' 버튼을 눌러 무료 웹 ChatGPT나 Claude에 붙여넣으시면 최상의 웹소설 결과물을 얻으실 수 있습니다!";
    }

    return data;
  } catch (err) {
    el.aiOutputText.textContent = "통신 오류가 발생했습니다: " + err.message;
  }
}

// ==========================================
// 5. Event Bindings
// ==========================================

function bindEvents() {
  // Tab switching
  el.tabButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      el.tabButtons.forEach(b => b.classList.remove("active"));
      el.tabContents.forEach(c => c.classList.remove("active"));
      btn.classList.add("active");
      const tabId = btn.dataset.tab;
      document.getElementById(tabId).classList.add("active");
      state.activeTab = tabId;
      if (tabId === "tab-studio") {
        renderStep3();
      }
    });
  });

  // Project select & new
  el.projectSelect.addEventListener("change", (e) => loadProjectDetail(e.target.value));
  el.btnNewProject.addEventListener("click", () => {
    if (confirm("새 웹소설 프로젝트를 만드시겠습니까?")) {
      createNewProject();
    }
  });

  // Global save
  el.btnSaveAll.addEventListener("click", () => saveCurrentProject(true));

  // Input auto-save listeners
  const autoInputs = [
    el.planTitle, el.planGenre, el.planKeywords, el.planIdea, 
    el.planLogline, el.planWorldRules, el.epTitleInput, el.epGoalInput, el.epPlotInput
  ];
  autoInputs.forEach(input => {
    input.addEventListener("input", triggerAutoSave);
  });

  el.epContentInput.addEventListener("input", () => {
    updateCharacterCount();
    triggerAutoSave();
  });

  // Step 1: AI Logline
  el.btnAiLogline.addEventListener("click", async () => {
    el.aiModalTitle.textContent = "✨ AI 로그라인 3종 추천";
    state.pendingAiAction = (text) => {
      el.planLogline.value = text;
      triggerAutoSave();
    };
    await requestAiTask("logline", {
      genre: el.planGenre.value,
      keywords: el.planKeywords.value,
      idea: el.planIdea.value
    });
  });

  // Step 2: Character CRUD & AI
  el.btnAddCharacter.addEventListener("click", () => openCharModal());
  el.btnCancelCharModal.addEventListener("click", () => closeModal(el.charModal));
  el.btnCloseCharModal.addEventListener("click", () => closeModal(el.charModal));
  el.btnSaveChar.addEventListener("click", saveCharacterFromModal);
  el.btnDeleteChar.addEventListener("click", deleteCharacterFromModal);

  el.btnAiCharacter.addEventListener("click", async () => {
    const role = prompt("어떤 역할의 캐릭터를 추천받고 싶으신가요?\n(예: 주인공의 라이벌, 든든한 조력자, 비밀을 품은 악역)", "주인공의 라이벌");
    if (!role) return;
    el.aiModalTitle.textContent = `✨ AI 캐릭터 바이블 생성 (${role})`;
    state.pendingAiAction = (text) => {
      // 캐릭터 추가
      state.currentProject.characters.push({
        id: "char_" + Date.now(),
        name: `${role} (AI 추천)`,
        role: role,
        trait: text.slice(0, 300),
        voice: "",
        secret: ""
      });
      renderStep2();
      saveCurrentProject();
    };
    await requestAiTask("character", { char_role: role, user_request: "" });
  });

  // Step 3: Episodes
  el.btnAddEpisode.addEventListener("click", () => {
    const nextNum = (state.currentProject.episodes.length > 0) 
      ? Math.max(...state.currentProject.episodes.map(e => e.num)) + 1 
      : 1;
    state.currentProject.episodes.push({
      num: nextNum,
      title: `제${nextNum}화. 에피소드 제목`,
      goal: "",
      plot: "",
      content: ""
    });
    state.currentEpNum = nextNum;
    renderStep3();
    saveCurrentProject();
  });

  el.btnExportTxt.addEventListener("click", async () => {
    if (!state.currentProject) return;
    try {
      const url = new URL(API_BASE);
      url.searchParams.set("action", "export");
      url.searchParams.set("id", state.currentProject.id);
      url.searchParams.set("ep", state.currentEpNum);
      const res = await fetch(url.toString());
      const text = await res.text();
      const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `ep_${state.currentEpNum}.txt`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      alert("내보내기 실패: " + err.message);
    }
  });

  // Goal Refresh & AI Suggestion
  el.btnRefreshGoal.addEventListener("click", () => {
    saveCurrentEpisodeData();
    saveCurrentProject();
    showGoalSyncToast("✅ 목표/사건이 즉시 저장 및 플롯/AI에 반영되었습니다!");
  });

  el.btnAiSuggestGoal.addEventListener("click", async () => {
    el.aiModalTitle.textContent = `✨ 제${state.currentEpNum}화 핵심 목표/사건 추천 3선`;
    state.pendingAiAction = (text) => {
      el.epGoalInput.value = text;
      saveCurrentEpisodeData();
      saveCurrentProject();
      showGoalSyncToast("✅ AI 추천 목표가 반영되었습니다!");
    };
    await requestAiTask("suggest_goal", {
      episode_num: state.currentEpNum
    });
  });

  el.btnRefreshPlotFromGoal.addEventListener("click", () => {
    saveCurrentEpisodeData();
    el.btnAiPlot.click();
  });

  // AI Buttons in Studio
  el.btnAiPlot.addEventListener("click", async () => {
    el.aiModalTitle.textContent = `📐 제${state.currentEpNum}화 4단계 플롯 구성`;
    state.pendingAiAction = (text) => {
      el.epPlotInput.value = text;
      saveCurrentEpisodeData();
      triggerAutoSave();
    };
    await requestAiTask("plot", {
      episode_num: state.currentEpNum,
      episode_goal: el.epGoalInput.value
    });
  });

  el.btnAiDraft.addEventListener("click", async () => {
    el.aiModalTitle.textContent = `✍️ 제${state.currentEpNum}화 초안 작성`;
    state.pendingAiAction = (text) => {
      if (el.epContentInput.value.trim().length > 0) {
        el.epContentInput.value += "\n\n" + text;
      } else {
        el.epContentInput.value = text;
      }
      updateCharacterCount();
      saveCurrentEpisodeData();
      triggerAutoSave();
    };
    await requestAiTask("draft", {
      episode_num: state.currentEpNum,
      plot_outline: el.epPlotInput.value || el.epGoalInput.value
    });
  });

  el.btnAiPolish.addEventListener("click", async () => {
    const rawText = el.epContentInput.value;
    if (!rawText || rawText.trim().length < 10) {
      alert("윤문할 본문 내용이 너무 짧습니다. 먼저 원고를 작성해 주세요.");
      return;
    }
    el.aiModalTitle.textContent = `⚡ 웹소설 문체/사이다 강화 윤문`;
    state.pendingAiAction = (text) => {
      el.epContentInput.value = text;
      updateCharacterCount();
      saveCurrentEpisodeData();
      triggerAutoSave();
    };
    await requestAiTask("polish", { raw_text: rawText });
  });

  // AI Modal Actions
  el.btnCloseAiModal.addEventListener("click", () => closeModal(el.aiModal));
  el.btnCopyPrompt.addEventListener("click", () => {
    navigator.clipboard.writeText(el.aiPromptText.value);
    alert("📋 정밀 웹소설 프롬프트가 복사되었습니다! 무료 웹 ChatGPT/Claude에 붙여넣으세요.");
  });
  el.btnCopyOutput.addEventListener("click", () => {
    navigator.clipboard.writeText(el.aiOutputText.textContent);
    alert("📄 생성 결과가 클립보드에 복사되었습니다.");
  });
  el.btnApplyAiResult.addEventListener("click", () => {
    if (state.pendingAiAction) {
      const resultText = el.aiOutputText.textContent;
      state.pendingAiAction(resultText);
      closeModal(el.aiModal);
      alert("✅ 내용이 에디터에 적용되었습니다!");
    }
  });

  // Settings Modal
  el.btnOpenSettings.addEventListener("click", openSettingsModal);
  el.btnCloseSettingsModal.addEventListener("click", () => closeModal(el.settingsModal));
  el.btnCancelSettings.addEventListener("click", () => closeModal(el.settingsModal));
  el.btnSaveSettings.addEventListener("click", saveSettingsFromModal);
}

// ==========================================
// 6. Character Modal Logic
// ==========================================

function openCharModal(charObj = null) {
  if (charObj) {
    el.charModalTitle.textContent = "등장인물 수정";
    el.charId.value = charObj.id;
    el.charName.value = charObj.name || "";
    el.charRole.value = charObj.role || "주인공";
    el.charTrait.value = charObj.trait || "";
    el.charVoice.value = charObj.voice || "";
    el.charSecret.value = charObj.secret || "";
    el.btnDeleteChar.style.display = "inline-flex";
  } else {
    el.charModalTitle.textContent = "새 등장인물 등록";
    el.charId.value = "";
    el.charName.value = "";
    el.charRole.value = "주인공";
    el.charTrait.value = "";
    el.charVoice.value = "";
    el.charSecret.value = "";
    el.btnDeleteChar.style.display = "none";
  }
  openModal(el.charModal);
}

function saveCharacterFromModal() {
  const name = el.charName.value.trim();
  if (!name) {
    alert("인물 이름을 입력해 주세요.");
    return;
  }
  const id = el.charId.value || "char_" + Date.now();
  const charData = {
    id: id,
    name: name,
    role: el.charRole.value,
    trait: el.charTrait.value,
    voice: el.charVoice.value,
    secret: el.charSecret.value
  };

  const chars = state.currentProject.characters || [];
  const idx = chars.findIndex(c => c.id === id);
  if (idx >= 0) {
    chars[idx] = charData;
  } else {
    chars.push(charData);
  }
  state.currentProject.characters = chars;

  closeModal(el.charModal);
  renderStep2();
  saveCurrentProject();
}

function deleteCharacterFromModal() {
  const id = el.charId.value;
  if (!id) return;
  if (confirm("이 등장인물을 삭제하시겠습니까?")) {
    state.currentProject.characters = (state.currentProject.characters || []).filter(c => c.id !== id);
    closeModal(el.charModal);
    renderStep2();
    saveCurrentProject();
  }
}

// ==========================================
// 7. Settings Logic
// ==========================================

async function getSavedSettings() {
  try {
    return await apiGet("settings");
  } catch (err) {
    return {};
  }
}

async function openSettingsModal() {
  const settings = await getSavedSettings();
  el.settingApiType.value = settings.api_type || "anthropic";
  el.settingApiKey.value = settings.api_key || "";
  el.settingModelName.value = settings.model_name || "";
  openModal(el.settingsModal);
}

async function saveSettingsFromModal() {
  const settings = {
    api_type: el.settingApiType.value,
    api_key: el.settingApiKey.value.trim(),
    model_name: el.settingModelName.value.trim()
  };
  try {
    await apiPost("settings_save", { data: settings });
    closeModal(el.settingsModal);
    alert("설정이 저장되었습니다.");
  } catch (err) {
    alert("설정 저장 실패: " + err.message);
  }
}

// ==========================================
// 8. Utilities & Shortcuts
// ==========================================

function openModal(modal) {
  modal.classList.add("active");
}
function closeModal(modal) {
  modal.classList.remove("active");
}

function setupKeyboardShortcuts() {
  window.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
      e.preventDefault();
      saveCurrentProject(true);
    }
  });
}

let toastTimer = null;
function showGoalSyncToast(msg) {
  if (!el.goalSyncToast) return;
  el.goalSyncToast.textContent = msg;
  el.goalSyncToast.style.display = "block";
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.goalSyncToast.style.display = "none";
  }, 3000);
}

function escapeHtml(str) {
  if (!str) return "";
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Start
document.addEventListener("DOMContentLoaded", init);
