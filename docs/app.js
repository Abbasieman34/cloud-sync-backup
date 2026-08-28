const STORAGE_KEY = "vaultline-github-pages-demo-v1";

const seedState = {
  view: "overview",
  query: "",
  fileFilter: "all",
  activityFilter: "all",
  theme: "light",
  files: [
    { id: "f-brief", name: "Product brief.pdf", type: "pdf", sizeBytes: 2480000, updatedAt: "2026-08-28T08:42:00.000Z", versions: 12, encrypted: true },
    { id: "f-assets", name: "Brand assets", type: "folder", sizeBytes: 18400000, updatedAt: "2026-08-27T15:10:00.000Z", versions: 8, encrypted: true },
    { id: "f-export", name: "Q3 financial export.xlsx", type: "sheet", sizeBytes: 6800000, updatedAt: "2026-08-26T11:25:00.000Z", versions: 4, encrypted: true },
    { id: "f-archive", name: "Research archive.zip", type: "zip", sizeBytes: 42300000, updatedAt: "2026-08-24T17:03:00.000Z", versions: 19, encrypted: true },
  ],
  schedules: [
    { id: "s-daily", name: "Daily workspace snapshot", cron: "0 0 9 * * *", nextRun: "Tomorrow at 09:00 UTC", enabled: true },
    { id: "s-weekly", name: "Friday archive", cron: "0 30 16 * * 5", nextRun: "Fri, Aug 29 at 16:30 UTC", enabled: true },
  ],
  activity: [
    { id: "a-1", icon: "✓", tone: "green", title: "Encrypted snapshot completed", detail: "Product brief.pdf · version 12", time: "8 minutes ago", at: "2026-08-28T08:42:00.000Z" },
    { id: "a-2", icon: "↟", tone: "", title: "New file protected", detail: "Research archive.zip · 42.3 MB", time: "Yesterday at 17:03", at: "2026-08-27T17:03:00.000Z" },
    { id: "a-3", icon: "◷", tone: "orange", title: "Schedule updated", detail: "Daily workspace snapshot · active", time: "Yesterday at 09:14", at: "2026-08-27T09:14:00.000Z" },
    { id: "a-4", icon: "↺", tone: "green", title: "Version restored", detail: "Brand assets · version 7", time: "Aug 25 at 13:28", at: "2026-08-25T13:28:00.000Z" },
  ],
  lastSync: "8 minutes ago",
  pairing: null,
};

let state = loadState();
const app = document.querySelector("#app");
const modalRoot = document.querySelector("#modal-root");
const toastRoot = document.querySelector("#toast-root");
const pageNames = { overview: "Overview", files: "Files", schedules: "Schedules", companion: "Local sync", activity: "Activity", settings: "Settings" };

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && saved.files && saved.schedules && saved.activity) return { ...seedState, ...saved };
  } catch { /* A fresh browser session is a valid starting point. */ }
  return structuredClone(seedState);
}

function saveState() {
  const safeState = { ...state, pairing: null };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(safeState));
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);
}

function formatBytes(bytes) {
  if (bytes < 1000) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1000;
  let unit = units[0];
  for (let index = 1; value >= 1000 && index < units.length; index += 1) { value /= 1000; unit = units[index]; }
  return `${value.toFixed(value >= 10 ? 1 : 2)} ${unit}`;
}

function formatDate(iso) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(iso));
}

function totalBytes() { return state.files.reduce((sum, file) => sum + file.sizeBytes, 0); }
function makeId(prefix) { return `${prefix}-${crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : Date.now()}`; }
function fileLabel(file) { return file.type === "folder" ? "Folder" : file.type === "sheet" ? "Spreadsheet" : file.type.toUpperCase(); }
function filteredFiles() {
  const query = state.query.trim().toLowerCase();
  const matching = state.files.filter(file => !query || file.name.toLowerCase().includes(query));
  if (state.fileFilter === "recent") {
    return matching.filter(file => Date.now() - new Date(file.updatedAt).getTime() < 30 * 24 * 60 * 60 * 1000);
  }
  return matching;
}
function filteredActivity() {
  if (state.activityFilter === "all") return state.activity;
  return state.activity.filter(item => item.tone === state.activityFilter);
}

function render() {
  document.documentElement.dataset.theme = state.theme === "dark" ? "dark" : "light";
  const title = pageNames[state.view] || "Overview";
  document.querySelector("#breadcrumb-title").textContent = title;
  document.querySelector("#files-count").textContent = state.files.length;
  document.querySelector("#global-search").value = state.query;
  document.querySelectorAll("[data-nav]").forEach(button => button.classList.toggle("is-active", button.dataset.nav === state.view));
  app.innerHTML = ({
    overview: renderOverview,
    files: renderFiles,
    schedules: renderSchedules,
    companion: renderCompanion,
    activity: renderActivity,
    settings: renderSettings,
  }[state.view] || renderOverview)();
  saveState();
}

function renderHeading(eyebrow, title, description, actions = "") {
  return `<div class="page-heading"><div><p class="eyebrow">${eyebrow}</p><h1>${title}</h1><p>${description}</p></div>${actions ? `<div class="heading-actions">${actions}</div>` : ""}</div>`;
}

function renderOverview() {
  const activity = state.activity.slice(0, 3);
  const bars = [58, 42, 74, 52, 85, 67, 92];
  return `${renderHeading("Your secure workspace", "Good morning, Abasi", "Everything important is protected, versioned, and ready when you need it.", `<button class="button secondary" data-action="browse-files"><span class="button-icon">＋</span> Add files</button><button class="button" data-action="backup-now"><span class="button-icon">↻</span> Run backup</button>`)}
    <div class="stat-grid">
      <article class="card stat-card"><div class="stat-card-top"><p class="stat-label">Protected files</p><span class="stat-icon">▣</span></div><div class="stat-value">${state.files.length}</div><div class="stat-foot positive"><strong>+2</strong> this month</div></article>
      <article class="card stat-card"><div class="stat-card-top"><p class="stat-label">Encrypted storage</p><span class="stat-icon">◈</span></div><div class="stat-value">${formatBytes(totalBytes())}</div><div class="stat-foot">of 100 GB workspace</div></article>
      <article class="card stat-card"><div class="stat-card-top"><p class="stat-label">Latest snapshot</p><span class="stat-icon">↻</span></div><div class="stat-value">${state.lastSync}</div><div class="stat-foot positive"><strong>Successful</strong></div></article>
      <article class="card stat-card"><div class="stat-card-top"><p class="stat-label">Vault health</p><span class="stat-icon">♢</span></div><div class="stat-value">100%</div><div class="stat-foot positive"><strong>All checks passed</strong></div></article>
    </div>
    <div class="overview-grid">
      <section class="card"><div class="panel-heading"><div><h2>Backup activity</h2><p>Encrypted operations over the last 7 days</p></div><button class="panel-link" data-nav="activity">View all</button></div><div class="chart-wrap"><div class="chart-legend"><strong>${state.files.length * 3 + 8} snapshots</strong><span>Last 7 days</span></div><div class="chart">${bars.map((height, index) => `<div class="chart-column"><div class="chart-bar ${index === bars.length - 1 ? "is-today" : ""}" style="height:${height}%"></div><span>${["Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri"][index]}</span></div>`).join("")}</div></div></section>
      <section class="card"><div class="panel-heading"><div><h2>Vault health</h2><p>Live protection checks</p></div><span class="paired-badge">Healthy</span></div><div class="health-body"><div class="health-score"><div class="health-ring"></div><div class="health-copy"><strong>Everything looks good</strong><span>Last checked just now</span></div></div><div class="health-list"><div class="health-item"><span>Encryption key</span><strong>Ready</strong></div><div class="health-item"><span>Local companion</span><strong>Connected</strong></div><div class="health-item"><span>Backup schedules</span><strong>On track</strong></div></div></div></section>
    </div>
    <section class="card activity-panel"><div class="panel-heading"><div><h2>Recent operations</h2><p>A live view of backup, sync, restore, and schedule activity.</p></div><button class="panel-link" data-nav="activity">View activity</button></div>${activity.length ? activity.map(renderActivityRow).join("") : renderEmpty("No operations yet", "Add your first file to create an encrypted local snapshot.")}</section>`;
}

function renderActivityRow(item) {
  return `<div class="activity-row"><div class="activity-badge ${escapeHtml(item.tone)}">${escapeHtml(item.icon)}</div><div class="activity-main"><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.detail)}</span></div><span class="activity-time">${escapeHtml(item.time)}</span></div>`;
}

function renderEmpty(title, message) { return `<div class="empty-state"><strong>${escapeHtml(title)}</strong><p>${escapeHtml(message)}</p></div>`; }

function renderFileTable() {
  const files = filteredFiles();
  return `<section class="card file-table"><div class="table-head"><span>Name</span><span>Size</span><span>Last protected</span><span></span></div>${files.length ? files.map(file => `<div class="file-row"><div class="file-name"><span class="file-type ${file.type === "pdf" ? "pdf" : file.type === "zip" ? "zip" : ""}">${fileLabel(file)}</span><div class="file-name-copy"><strong>${escapeHtml(file.name)}</strong><span>Encrypted · ${file.versions} versions</span></div></div><span class="table-muted">${formatBytes(file.sizeBytes)}</span><span class="table-muted">${formatDate(file.updatedAt)}</span><div class="row-actions"><button class="row-action" data-file-action="restore" data-file-id="${file.id}" aria-label="Restore ${escapeHtml(file.name)}">↺</button><button class="row-action delete" data-file-action="delete" data-file-id="${file.id}" aria-label="Remove ${escapeHtml(file.name)}">×</button></div></div>`).join("") : renderEmpty("No matching files", "Try a different search or protect a new file.")}</section>`;
}

function renderFiles() {
  return `${renderHeading("Managed content", "Your files", "Every file is encrypted in this browser before it becomes part of your workspace.", `<button class="button" data-action="browse-files"><span class="button-icon">＋</span> Protect files</button>`)}
    <div class="toolbar"><div class="filter-tabs"><button class="filter-tab ${state.fileFilter === "all" ? "is-active" : ""}" data-file-filter="all">All files</button><button class="filter-tab ${state.fileFilter === "recent" ? "is-active" : ""}" data-file-filter="recent">Recently added</button></div><label class="inline-search"><span>⌕</span><input data-file-search type="search" value="${escapeHtml(state.query)}" placeholder="Filter files" /></label></div>
    ${renderFileTable()}`;
}

function renderSchedules() {
  return `${renderHeading("Automation", "Backup schedules", "Create user-managed, UTC cron schedules for encrypted snapshots.", `<button class="button" data-action="new-schedule"><span class="button-icon">＋</span> New schedule</button>`)}
    <div class="schedule-grid">${state.schedules.length ? state.schedules.map(schedule => `<article class="card schedule-card"><div class="schedule-top"><span class="schedule-icon">◷</span><div class="schedule-copy"><h3>${escapeHtml(schedule.name)}</h3><p>${escapeHtml(schedule.cron)} UTC</p></div><span class="paired-badge" style="${schedule.enabled ? "" : "color:#788796;background:#f1f3f5"}">${schedule.enabled ? "Active" : "Paused"}</span></div><div class="schedule-actions"><span class="schedule-next">${schedule.enabled ? `Next: ${escapeHtml(schedule.nextRun)}` : "No upcoming snapshot"}</span><div><button class="switch ${schedule.enabled ? "is-on" : ""}" data-schedule-toggle="${schedule.id}" aria-label="${schedule.enabled ? "Pause" : "Resume"} ${escapeHtml(schedule.name)}"></button><button class="schedule-delete" data-schedule-delete="${schedule.id}" aria-label="Delete ${escapeHtml(schedule.name)}">×</button></div></div></article>`).join("") : renderEmpty("No schedules configured", "Create a schedule to keep important files protected automatically.")}</div>`;
}

function renderCompanion() {
  const pairing = state.pairing;
  return `${renderHeading("Zero-knowledge sync", "Local sync companion", "Keep a folder on your computer synchronized without giving the server access to your plaintext files.")}
    <section class="card companion-card"><div class="companion-intro"><p class="eyebrow">Vaultline companion</p><h2>Protect a folder, not just a file.</h2><p>The local companion encrypts file contents with a device-specific AES-256-GCM key before any network transfer. Your plaintext stays on your machine.</p><ul class="feature-list"><li>Client-side encryption before transfer</li><li>Watch mode for hands-off protection</li><li>Restore any immutable version</li></ul></div><div class="companion-setup"><div class="setup-heading"><div><h3>Pair a local device</h3><p>Generate a one-time pairing file for the companion.</p></div>${pairing ? '<span class="paired-badge">Device ready</span>' : ""}</div><div class="setup-steps"><div class="setup-step"><span class="step-number">1</span><div class="step-copy"><strong>Generate a pairing file</strong><span>It contains a device token and encryption key for this demo workspace.</span></div></div><div class="setup-step"><span class="step-number">2</span><div class="step-copy"><strong>Run the companion configure command</strong><span>Choose the folder you want to protect on your computer.</span></div></div><div class="setup-step"><span class="step-number">3</span><div class="step-copy"><strong>Start watch mode</strong><span>New and changed files are encrypted before sync.</span></div></div></div>${pairing ? `<div class="pairing-box"><code>${escapeHtml(pairing.deviceId)} · ${escapeHtml(pairing.token.slice(0, 18))}…</code><div class="pairing-actions"><button class="button secondary" data-action="copy-pairing">Copy token</button><button class="button secondary" data-action="download-pairing">Download JSON</button></div></div>` : `<button class="button" style="margin-top:20px" data-action="pair-device">Generate pairing file</button>`}</div></section>`;
}

function renderActivity() {
  const items = filteredActivity();
  return `${renderHeading("Audit trail", "Activity", "A timestamped record of every protected, restored, and scheduled operation.")}
    <div class="toolbar"><div class="filter-tabs"><button class="filter-tab ${state.activityFilter === "all" ? "is-active" : ""}" data-activity-filter="all">All events</button><button class="filter-tab ${state.activityFilter === "green" ? "is-active" : ""}" data-activity-filter="green">Successful</button><button class="filter-tab ${state.activityFilter === "orange" ? "is-active" : ""}" data-activity-filter="orange">Schedules</button></div><select class="activity-filter" data-activity-select aria-label="Filter activity"><option value="all" ${state.activityFilter === "all" ? "selected" : ""}>All operations</option><option value="green" ${state.activityFilter === "green" ? "selected" : ""}>Successful</option><option value="orange" ${state.activityFilter === "orange" ? "selected" : ""}>Schedules</option></select></div>
    <section class="card activity-list-panel">${items.length ? items.map(item => `${renderActivityRow(item)}<div class="activity-detail" style="display:none">${escapeHtml(item.at)}</div>`).join("") : renderEmpty("No events in this view", "Successful operations will appear here as you use the demo.")}</section>`;
}

function renderSettings() {
  return `${renderHeading("Workspace controls", "Settings", "Tune this browser-only demo workspace. No credentials or files leave this device.")}
    <div class="settings-grid"><nav class="card settings-nav" aria-label="Settings sections"><button class="is-active">Workspace</button><button>Security & encryption</button><button>Notifications</button><button>About Vaultline</button></nav><section class="card settings-panel"><div class="setting-row"><div class="setting-copy"><strong>Theme</strong><span>Choose the appearance for this workspace.</span></div><div class="theme-options"><button class="theme-option ${state.theme === "light" ? "is-active" : ""}" data-theme-choice="light">Light</button><button class="theme-option ${state.theme === "dark" ? "is-active" : ""}" data-theme-choice="dark">Dark</button></div></div><div class="setting-row"><div class="setting-copy"><strong>Browser notifications</strong><span>Show a small confirmation when a local operation finishes.</span></div><button class="toggle-button is-on" data-action="noop" aria-label="Browser notifications enabled"></button></div><div class="setting-row"><div class="setting-copy"><strong>Demo data</strong><span>Reset the sample files, schedules, and audit history stored in localStorage.</span></div><button class="button danger" data-action="reset-demo">Reset workspace</button></div><div class="setting-row"><div class="setting-copy"><strong>Privacy model</strong><span>GitHub Pages serves only static files. This demo stores metadata in localStorage and never sends it to a backend.</span></div><span class="paired-badge">Local only</span></div></section></div>`;
}

function addActivity(title, detail, tone = "green", icon = "✓") {
  state.activity.unshift({ id: makeId("a"), icon, tone, title, detail, time: "Just now", at: new Date().toISOString() });
  state.activity = state.activity.slice(0, 40);
}

function toast(title, message, type = "success") {
  const node = document.createElement("div");
  node.className = `toast ${type === "error" ? "error" : ""}`;
  node.innerHTML = `<div>${type === "error" ? "!" : "✓"}</div><div><strong>${escapeHtml(title)}</strong><span>${escapeHtml(message)}</span></div>`;
  toastRoot.appendChild(node);
  window.setTimeout(() => node.remove(), 4200);
}

function openScheduleModal() {
  modalRoot.innerHTML = `<div class="modal-backdrop" data-action="close-modal"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="schedule-modal-title" data-modal-card><div class="modal-header"><div><h2 id="schedule-modal-title">Create backup schedule</h2><p>Schedules use six-field UTC cron expressions. Seconds must be set to 0.</p></div><button class="modal-close" data-action="close-modal" aria-label="Close dialog">×</button></div><form class="modal-form" id="schedule-form"><div class="form-field"><label for="schedule-name">Name</label><input id="schedule-name" name="name" required maxlength="60" placeholder="Daily project archive" /></div><div class="form-field"><label for="schedule-cron">Cron expression</label><input id="schedule-cron" name="cron" required value="0 0 9 * * *" class="mono" /><p class="form-hint">Example: 0 0 9 * * * runs daily at 09:00 UTC.</p></div><div class="modal-actions"><button type="button" class="button secondary" data-action="close-modal">Cancel</button><button class="button" type="submit">Create schedule</button></div></form></section></div>`;
  document.querySelector("#schedule-name").focus();
}

function handleUpload(fileList) {
  const files = [...fileList];
  if (!files.length) return;
  toast("Protecting files", "Calculating fingerprints and preparing local encryption…");
  Promise.all(files.map(async file => {
    const buffer = await file.arrayBuffer();
    const hash = await crypto.subtle.digest("SHA-256", buffer);
    const fingerprint = [...new Uint8Array(hash)].slice(0, 4).map(byte => byte.toString(16).padStart(2, "0")).join("");
    return { id: makeId("f"), name: file.name, type: file.name.toLowerCase().endsWith(".pdf") ? "pdf" : file.name.toLowerCase().endsWith(".zip") ? "zip" : file.name.toLowerCase().endsWith(".xlsx") ? "sheet" : "file", sizeBytes: file.size, updatedAt: new Date().toISOString(), versions: 1, encrypted: true, fingerprint };
  })).then(newFiles => {
    state.files = [...newFiles, ...state.files];
    state.lastSync = "Just now";
    newFiles.forEach(file => addActivity("New file protected", `${file.name} · ${formatBytes(file.sizeBytes)}`, "green", "↟"));
    saveState();
    state.view = "files";
    render();
    toast("Files protected", `${newFiles.length} file${newFiles.length === 1 ? " is" : "s are"} encrypted in this browser.`);
  }).catch(() => toast("Could not protect files", "Your browser could not read one of the selected files.", "error"));
}

function runBackup() {
  state.lastSync = "Just now";
  addActivity("Encrypted snapshot completed", `${state.files.length} managed files · browser-local demo`, "green", "✓");
  render();
  toast("Backup complete", `${state.files.length} file${state.files.length === 1 ? " is" : "s are"} protected with a new local snapshot.`);
}

function generatePairing() {
  state.pairing = { deviceId: `vaultline-${Math.random().toString(36).slice(2, 8)}`, token: crypto.randomUUID ? crypto.randomUUID().replaceAll("-", "") : `${Date.now()}-${Math.random()}`, createdAt: new Date().toISOString() };
  render();
  toast("Pairing file ready", "This demo keeps the generated token in memory only.");
}

function downloadPairing() {
  if (!state.pairing) return;
  const pairing = { version: 1, deviceId: state.pairing.deviceId, deviceToken: state.pairing.token, generatedAt: state.pairing.createdAt, note: "Demo pairing file. Keep device credentials private." };
  const blob = new Blob([JSON.stringify(pairing, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob); link.download = "vaultline-pairing.json"; link.click(); URL.revokeObjectURL(link.href);
  toast("Pairing JSON downloaded", "Store it securely on the machine you want to pair.");
}

function closeModal() { modalRoot.innerHTML = ""; }

// Navigation and interactive controls are delegated so every rendered view stays lightweight.
document.addEventListener("click", event => {
  const nav = event.target.closest("[data-nav]");
  if (nav) { state.view = nav.dataset.nav; document.querySelector("#sidebar").classList.remove("is-open"); document.querySelector("#mobile-backdrop").classList.remove("is-open"); render(); return; }
  const action = event.target.closest("[data-action]");
  if (action) {
    const type = action.dataset.action;
    if (type === "browse-files") document.querySelector("#file-picker").click();
    if (type === "backup-now") runBackup();
    if (type === "new-schedule") openScheduleModal();
    if (type === "close-modal" && !event.target.closest("[data-modal-card]") || type === "close-modal" && event.target.closest(".modal-close")) closeModal();
    if (type === "notifications") toast("You are all caught up", "No new workspace notifications.");
    if (type === "pair-device") generatePairing();
    if (type === "download-pairing") downloadPairing();
    if (type === "copy-pairing" && state.pairing) {
      if (navigator.clipboard) navigator.clipboard.writeText(state.pairing.token).then(() => toast("Token copied", "The device token is ready to paste into your local setup."));
      else toast("Copy unavailable", "Your browser does not expose clipboard access here.", "error");
    }
    if (type === "reset-demo") { state = structuredClone(seedState); render(); toast("Workspace reset", "The sample Vaultline data is back."); }
  }
  const fileFilter = event.target.closest("[data-file-filter]");
  if (fileFilter) { state.fileFilter = fileFilter.dataset.fileFilter; render(); }
  const activityFilter = event.target.closest("[data-activity-filter]");
  if (activityFilter) { state.activityFilter = activityFilter.dataset.activityFilter; render(); }
  const themeChoice = event.target.closest("[data-theme-choice]");
  if (themeChoice) { state.theme = themeChoice.dataset.themeChoice; render(); }
  const toggle = event.target.closest("[data-schedule-toggle]");
  if (toggle) { const schedule = state.schedules.find(item => item.id === toggle.dataset.scheduleToggle); if (schedule) { schedule.enabled = !schedule.enabled; addActivity("Schedule updated", `${schedule.name} · ${schedule.enabled ? "active" : "paused"}`, "orange", "◷"); render(); toast(schedule.enabled ? "Schedule resumed" : "Schedule paused", schedule.name); } }
  const removeSchedule = event.target.closest("[data-schedule-delete]");
  if (removeSchedule) { const schedule = state.schedules.find(item => item.id === removeSchedule.dataset.scheduleDelete); if (schedule && confirm(`Delete ${schedule.name}?`)) { state.schedules = state.schedules.filter(item => item.id !== schedule.id); addActivity("Schedule removed", schedule.name, "orange", "×"); render(); toast("Schedule removed", "No further snapshots will be created by it."); } }
  const fileAction = event.target.closest("[data-file-action]");
  if (fileAction) { const file = state.files.find(item => item.id === fileAction.dataset.fileId); if (!file) return; if (fileAction.dataset.fileAction === "restore") { addActivity("Version restored", `${file.name} · latest version`, "green", "↺"); render(); toast("Restore prepared", `${file.name} is ready to restore locally.`); } if (fileAction.dataset.fileAction === "delete" && confirm(`Remove ${file.name} from this demo workspace?`)) { state.files = state.files.filter(item => item.id !== file.id); addActivity("File removed", file.name, "orange", "×"); render(); toast("File removed", "The file metadata was deleted from this browser."); } }
});

document.addEventListener("input", event => {
  if (event.target.id === "global-search") {
    state.query = event.target.value;
    if (state.view !== "files") { state.view = "files"; render(); }
    else { document.querySelector(".file-table")?.replaceWith(htmlToElement(renderFileTable())); }
  }
  if (event.target.matches("[data-file-search]")) {
    state.query = event.target.value;
    document.querySelector(".file-table")?.replaceWith(htmlToElement(renderFileTable()));
  }
});

function htmlToElement(html) {
  const template = document.createElement("template");
  template.innerHTML = html.trim();
  return template.content.firstElementChild;
}
document.addEventListener("change", event => {
  if (event.target.id === "file-picker") { handleUpload(event.target.files); event.target.value = ""; }
  if (event.target.matches("[data-activity-select]")) { state.activityFilter = event.target.value; render(); }
});
document.addEventListener("submit", event => {
  if (event.target.id !== "schedule-form") return;
  event.preventDefault();
  const form = new FormData(event.target);
  const name = String(form.get("name") || "").trim();
  const cron = String(form.get("cron") || "").trim();
  if (!name || !cron) return;
  state.schedules.push({ id: makeId("s"), name, cron, nextRun: "Awaiting next run", enabled: true });
  addActivity("Schedule created", `${name} · active`, "orange", "◷");
  closeModal(); render(); toast("Schedule created", "Your encrypted backup cadence is now configured.");
});

document.querySelector("#menu-toggle").addEventListener("click", () => { document.querySelector("#sidebar").classList.add("is-open"); document.querySelector("#mobile-backdrop").classList.add("is-open"); });
document.querySelector("#mobile-backdrop").addEventListener("click", () => { document.querySelector("#sidebar").classList.remove("is-open"); document.querySelector("#mobile-backdrop").classList.remove("is-open"); });
document.addEventListener("keydown", event => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); document.querySelector("#global-search").focus(); } if (event.key === "Escape") closeModal(); });

render();
