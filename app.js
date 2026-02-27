(() => {
  const cfg = window.CALENDAR_CONFIG || {};
  const API_BASE = (cfg.API_BASE || "").trim();
  const TOKEN = (cfg.TOKEN || "").trim();

  const el = (id) => document.getElementById(id);
  const subtitle = el("subtitle");
  const grid = el("grid");
  const dow = el("dow");
  const agenda = el("agenda");

  const monthBtn = el("monthBtn");
  const weekBtn = el("weekBtn");
  const agendaBtn = el("agendaBtn");
  const prevBtn = el("prevBtn");
  const nextBtn = el("nextBtn");
  const todayBtn = el("todayBtn");

  const drawer = el("drawer");
  const drawerTitle = el("drawerTitle");
  const drawerSub = el("drawerSub");
  const eventList = el("eventList");
  const drawerClose = el("drawerClose");
  const drawerBackdrop = el("drawerBackdrop");

  const pad2 = (n) => String(n).padStart(2, "0");
  const isoDate = (d) => `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
  const todayISO = isoDate(new Date());

  let view = "month"; // month|week|agenda
  let cursor = new Date(); cursor.setDate(1);
  let events = [];          // raw events
  let eventsByDay = {};     // { YYYY-MM-DD: [event] }
  let openDay = null;

  function jsonp(url){
    return new Promise((resolve,reject)=>{
      const cb = "cb_" + Math.random().toString(36).slice(2);
      const s = document.createElement("script");
      const sep = url.includes("?") ? "&" : "?";
      s.src = `${url}${sep}callback=${cb}`;
      const t = setTimeout(()=>{cleanup(); reject(new Error("JSONP timeout"));}, 12000);
      function cleanup(){ clearTimeout(t); delete window[cb]; s.remove(); }
      window[cb] = (data)=>{ cleanup(); resolve(data); };
      s.onerror = ()=>{ cleanup(); reject(new Error("JSONP load error")); };
      document.head.appendChild(s);
    });
  }

  async function apiRange(startISO, endISO){
    if (!API_BASE || !TOKEN) {
      throw new Error("Missing config. Open config.js and set API_BASE + TOKEN.");
    }
    const q = new URLSearchParams({ route: "range", token: TOKEN, start: startISO, end: endISO });
    const res = await jsonp(`${API_BASE}?${q.toString()}`);
    if (!res || !res.ok) throw new Error(res?.error || "API error");
    return res.events || [];
  }

  function fmtMonth(d){
    return d.toLocaleString(undefined, { month: "long", year: "numeric" });
  }
  function weekStart(d){
    const x = new Date(d);
    x.setHours(0,0,0,0);
    x.setDate(x.getDate() - x.getDay());
    return x;
  }

  function setView(v){
    view = v;
    monthBtn.classList.toggle("active", v==="month");
    weekBtn.classList.toggle("active", v==="week");
    agendaBtn.classList.toggle("active", v==="agenda");

    dow.classList.toggle("hidden", v==="agenda");
    grid.classList.toggle("hidden", v==="agenda");
    agenda.classList.toggle("hidden", v!=="agenda");

    refresh();
  }

  function groupByDay(list){
    const map = {};
    for (const ev of list){
      const day = ev.day;
      (map[day] = map[day] || []).push(ev);
    }
    for (const k of Object.keys(map)){
      map[k].sort((a,b)=> (a.sortKey || "").localeCompare(b.sortKey || ""));
    }
    return map;
  }

  function toLocalDisplay(ev){
    // ev.start / ev.end are ISO strings (UTC). We'll display in user's local timezone.
    const allDay = !!ev.allDay;
    const start = ev.start ? new Date(ev.start) : null;
    const end = ev.end ? new Date(ev.end) : null;

    let timeLabel = "All day";
    if (!allDay && start){
      const opts = { hour: "numeric", minute: "2-digit" };
      const s = start.toLocaleTimeString([], opts);
      if (end) {
        const e = end.toLocaleTimeString([], opts);
        timeLabel = `${s}–${e}`;
      } else {
        timeLabel = s;
      }
    }

    return { timeLabel };
  }

  function buildDerived(list){
    const derived = [];
    for (const ev of list){
      const day = (ev.start ? isoDate(new Date(ev.start)) : (ev.day || "")) || "";
      const { timeLabel } = toLocalDisplay(ev);

      // sortKey ensures all-day first, then time
      let sortKey = "0";
      if (ev.allDay) sortKey = "0";
      else {
        const d = new Date(ev.start);
        sortKey = "1" + pad2(d.getHours()) + pad2(d.getMinutes());
      }

      derived.push({
        title: ev.title || "(No title)",
        start: ev.start || "",
        end: ev.end || "",
        allDay: !!ev.allDay,
        day,
        timeLabel,
        sortKey
      });
    }
    return derived;
  }

  function monthRangeForGrid(y, m0){
    // Return start/end that covers the 6x7 calendar grid (Sun..Sat)
    const first = new Date(y, m0, 1);
    const start = new Date(first);
    start.setDate(1 - first.getDay()); // go back to Sunday
    start.setHours(0,0,0,0);

    const end = new Date(start);
    end.setDate(end.getDate() + 42); // 42 days
    return { start, end };
  }

  async function refresh(){
    subtitle.textContent = "Loading…";
    try{
      let start, end;

      if (view === "month" || view === "agenda"){
        const { start: s, end: e } = monthRangeForGrid(cursor.getFullYear(), cursor.getMonth());
        start = s; end = e;
        subtitle.textContent = (view === "agenda") ? `Agenda · ${fmtMonth(cursor)}` : fmtMonth(cursor);
      } else {
        const s = weekStart(cursor);
        const e = new Date(s); e.setDate(e.getDate()+7);
        start = s; end = e;
        const end6 = new Date(s); end6.setDate(end6.getDate()+6);
        subtitle.textContent = `${isoDate(s)} → ${isoDate(end6)}`;
      }

      const raw = await apiRange(isoDate(start), isoDate(end));
      events = buildDerived(raw);
      eventsByDay = groupByDay(events);

      if (view === "month") renderMonth();
      else if (view === "week") renderWeek();
      else renderAgenda();

    } catch (e){
      subtitle.textContent = "Setup needed";
      alert(e.message || String(e));
    }
  }

  function previewForDay(dayISO){
    const dayEvents = eventsByDay[dayISO] || [];
    if (!dayEvents.length) return { text: "No events", empty: true };

    const lines = dayEvents.slice(0,3).map(ev => ev.allDay ? `All day · ${ev.title}` : `${ev.timeLabel} · ${ev.title}`);
    return { text: lines.join("\n"), empty:false };
  }

  function renderMonth(){
    grid.style.gridAutoRows = "";
    grid.innerHTML = "";

    const y = cursor.getFullYear();
    const m0 = cursor.getMonth();
    const first = new Date(y, m0, 1);
    const startDow = first.getDay();
    const dim = new Date(y, m0+1, 0).getDate();
    const prevDim = new Date(y, m0, 0).getDate();

    for (let cell=0; cell<42; cell++){
      const dayIndex = cell - startDow + 1;
      let showY=y, showM=m0+1, showD=dayIndex, muted=false;

      if (dayIndex < 1){
        muted=true; showM=m0; if (showM<1){showM=12;showY=y-1;} showD=prevDim+dayIndex;
      } else if (dayIndex > dim){
        muted=true; showM=m0+2; if (showM>12){showM=1;showY=y+1;} showD=dayIndex-dim;
      }

      const dayISO = `${showY}-${pad2(showM)}-${pad2(showD)}`;
      const dayEvents = eventsByDay[dayISO] || [];

      const day = document.createElement("div");
      day.className = "day" + (muted ? " muted" : "") + (dayISO===todayISO ? " today" : "");

      const head = document.createElement("div");
      head.className = "head";

      const num = document.createElement("div");
      num.className = "num";
      num.textContent = showD;

      const count = document.createElement("div");
      count.className = "count";
      count.textContent = dayEvents.length ? `${dayEvents.length}` : "";

      head.appendChild(num);
      head.appendChild(count);
      day.appendChild(head);

      const pv = previewForDay(dayISO);
      const p = document.createElement("div");
      p.className = "preview" + (pv.empty ? " empty" : "");
      p.textContent = pv.text;
      day.appendChild(p);

      day.addEventListener("click", async ()=>{
        const d = new Date(dayISO+"T00:00:00");
        if (d.getMonth() !== cursor.getMonth() || d.getFullYear() !== cursor.getFullYear()){
          cursor = new Date(d.getFullYear(), d.getMonth(), 1);
          await refresh();
        }
        openDrawer(dayISO);
      });

      grid.appendChild(day);
    }
  }

  function renderWeek(){
    const start = weekStart(cursor);
    grid.style.gridAutoRows = "minmax(140px, 1fr)";
    grid.innerHTML = "";

    for (let i=0;i<7;i++){
      const d = new Date(start); d.setDate(d.getDate()+i);
      const dayISO = isoDate(d);
      const dayEvents = eventsByDay[dayISO] || [];

      const day = document.createElement("div");
      day.className = "day" + (dayISO===todayISO ? " today" : "");

      const head = document.createElement("div");
      head.className = "head";

      const num = document.createElement("div");
      num.className = "num";
      num.textContent = d.toLocaleString(undefined, { weekday: "short" }) + " " + d.getDate();

      const count = document.createElement("div");
      count.className = "count";
      count.textContent = dayEvents.length ? `${dayEvents.length}` : "";

      head.appendChild(num);
      head.appendChild(count);
      day.appendChild(head);

      const pv = previewForDay(dayISO);
      const p = document.createElement("div");
      p.className = "preview" + (pv.empty ? " empty" : "");
      p.textContent = pv.text;
      day.appendChild(p);

      day.addEventListener("click", ()=> openDrawer(dayISO));
      grid.appendChild(day);
    }
  }

  function renderAgenda(){
    agenda.innerHTML = "";

    const days = Object.keys(eventsByDay).sort();
    const month0 = cursor.getMonth();
    const year = cursor.getFullYear();

    let shown = 0;
    for (const dayISO of days){
      const d = new Date(dayISO+"T00:00:00");
      if (d.getMonth() !== month0 || d.getFullYear() !== year) continue;

      const dayEvents = eventsByDay[dayISO] || [];
      if (!dayEvents.length) continue;

      shown++;

      const box = document.createElement("div");
      box.className = "agendaItem";
      const nice = d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric", year: "numeric" });
      box.innerHTML = `<div class="agendaDate">${nice}</div>`;

      dayEvents.forEach(ev=>{
        const line = document.createElement("div");
        line.className = "agendaLine";
        const t = ev.allDay ? "All day" : ev.timeLabel;
        line.innerHTML = `<span class="agendaTime">${t}</span>${escapeHtml(ev.title)}`;
        line.addEventListener("click", ()=> openDrawer(dayISO));
        box.appendChild(line);
      });

      agenda.appendChild(box);
    }

    if (!shown){
      agenda.innerHTML = `<div class="agendaItem"><div class="agendaDate">No events this month</div></div>`;
    }
  }

  function openDrawer(dayISO){
    openDay = dayISO;
    drawerTitle.textContent = new Date(dayISO+"T00:00:00").toLocaleDateString(undefined, { weekday:"long", month:"short", day:"numeric", year:"numeric" });

    const dayEvents = eventsByDay[dayISO] || [];
    drawerSub.textContent = dayEvents.length ? `${dayEvents.length} event${dayEvents.length===1?"":"s"}` : "No events";

    eventList.innerHTML = "";
    if (!dayEvents.length){
      eventList.innerHTML = `<div class="eventCard"><div class="eventTitle">No events</div><div class="eventMeta">Nothing scheduled.</div></div>`;
    } else {
      dayEvents.forEach(ev=>{
        const card = document.createElement("div");
        card.className = "eventCard";
        const t = ev.allDay ? "All day" : ev.timeLabel;
        card.innerHTML = `<div class="eventTitle">${escapeHtml(ev.title)}</div><div class="eventMeta">${t}</div>`;
        eventList.appendChild(card);
      });
    }

    drawer.classList.add("show");
    drawer.setAttribute("aria-hidden","false");
  }

  function closeDrawer(){
    drawer.classList.remove("show");
    drawer.setAttribute("aria-hidden","true");
    openDay = null;
  }

  function escapeHtml(s){
    return String(s||"")
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll('"',"&quot;")
      .replaceAll("'","&#039;");
  }

  // navigation
  prevBtn.addEventListener("click", async ()=>{
    if (view === "week"){
      cursor = weekStart(cursor);
      cursor.setDate(cursor.getDate()-7);
    } else {
      cursor.setMonth(cursor.getMonth()-1);
      cursor.setDate(1);
    }
    await refresh();
  });
  nextBtn.addEventListener("click", async ()=>{
    if (view === "week"){
      cursor = weekStart(cursor);
      cursor.setDate(cursor.getDate()+7);
    } else {
      cursor.setMonth(cursor.getMonth()+1);
      cursor.setDate(1);
    }
    await refresh();
  });
  todayBtn.addEventListener("click", async ()=>{
    const t = new Date();
    if (view === "week") cursor = weekStart(t);
    else cursor = new Date(t.getFullYear(), t.getMonth(), 1);
    await refresh();
  });

  monthBtn.addEventListener("click", ()=> setView("month"));
  weekBtn.addEventListener("click", ()=> setView("week"));
  agendaBtn.addEventListener("click", ()=> setView("agenda"));

  drawerClose.addEventListener("click", closeDrawer);
  drawerBackdrop.addEventListener("click", closeDrawer);

  // boot
  (async ()=>{
    try{
      await refresh();
    } catch(e){
      // handled in refresh
    }
  })();
})();