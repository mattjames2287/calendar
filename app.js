/* Standalone Personal Calendar (read-only)
 * - Month-only (current month)
 * - Week view toggle (current week)
 * - Highlight Today
 * - Slideshow (landscape) pulled from Apps Script
 */

(function(){
  const cfg = window.CALENDAR_CONFIG || {};
  const el = (id) => document.getElementById(id);

  const monthBtn = el("monthBtn");
  const weekBtn = el("weekBtn");
  const todayBtn = el("todayBtn");

  const subtitle = el("subtitle");
  const grid = el("grid");
  const weekWrap = el("week");
  const weekCols = el("weekCols");

  const drawer = el("drawer");
  const drawerClose = el("drawerClose");
  const drawerBackdrop = el("drawerBackdrop");
  const drawerTitle = el("drawerTitle");
  const drawerSub = el("drawerSub");
  const eventList = el("eventList");

  const slideshow = el("slideshow");
  const slideImg = el("slideImg");
  const slideSub = el("slideSub");

  const today = new Date();
  let view = "month";
  let eventsByDay = new Map(); // key YYYY-MM-DD -> events[]
  let monthStart, monthEnd;

  function isoDate(d){
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,"0");
    const day = String(d.getDate()).padStart(2,"0");
    return `${y}-${m}-${day}`;
  }
  function startOfMonth(d){
    return new Date(d.getFullYear(), d.getMonth(), 1);
  }
  function endOfMonthExclusive(d){
    return new Date(d.getFullYear(), d.getMonth()+1, 1);
  }
  function startOfWeekSun(d){
    const x = new Date(d);
    x.setHours(0,0,0,0);
    x.setDate(x.getDate() - x.getDay());
    return x;
  }
  function addDays(d, n){
    const x = new Date(d);
    x.setDate(x.getDate()+n);
    return x;
  }
  function fmtMonthTitle(d){
    return d.toLocaleDateString(undefined, { month:"long", year:"numeric" });
  }
  function fmtDayTitle(d){
    return d.toLocaleDateString(undefined, { weekday:"long", month:"long", day:"numeric", year:"numeric" });
  }
  function fmtTimeRange(ev){
    if(ev.allDay) return "All day";
    const s = new Date(ev.start);
    const e = ev.end ? new Date(ev.end) : null;
    const opts = { hour:"numeric", minute:"2-digit" };
    const a = s.toLocaleTimeString(undefined, opts);
    const b = e ? e.toLocaleTimeString(undefined, opts) : "";
    return b ? `${a}–${b}` : a;
  }

  // JSONP helper
  function jsonp(url){
    return new Promise((resolve, reject)=>{
      const cb = "cb_" + Math.random().toString(36).slice(2);
      const script = document.createElement("script");
      window[cb] = (data)=>{
        try{
          delete window[cb];
          script.remove();
        }catch(_){}
        resolve(data);
      };
      script.onerror = ()=>{
        try{ delete window[cb]; script.remove(); }catch(_){}
        reject(new Error("JSONP load failed"));
      };
      const join = url.includes("?") ? "&" : "?";
      script.src = url + join + "callback=" + cb;
      document.body.appendChild(script);
    });
  }

  function apiUrl(params){
    const base = String(cfg.API_BASE || "").trim();
    if(!base) throw new Error("Missing API_BASE in config.js");
    const u = new URL(base);
    Object.keys(params).forEach(k=>u.searchParams.set(k, params[k]));
    return u.toString();
  }

  async function loadMonthEvents(){
    monthStart = startOfMonth(today);
    monthEnd = endOfMonthExclusive(today);

    subtitle.textContent = fmtMonthTitle(today);

    const start = isoDate(monthStart);
    const end = isoDate(monthEnd);

    const data = await jsonp(apiUrl({
      route:"range",
      start,
      end,
      token: cfg.TOKEN || ""
    }));

    if(!data || !data.ok) throw new Error(data && data.error ? data.error : "Calendar fetch failed");

    eventsByDay = new Map();
    for(const ev of (data.events || [])){
      const d = new Date(ev.start);
      // Use local date for grouping
      const key = isoDate(d);
      if(!eventsByDay.has(key)) eventsByDay.set(key, []);
      eventsByDay.get(key).push(ev);
    }
  }

  function renderMonth(){
    weekWrap.classList.add("hidden");
    grid.classList.remove("hidden");

    grid.innerHTML = "";

    const first = startOfMonth(today);
    const firstDow = first.getDay(); // 0 Sun
    const daysInMonth = endOfMonthExclusive(today).getDate() - 1; // not used
    const last = new Date(today.getFullYear(), today.getMonth()+1, 0);
    const totalDays = last.getDate();
    const weeks = Math.ceil((firstDow + totalDays) / 7);
    grid.style.gridTemplateRows = `repeat(${weeks}, minmax(0, 1fr))`;

    // Fill leading blanks (muted)
    for(let i=0;i<firstDow;i++){
      const cell = document.createElement("div");
      cell.className = "day muted";
      grid.appendChild(cell);
    }

    for(let day=1; day<=totalDays; day++){
      const d = new Date(today.getFullYear(), today.getMonth(), day);
      const key = isoDate(d);
      const evs = (eventsByDay.get(key) || []).slice().sort((a,b)=>String(a.start).localeCompare(String(b.start)));

      const cell = document.createElement("div");
      cell.className = "day";
      if(isoDate(d) === isoDate(today)) cell.classList.add("today");

      cell.dataset.date = key;

      const header = document.createElement("div");
      header.className = "dayHeader";

      const num = document.createElement("div");
      num.className = "dayNum";
      num.textContent = String(day);

      const badge = document.createElement("div");
      badge.className = "todayBadge";
      badge.textContent = "Today";

      header.appendChild(num);
      header.appendChild(badge);

      const dots = document.createElement("div");
      dots.className = "dots";
      for(let i=0;i<Math.min(evs.length, 6); i++){
        const dot = document.createElement("div");
        dot.className = "dotEv";
        dots.appendChild(dot);
      }

      const preview = document.createElement("div");
      preview.className = "eventPreview";
      if(evs.length===0){
        preview.textContent = "";
      } else if(evs.length===1){
        preview.textContent = evs[0].title;
      } else {
        preview.textContent = `${evs[0].title} +${evs.length-1} more`;
      }

      cell.appendChild(header);
      cell.appendChild(dots);
      cell.appendChild(preview);

      cell.addEventListener("click", ()=>{
        openDrawerForDate(d);
      });

      grid.appendChild(cell);
    }

    // trailing blanks for neat grid alignment (optional)
    const filled = firstDow + totalDays;
    const remainder = filled % 7;
    const tail = remainder===0 ? 0 : (7 - remainder);
    for(let i=0;i<tail;i++){
      const cell = document.createElement("div");
      cell.className = "day muted";
      grid.appendChild(cell);
    }
  }

  function renderWeek(){
    grid.classList.add("hidden");
    weekWrap.classList.remove("hidden");

    weekCols.innerHTML = "";

    const ws = startOfWeekSun(today);
    for(let i=0;i<7;i++){
      const d = addDays(ws, i);
      const key = isoDate(d);
      const evs = (eventsByDay.get(key) || []).slice().sort((a,b)=>String(a.start).localeCompare(String(b.start)));

      const col = document.createElement("div");
      col.className = "weekCol";
      if(key===isoDate(today)) col.classList.add("today");

      const head = document.createElement("div");
      head.className = "weekColHead";

      const wd = document.createElement("div");
      wd.textContent = d.toLocaleDateString(undefined, { weekday:"short" });

      const n = document.createElement("div");
      n.className = "n";
      n.textContent = String(d.getDate());

      head.appendChild(wd);
      head.appendChild(n);

      col.appendChild(head);

      if(evs.length===0){
        const empty = document.createElement("div");
        empty.className = "eventItemMeta";
        empty.textContent = "—";
        col.appendChild(empty);
      } else {
        for(const ev of evs){
          const box = document.createElement("div");
          box.className = "weekEv";
          box.addEventListener("click", ()=> openDrawerForDate(d));

          const t = document.createElement("div");
          t.className = "weekEvT";
          t.textContent = ev.title;

          const s = document.createElement("div");
          s.className = "weekEvS";
          s.textContent = fmtTimeRange(ev);

          box.appendChild(t);
          box.appendChild(s);
          col.appendChild(box);
        }
      }

      weekCols.appendChild(col);
    }
  }

  function openDrawerForDate(d){
    const key = isoDate(d);
    const evs = (eventsByDay.get(key) || []).slice().sort((a,b)=>String(a.start).localeCompare(String(b.start)));

    drawerTitle.textContent = fmtDayTitle(d);
    drawerSub.textContent = evs.length ? `${evs.length} event${evs.length===1?"":"s"}` : "No events";
    eventList.innerHTML = "";

    if(!evs.length){
      const item = document.createElement("div");
      item.className = "eventItem";
      item.innerHTML = `<div class="eventItemTitle">No events</div><div class="eventItemMeta">—</div>`;
      eventList.appendChild(item);
    } else {
      for(const ev of evs){
        const item = document.createElement("div");
        item.className = "eventItem";

        const t = document.createElement("div");
        t.className = "eventItemTitle";
        t.textContent = ev.title;

        const m = document.createElement("div");
        m.className = "eventItemMeta";
        m.textContent = fmtTimeRange(ev);

        item.appendChild(t);
        item.appendChild(m);
        eventList.appendChild(item);
      }
    }

    drawer.classList.add("show");
    drawer.setAttribute("aria-hidden","false");
  }

  function closeDrawer(){
    drawer.classList.remove("show");
    drawer.setAttribute("aria-hidden","true");
  }

  drawerClose.addEventListener("click", closeDrawer);
  drawerBackdrop.addEventListener("click", closeDrawer);
  document.addEventListener("keydown",(e)=>{
    if(e.key === "Escape") closeDrawer();
  });

  function setView(next){
    view = next;
    monthBtn.classList.toggle("active", view==="month");
    weekBtn.classList.toggle("active", view==="week");
    monthBtn.setAttribute("aria-selected", view==="month" ? "true":"false");
    weekBtn.setAttribute("aria-selected", view==="week" ? "true":"false");
    if(view==="month") renderMonth();
    else renderWeek();
  }

  monthBtn.addEventListener("click", ()=>setView("month"));
  weekBtn.addEventListener("click", ()=>setView("week"));
  todayBtn.addEventListener("click", ()=>{
    // always current month anyway; just ensure highlights / drawer anchors
    setView(view);
  });

  // Slideshow (landscape only) pulling from Apps Script
  let slideshowUrls = [];
  let slideIdx = 0;
  let slideTimer = null;

  async function loadSlideshow(){
    // Only run slideshow in landscape; CSS hides it otherwise
    const isLandscape = window.matchMedia && window.matchMedia("(orientation: landscape)").matches;
    if(!isLandscape) return;

    try{
      const data = await jsonp(apiUrl({
        route: "photos",
        token: cfg.TOKEN || ""
      }));

      if(data && data.ok && Array.isArray(data.photos) && data.photos.length){
        slideshowUrls = data.photos.slice(0, 100);
        slideSub.textContent = `${slideshowUrls.length} photos`;
        startSlideshow();
      } else {
        slideSub.textContent = "No photos";
      }
    } catch (e){
      slideSub.textContent = "Slideshow unavailable";
    }
  }

  function showSlide(){
    if(!slideshowUrls.length || !slideImg) return;

    const url = slideshowUrls[slideIdx % slideshowUrls.length];
    slideIdx++;

    // Fade out, then set src. Add show on load. If blocked/error, skip ahead.
    slideImg.classList.remove("show");

    const onLoad = ()=>{
      slideImg.removeEventListener("load", onLoad);
      slideImg.removeEventListener("error", onErr);
      requestAnimationFrame(()=> slideImg.classList.add("show"));
    };
    const onErr = ()=>{
      slideImg.removeEventListener("load", onLoad);
      slideImg.removeEventListener("error", onErr);

      // Show a quick status + try next image
      slideSub && (slideSub.textContent = "Photos blocked (trying next)");
      setTimeout(()=>{ if(slideshowUrls.length) showSlide(); }, 800);
    };

    slideImg.addEventListener("load", onLoad, { once:false });
    slideImg.addEventListener("error", onErr, { once:false });

    // Cache-bust a bit to avoid stale redirect issues
    const bust = "cb=" + Date.now().toString(36);
    slideImg.src = url + (url.includes("?") ? "&" : "?") + bust;
  }

  function startSlideshow(){

  function startSlideshow(){
    stopSlideshow();
    showSlide();
    const interval = Number(cfg.SLIDESHOW_INTERVAL_MS || 12000);
    slideTimer = setInterval(showSlide, Math.max(3000, interval));
  }

  function stopSlideshow(){
    if(slideTimer){
      clearInterval(slideTimer);
      slideTimer = null;
    }
  }

  window.addEventListener("orientationchange", ()=>{
    stopSlideshow();
    loadSlideshow();
  });

  async function init(){
    try{
      await loadMonthEvents();
      setView("month");
      await loadSlideshow();
    } catch (e){
      subtitle.textContent = "";
      console.error(e);
    }
  }

  init();
})();
