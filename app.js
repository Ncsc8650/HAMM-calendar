import {ZONE, CALENDAR_ID, dayKey, keyOf, monthBounds, category, groupEvents} from "./calendar-logic.js";

const $ = id => document.getElementById(id);
let today = dayKey(new Date());
const state = {
  year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) - 1,
  selected: today, events: [], byDay: new Map(), filter: "all",
  token: null, tokenClient: null, clientId: "", connected: false, loading: false, request: 0
};
const thaiDate = new Intl.DateTimeFormat("th-TH", {timeZone: ZONE, day: "numeric", month: "long", year: "numeric"});
const thaiMonth = new Intl.DateTimeFormat("th-TH", {timeZone: ZONE, month: "long", year: "numeric"});
const thaiTime = new Intl.DateTimeFormat("th-TH", {timeZone: ZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23"});
const atNoon = key => new Date(`${key}T12:00:00+07:00`);

function notice(message, error = false) {
  $("notice").textContent = message;
  $("notice").classList.toggle("error", error);
  $("notice").hidden = !message;
}

function storedClientId() {
  try { return localStorage.getItem("hamm-calendar-client-id") || ""; } catch { return ""; }
}

function saveClientId(value) {
  try { localStorage.setItem("hamm-calendar-client-id", value); } catch { /* storage may be disabled */ }
}

function showSettings() {
  $("client-id").value = state.clientId || storedClientId();
  $("settings-dialog").showModal();
}

function updateConnection() {
  $("sidebar-source-status").textContent = state.connected ? CALENDAR_ID : "ยังไม่เชื่อมต่อ";
  $("source-dot").classList.toggle("connected", state.connected);
  $("hero-kicker").textContent = state.connected ? "เชื่อมต่อ Google Calendar แล้ว" : "กำลังรอการเชื่อมต่อ";
  $("hero-title").innerHTML = state.connected ? "ภาพรวมงาน<br/><em>พร้อมใช้งาน</em>" : "ทุกกำหนดการ<br/><em>อยู่ในสายตา</em>";
  $("hero-description").textContent = state.connected ? "ข้อมูลอัปเดตจากปฏิทินหลักของ ditsadon8650@gmail.com โดยตรง เลือกวันหรือเลื่อนเดือนเพื่อดูงาน" : "เชื่อมบัญชี Google เพื่อดูงานประจำวันและแผนงานตลอดเดือน ข้อมูลจะอัปเดตจากปฏิทินโดยตรง";
  $("hero-action").innerHTML = state.connected ? 'รีเฟรชข้อมูล <span aria-hidden="true">↗</span>' : 'เริ่มเชื่อมต่อ <span aria-hidden="true">↗</span>';
  $("connect-button").textContent = state.connected ? "↻  รีเฟรชข้อมูล" : "↗  เชื่อม Google Calendar";
}

async function apiJson(url, token) {
  const response = await fetch(url, {headers: {Authorization: `Bearer ${token}`}});
  if (!response.ok) {
    let detail = "";
    try { detail = (await response.json()).error?.message || ""; } catch { /* generic status below */ }
    const error = new Error(detail || `Google API ตอบกลับ HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return response.json();
}

async function connect() {
  const clientId = ($("client-id").value || state.clientId || storedClientId()).trim();
  if (!/^\d+-[\w-]+\.apps\.googleusercontent\.com$/.test(clientId)) {
    notice("กรุณากรอก OAuth Client ID ของเว็บให้ถูกต้องก่อนเชื่อมต่อ", true);
    showSettings();
    return;
  }
  if (!window.google?.accounts?.oauth2) {
    notice("ยังโหลด Google Identity Services ไม่สำเร็จ กรุณาตรวจอินเทอร์เน็ตแล้วลองอีกครั้ง", true);
    return;
  }
  state.clientId = clientId;
  saveClientId(clientId);
  $("settings-dialog").close();
  notice("");
  state.tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: "openid email https://www.googleapis.com/auth/calendar.readonly",
    callback: async response => {
      if (response.error || !response.access_token) {
        notice("การอนุญาต Google ไม่สำเร็จ: " + (response.error || "ไม่ได้รับ access token"), true);
        return;
      }
      try {
        const profile = await apiJson("https://www.googleapis.com/oauth2/v3/userinfo", response.access_token);
        if (profile.email?.toLowerCase() !== CALENDAR_ID || profile.email_verified === false) {
          google.accounts.oauth2.revoke(response.access_token, () => {});
          notice(`บัญชีที่เลือกไม่ตรงกับ ${CALENDAR_ID} กรุณาเลือกบัญชีนี้แล้วเชื่อมอีกครั้ง`, true);
          return;
        }
        state.token = response.access_token;
        state.connected = true;
        updateConnection();
        await loadMonth();
      } catch (error) {
        notice("ตรวจบัญชี Google ไม่สำเร็จ: " + error.message, true);
      }
    },
    error_callback: () => notice("เปิดหน้าต่าง Google ไม่สำเร็จ กรุณาอนุญาต pop-up แล้วลองอีกครั้ง", true)
  });
  state.tokenClient.requestAccessToken({prompt: "select_account"});
}

async function loadMonth() {
  if (!state.connected) { render(); return; }
  const request = ++state.request;
  state.loading = true;
  state.events = [];
  state.byDay = new Map();
  render();
  notice("");
  try {
    const bounds = monthBounds(state.year, state.month);
    const base = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID)}/events`;
    let pageToken = "";
    let events = [];
    do {
      const params = new URLSearchParams({...bounds, singleEvents: "true", orderBy: "startTime", showDeleted: "false", maxResults: "2500", timeZone: ZONE});
      if (pageToken) params.set("pageToken", pageToken);
      const result = await apiJson(`${base}?${params}`, state.token);
      if (request !== state.request) return;
      events.push(...(result.items || []));
      pageToken = result.nextPageToken || "";
    } while (pageToken);
    if (request !== state.request) return;
    state.events = events;
    state.byDay = groupEvents(events, state.year, state.month);
  } catch (error) {
    if (request !== state.request) return;
    if (error.status === 401) {
      state.connected = false;
      state.token = null;
      updateConnection();
      notice("สิทธิ์การเชื่อมต่อหมดอายุ กรุณากดเชื่อม Google Calendar อีกครั้ง", true);
    } else {
      notice("โหลดปฏิทินไม่สำเร็จ: " + error.message, true);
    }
  } finally {
    if (request === state.request) { state.loading = false; render(); }
  }
}

function moveMonth(delta) {
  const date = new Date(Date.UTC(state.year, state.month + delta, 1));
  state.year = date.getUTCFullYear();
  state.month = date.getUTCMonth();
  state.selected = keyOf(state.year, state.month, 1);
  loadMonth();
}

function render() {
  $("top-today").textContent = thaiDate.format(atNoon(today));
  $("month-heading").textContent = thaiMonth.format(atNoon(keyOf(state.year, state.month, 1)));
  $("agenda-date").textContent = thaiDate.format(atNoon(state.selected));
  const currentMonth = today.slice(0, 7) === keyOf(state.year, state.month, 1).slice(0, 7);
  $("stat-month").textContent = state.connected && !state.loading ? state.events.length.toLocaleString("th-TH") : "—";
  $("stat-today").textContent = state.connected && !state.loading && currentMonth ? (state.byDay.get(today)?.length || 0).toLocaleString("th-TH") : "—";
  const weekEnd = new Date(`${today}T00:00:00Z`);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);
  const nextSeven = state.events.filter(e => {
    const first = e.start?.date || (e.start?.dateTime && dayKey(new Date(e.start.dateTime)));
    return first >= today && first < weekEnd.toISOString().slice(0, 10);
  }).length;
  $("stat-upcoming").textContent = state.connected && !state.loading && currentMonth ? nextSeven.toLocaleString("th-TH") : "—";
  renderCalendar();
  renderAgenda();
}

function renderCalendar() {
  const grid = $("calendar-grid");
  grid.replaceChildren();
  const firstDay = new Date(Date.UTC(state.year, state.month, 1)).getUTCDay();
  const monthDays = new Date(Date.UTC(state.year, state.month + 1, 0)).getUTCDate();
  const rows = Math.ceil((firstDay + monthDays) / 7);
  for (let index = 0; index < rows * 7; index++) {
    const date = new Date(Date.UTC(state.year, state.month, index - firstDay + 1));
    const key = keyOf(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
    const inMonth = date.getUTCMonth() === state.month;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "day-cell" + (!inMonth ? " outside" : "") + (key === today ? " today" : "") + (key === state.selected ? " selected" : "");
    button.setAttribute("role", "gridcell");
    button.setAttribute("aria-label", thaiDate.format(atNoon(key)) + (inMonth ? `, ${state.byDay.get(key)?.length || 0} รายการ` : ""));
    button.setAttribute("aria-selected", String(key === state.selected));
    const number = document.createElement("span");
    number.className = "day-number";
    number.textContent = date.getUTCDate();
    button.append(number);
    if (inMonth) {
      const events = state.byDay.get(key) || [];
      const dots = document.createElement("span");
      dots.className = "day-dots";
      events.slice(0, 3).forEach(event => {
        const dot = document.createElement("i");
        dot.className = category(event);
        dots.append(dot);
      });
      button.append(dots);
      if (events.length > 3) {
        const more = document.createElement("span");
        more.className = "day-more";
        more.textContent = `+${events.length - 3}`;
        button.append(more);
      }
    }
    button.addEventListener("click", () => {
      if (!inMonth) {
        state.year = date.getUTCFullYear();
        state.month = date.getUTCMonth();
        state.selected = key;
        loadMonth();
      } else {
        state.selected = key;
        render();
      }
    });
    grid.append(button);
  }
}

function renderAgenda() {
  const list = $("agenda-list");
  list.replaceChildren();
  const search = $("event-search").value.trim().toLocaleLowerCase();
  const all = state.byDay.get(state.selected) || [];
  const events = all.filter(event => (state.filter === "all" || category(event) === state.filter) && (event.summary || "").toLocaleLowerCase().includes(search));
  $("agenda-count").textContent = `${events.length.toLocaleString("th-TH")} รายการ`;
  if (!events.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    const icon = document.createElement("span");
    icon.className = "empty-icon";
    icon.textContent = state.loading ? "◌" : "▦";
    const title = document.createElement("strong");
    title.textContent = state.loading ? "กำลังโหลดข้อมูล..." : !state.connected ? "เชื่อมบัญชีเพื่อดูรายการงาน" : search || state.filter !== "all" ? "ไม่พบรายการที่ตรงกับการค้นหา" : "ไม่มีรายการในวันนี้";
    const sub = document.createElement("span");
    sub.textContent = !state.connected ? "กดเชื่อม Google Calendar ด้านบนเพื่อเริ่มใช้งาน" : state.loading ? "กำลังอ่านจาก Google Calendar" : "ลองเลือกวันที่อื่น หรือเปลี่ยนตัวกรอง";
    empty.append(icon, title, sub);
    list.append(empty);
    return;
  }
  for (const event of events) {
    const row = document.createElement("article");
    row.className = "agenda-item";
    const stripe = document.createElement("span");
    stripe.className = "agenda-stripe " + category(event);
    const body = document.createElement("div");
    body.className = "agenda-item-body";
    const time = document.createElement("div");
    time.className = "agenda-time";
    const start = event.start.dateTime ? new Date(event.start.dateTime) : null;
    const end = event.end.dateTime ? new Date(event.end.dateTime) : null;
    time.textContent = !start ? "ทั้งวัน" : dayKey(start) !== state.selected ? "ต่อเนื่อง" : `${thaiTime.format(start)}${end ? " – " + thaiTime.format(end) : ""} น.`;
    const title = document.createElement("h3");
    title.textContent = event.summary || "(ไม่มีชื่อกิจกรรม)";
    body.append(time, title);
    if (event.location || event.description) {
      const description = document.createElement("p");
      description.textContent = [event.location, event.description].filter(Boolean).join(" · ").replace(/\s+/g, " ").slice(0, 180);
      body.append(description);
    }
    if (event.htmlLink) {
      try {
        const url = new URL(event.htmlLink);
        if (url.protocol === "https:" && (url.hostname === "calendar.google.com" || url.hostname === "www.google.com")) {
          const link = document.createElement("a");
          link.href = url.href;
          link.target = "_blank";
          link.rel = "noopener noreferrer";
          link.textContent = "เปิดใน Google Calendar ↗";
          body.append(link);
        }
      } catch { /* invalid link */ }
    }
    row.append(stripe, body);
    list.append(row);
  }
}

function disconnect() {
  ++state.request;
  if (state.token && window.google?.accounts?.oauth2) google.accounts.oauth2.revoke(state.token, () => {});
  state.token = null;
  state.connected = false;
  state.events = [];
  state.byDay = new Map();
  state.loading = false;
  updateConnection();
  render();
  $("settings-dialog").close();
  notice("ตัดการเชื่อมต่อจากเว็บนี้แล้ว");
}

function init() {
  state.clientId = storedClientId();
  $("settings-side").addEventListener("click", showSettings);
  $("settings-top").addEventListener("click", showSettings);
  $("close-settings").addEventListener("click", () => $("settings-dialog").close());
  $("save-connect-button").addEventListener("click", connect);
  $("disconnect-button").addEventListener("click", disconnect);
  $("connect-button").addEventListener("click", () => state.connected ? loadMonth() : state.clientId ? connect() : showSettings());
  $("hero-action").addEventListener("click", () => state.connected ? loadMonth() : state.clientId ? connect() : showSettings());
  $("prev-month").addEventListener("click", () => moveMonth(-1));
  $("next-month").addEventListener("click", () => moveMonth(1));
  $("go-today").addEventListener("click", () => {
    state.year = Number(today.slice(0, 4));
    state.month = Number(today.slice(5, 7)) - 1;
    state.selected = today;
    loadMonth();
  });
  $("event-search").addEventListener("input", renderAgenda);
  document.querySelectorAll(".filter-chip").forEach(button => button.addEventListener("click", () => {
    state.filter = button.dataset.filter;
    document.querySelectorAll(".filter-chip").forEach(chip => chip.classList.toggle("selected", chip === button));
    renderAgenda();
  }));
  $("nav-overview").addEventListener("click", () => window.scrollTo({top: 0, behavior: "smooth"}));
  $("nav-calendar").addEventListener("click", () => $("calendar-section").scrollIntoView({behavior: "smooth"}));
  setInterval(() => {
    const current = dayKey(new Date());
    if (current === today) return;
    const followedToday = state.selected === today;
    today = current;
    if (followedToday) {
      state.selected = today;
      const [year, month] = today.split("-").map(Number);
      if (state.year !== year || state.month !== month - 1) {
        state.year = year;
        state.month = month - 1;
        loadMonth();
        return;
      }
    }
    render();
  }, 60_000);
  updateConnection();
  render();
}

init();
