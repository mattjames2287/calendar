const STORAGE_KEY = "activityRouletteCasino_v1";

const DEFAULT_BUCKETS = {
  "$0–25": {
    color: "#17704a",
    items: [
      { emoji: "🍦", name: "Ice Cream Date" },
      { emoji: "🌳", name: "Park Walk" },
      { emoji: "☕", name: "Coffee Shop Visit" },
      { emoji: "🧺", name: "Picnic" },
      { emoji: "🎬", name: "Movie Night at Home" },
      { emoji: "🎲", name: "Board Game Night" },
      { emoji: "🍩", name: "Dessert Run" },
      { emoji: "📸", name: "Photo Walk" }
    ]
  },
  "$25–50": {
    color: "#0f5ea8",
    items: [
      { emoji: "🎳", name: "Bowling" },
      { emoji: "🍔", name: "Casual Dinner Out" },
      { emoji: "🖼️", name: "Museum Visit" },
      { emoji: "🕹️", name: "Arcade Night" },
      { emoji: "🧩", name: "Escape Room" },
      { emoji: "🥞", name: "Brunch Date" },
      { emoji: "🐘", name: "Zoo Visit" },
      { emoji: "🎨", name: "Paint Night" }
    ]
  },
  "$50–100": {
    color: "#7b1db9",
    items: [
      { emoji: "🍽️", name: "Nice Dinner" },
      { emoji: "🎤", name: "Concert Tickets" },
      { emoji: "🚣", name: "Kayaking Adventure" },
      { emoji: "👩‍🍳", name: "Cooking Class" },
      { emoji: "😂", name: "Comedy Show" },
      { emoji: "🚗", name: "Day Trip" },
      { emoji: "🎟️", name: "Event Tickets" },
      { emoji: "🧖", name: "Spa Visit" }
    ]
  },
  "$100+": {
    color: "#b5121b",
    items: [
      { emoji: "🏕️", name: "Weekend Getaway" },
      { emoji: "🎈", name: "Hot Air Balloon Ride" },
      { emoji: "🏨", name: "Hotel Night" },
      { emoji: "🥂", name: "Fancy Tasting Menu" },
      { emoji: "🚁", name: "Adventure Experience" },
      { emoji: "🚆", name: "Special Day Trip" },
      { emoji: "🌄", name: "Cabin Stay" },
      { emoji: "🛥️", name: "Private Tour" }
    ]
  }
};

const canvas = document.getElementById("wheelCanvas");
const ctx = canvas.getContext("2d");
const confettiCanvas = document.getElementById("confettiCanvas");
const confettiCtx = confettiCanvas.getContext("2d");

const bucketButtons = document.getElementById("bucketButtons");
const spinBtn = document.getElementById("spinBtn");
const resultText = document.getElementById("resultText");
const resultSub = document.getElementById("resultSub");
const wheelNote = document.getElementById("wheelNote");
const removeWinnerToggle = document.getElementById("removeWinnerToggle");
const soundToggle = document.getElementById("soundToggle");
const adminBucket = document.getElementById("adminBucket");
const activityEmoji = document.getElementById("activityEmoji");
const activityName = document.getElementById("activityName");
const addActivityBtn = document.getElementById("addActivityBtn");
const activityList = document.getElementById("activityList");
const bucketCount = document.getElementById("bucketCount");
const resetBucketBtn = document.getElementById("resetBucketBtn");
const resetAllBtn = document.getElementById("resetAllBtn");
const winnerModal = document.getElementById("winnerModal");
const winnerModalText = document.getElementById("winnerModalText");
const winnerModalSub = document.getElementById("winnerModalSub");
const closeWinnerBtn = document.getElementById("closeWinnerBtn");

const size = canvas.width;
const center = size / 2;
const radius = 332;

let buckets = loadBuckets();
let selectedBucket = null;
let currentItems = [];
let currentRotation = 0;
let isSpinning = false;
let confettiPieces = [];
let confettiAnim = null;

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function loadBuckets() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return deepClone(DEFAULT_BUCKETS);
  try {
    return JSON.parse(saved);
  } catch {
    return deepClone(DEFAULT_BUCKETS);
  }
}

function saveBuckets() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(buckets));
}

function init() {
  resizeConfettiCanvas();
  window.addEventListener("resize", resizeConfettiCanvas);
  buildBucketButtons();
  buildAdminBucketSelect();
  syncAdminList();
  drawEmptyWheel();
}

function buildBucketButtons() {
  bucketButtons.innerHTML = "";
  Object.keys(buckets).forEach((bucketName) => {
    const btn = document.createElement("button");
    btn.className = "bucket-btn";
    btn.style.background = `linear-gradient(180deg, ${shadeColor(buckets[bucketName].color, 18)}, ${buckets[bucketName].color})`;
    btn.textContent = `${bucketName} (${buckets[bucketName].items.length})`;
    btn.addEventListener("click", () => selectBucket(bucketName));
    bucketButtons.appendChild(btn);
  });
}

function buildAdminBucketSelect() {
  adminBucket.innerHTML = "";
  Object.keys(buckets).forEach((bucketName) => {
    const option = document.createElement("option");
    option.value = bucketName;
    option.textContent = bucketName;
    adminBucket.appendChild(option);
  });
  adminBucket.onchange = syncAdminList;
}

function setActiveBucketButton(bucketName) {
  document.querySelectorAll(".bucket-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.textContent.startsWith(bucketName));
  });
}

function selectBucket(bucketName) {
  selectedBucket = bucketName;
  currentItems = [...buckets[bucketName].items];
  currentRotation = 0;
  setActiveBucketButton(bucketName);
  adminBucket.value = bucketName;
  resultText.textContent = "Ready to spin";
  resultSub.textContent = `Budget selected: ${bucketName}`;
  wheelNote.textContent = `${currentItems.length} possible activities in ${bucketName}`;
  spinBtn.disabled = currentItems.length === 0;
  syncAdminList();
  drawWheel();
}

function syncAdminList() {
  const bucketName = adminBucket.value || Object.keys(buckets)[0];
  const items = buckets[bucketName].items;
  bucketCount.textContent = `${items.length} activit${items.length === 1 ? "y" : "ies"}`;
  activityList.innerHTML = "";

  items.forEach((item, index) => {
    const row = document.createElement("div");
    row.className = "activity-item";

    const text = document.createElement("div");
    text.className = "activity-text";
    text.textContent = `${item.emoji || "🎯"} ${item.name}`;

    const removeBtn = document.createElement("button");
    removeBtn.className = "remove-btn";
    removeBtn.textContent = "Remove";
    removeBtn.addEventListener("click", () => {
      buckets[bucketName].items.splice(index, 1);
      saveBuckets();
      buildBucketButtons();
      syncAdminList();

      if (selectedBucket === bucketName) {
        currentItems = [...buckets[bucketName].items];
        spinBtn.disabled = currentItems.length === 0;
        wheelNote.textContent = currentItems.length
          ? `${currentItems.length} possible activities in ${bucketName}`
          : `No activities left in ${bucketName}`;
        drawWheel();
      }
    });

    row.appendChild(text);
    row.appendChild(removeBtn);
    activityList.appendChild(row);
  });
}

function addActivity() {
  const bucketName = adminBucket.value;
  const emoji = activityEmoji.value.trim() || "🎯";
  const name = activityName.value.trim();
  if (!name) return;

  buckets[bucketName].items.push({ emoji, name });
  saveBuckets();
  buildBucketButtons();
  syncAdminList();

  if (selectedBucket === bucketName) {
    currentItems = [...buckets[bucketName].items];
    spinBtn.disabled = currentItems.length === 0;
    wheelNote.textContent = `${currentItems.length} possible activities in ${bucketName}`;
    drawWheel();
  }

  activityEmoji.value = "";
  activityName.value = "";
  activityName.focus();
}

function resetCurrentBucket() {
  if (!selectedBucket) return;
  buckets[selectedBucket].items = deepClone(DEFAULT_BUCKETS[selectedBucket].items);
  saveBuckets();
  buildBucketButtons();
  syncAdminList();
  currentItems = [...buckets[selectedBucket].items];
  spinBtn.disabled = currentItems.length === 0;
  wheelNote.textContent = `${currentItems.length} possible activities in ${selectedBucket}`;
  drawWheel();
}

function resetAllBuckets() {
  buckets = deepClone(DEFAULT_BUCKETS);
  saveBuckets();
  buildBucketButtons();
  buildAdminBucketSelect();

  if (selectedBucket) {
    currentItems = [...buckets[selectedBucket].items];
    spinBtn.disabled = currentItems.length === 0;
    wheelNote.textContent = `${currentItems.length} possible activities in ${selectedBucket}`;
    syncAdminList();
    drawWheel();
  } else {
    syncAdminList();
    drawEmptyWheel();
  }
}

function drawEmptyWheel() {
  ctx.clearRect(0, 0, size, size);
  ctx.save();
  ctx.translate(center, center);

  const gradient = ctx.createRadialGradient(0, 0, 100, 0, 0, radius);
  gradient.addColorStop(0, "#3c1417");
  gradient.addColorStop(1, "#140708");

  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fillStyle = gradient;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(0, 0, radius + 4, 0, Math.PI * 2);
  ctx.lineWidth = 8;
  ctx.strokeStyle = "rgba(247,212,107,0.85)";
  ctx.stroke();

  ctx.restore();
  ctx.textAlign = "center";
  ctx.fillStyle = "#fff2c8";
  ctx.font = "bold 34px Arial";
  ctx.fillText("Select a budget", center, center - 10);
  ctx.font = "18px Arial";
  ctx.fillStyle = "#f0dba7";
  ctx.fillText("The wheel will load activities here", center, center + 24);
}

function shadeColor(hex, amt) {
  const clean = hex.replace("#", "");
  const num = parseInt(clean, 16);
  let r = (num >> 16) + amt;
  let g = ((num >> 8) & 0x00ff) + amt;
  let b = (num & 0x0000ff) + amt;
  r = Math.max(0, Math.min(255, r));
  g = Math.max(0, Math.min(255, g));
  b = Math.max(0, Math.min(255, b));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

function drawWheelText(text) {
  const maxWidth = radius - 30;
  const words = text.split(" ");
  const lines = [];
  let line = "";

  ctx.font = "bold 22px Arial";
  ctx.fillStyle = "#fffaf0";
  ctx.textAlign = "right";

  for (const word of words) {
    const testLine = line ? `${line} ${word}` : word;
    if (ctx.measureText(testLine).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = testLine;
    }
  }
  if (line) lines.push(line);

  const lineHeight = 26;
  const startY = -((lines.length - 1) * lineHeight) / 2;
  lines.forEach((ln, index) => {
    ctx.fillText(ln, radius - 18, startY + index * lineHeight);
  });
}

function drawWheel() {
  ctx.clearRect(0, 0, size, size);
  if (!selectedBucket || !currentItems.length) {
    drawEmptyWheel();
    return;
  }

  const slice = (Math.PI * 2) / currentItems.length;
  const altColors = ["#b5121b", "#141414", "#17704a", "#7b1db9", "#0f5ea8", "#734700"];

  for (let i = 0; i < currentItems.length; i++) {
    const start = currentRotation + i * slice;
    const end = start + slice;

    ctx.beginPath();
    ctx.moveTo(center, center);
    ctx.arc(center, center, radius, start, end);
    ctx.closePath();
    ctx.fillStyle = altColors[i % altColors.length];
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(center, center);
    ctx.arc(center, center, radius, start, end);
    ctx.closePath();
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(255,233,164,0.85)";
    ctx.stroke();

    ctx.save();
    ctx.translate(center, center);
    ctx.rotate(start + slice / 2);
    drawWheelText(`${currentItems[i].emoji || "🎯"} ${currentItems[i].name}`);
    ctx.restore();
  }

  ctx.beginPath();
  ctx.arc(center, center, radius + 4, 0, Math.PI * 2);
  ctx.lineWidth = 9;
  ctx.strokeStyle = "rgba(247,212,107,0.95)";
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(center, center, 78, 0, Math.PI * 2);
  const centerGrad = ctx.createRadialGradient(center - 20, center - 20, 10, center, center, 78);
  centerGrad.addColorStop(0, "#fff2c8");
  centerGrad.addColorStop(0.5, "#f7d46b");
  centerGrad.addColorStop(1, "#d39b18");
  ctx.fillStyle = centerGrad;
  ctx.fill();
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function playTick(durationMs = 60, freq = 900, volume = 0.02, type = "square") {
  if (!soundToggle.checked) return;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;

  if (!window.__casinoAudioCtx) {
    window.__casinoAudioCtx = new AudioContextClass();
  }

  const ac = window.__casinoAudioCtx;
  if (ac.state === "suspended") ac.resume();

  const osc = ac.createOscillator();
  const gain = ac.createGain();
  const now = ac.currentTime;

  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);
  gain.gain.setValueAtTime(volume, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + durationMs / 1000);

  osc.connect(gain);
  gain.connect(ac.destination);
  osc.start(now);
  osc.stop(now + durationMs / 1000);
}

function playWinnerSound() {
  if (!soundToggle.checked) return;
  playTick(130, 880, 0.03, "triangle");
  setTimeout(() => playTick(130, 1175, 0.028, "triangle"), 120);
  setTimeout(() => playTick(180, 1568, 0.026, "triangle"), 250);
}

function spinWheel() {
  if (!selectedBucket || !currentItems.length || isSpinning) return;

  hideWinnerModal();
  isSpinning = true;
  spinBtn.disabled = true;
  resultText.textContent = "Spinning...";
  resultSub.textContent = `Budget: ${selectedBucket}`;

  const winnerIndex = Math.floor(Math.random() * currentItems.length);
  const slice = (Math.PI * 2) / currentItems.length;
  const targetSliceCenter = winnerIndex * slice + slice / 2;
  const normalizedTarget = (Math.PI * 1.5) - targetSliceCenter;
  const extraSpins = (Math.PI * 2) * (6 + Math.random() * 2);
  const startRotation = currentRotation;
  const finalRotation = extraSpins + normalizedTarget;

  const duration = 4700;
  const startTime = performance.now();
  let lastTick = 0;

  function animate(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = easeOutCubic(progress);
    currentRotation = startRotation + (finalRotation - startRotation) * eased;
    drawWheel();

    const tickGap = 38 + progress * 130;
    if (now - lastTick > tickGap) {
      playTick(50, 900 - progress * 260, 0.02, "square");
      lastTick = now;
    }

    if (progress < 1) {
      requestAnimationFrame(animate);
      return;
    }

    currentRotation = currentRotation % (Math.PI * 2);
    drawWheel();

    const winningItem = currentItems[winnerIndex];
    resultText.textContent = `${winningItem.emoji || "🎯"} ${winningItem.name}`;
    resultSub.textContent = `Chosen from ${selectedBucket}`;

    playWinnerSound();
    launchConfetti();
    showWinnerModal(winningItem, selectedBucket);

    if (removeWinnerToggle.checked) {
      const liveItems = buckets[selectedBucket].items;
      const realIndex = liveItems.findIndex(
        (item) => item.name === winningItem.name && item.emoji === winningItem.emoji
      );
      if (realIndex !== -1) {
        liveItems.splice(realIndex, 1);
        saveBuckets();
        buildBucketButtons();
        syncAdminList();
      }
      currentItems = [...buckets[selectedBucket].items];
    }

    spinBtn.disabled = currentItems.length === 0;
    wheelNote.textContent = currentItems.length
      ? `${currentItems.length} possible activities in ${selectedBucket}`
      : `No activities left in ${selectedBucket}`;
    isSpinning = false;
  }

  requestAnimationFrame(animate);
}

function showWinnerModal(item, bucketName) {
  winnerModalText.textContent = `${item.emoji || "🎯"} ${item.name}`;
  winnerModalSub.textContent = `Chosen from ${bucketName}`;
  winnerModal.classList.remove("hidden");
  winnerModal.setAttribute("aria-hidden", "false");
}

function hideWinnerModal() {
  winnerModal.classList.add("hidden");
  winnerModal.setAttribute("aria-hidden", "true");
}

function resizeConfettiCanvas() {
  confettiCanvas.width = window.innerWidth;
  confettiCanvas.height = window.innerHeight;
}

function launchConfetti() {
  confettiPieces = [];
  const colors = ["#f7d46b", "#b5121b", "#17704a", "#ffffff", "#0f5ea8"];
  for (let i = 0; i < 180; i++) {
    confettiPieces.push({
      x: confettiCanvas.width / 2,
      y: confettiCanvas.height * 0.22,
      vx: (Math.random() - 0.5) * 10,
      vy: Math.random() * -8 - 2,
      size: Math.random() * 7 + 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 0.3,
      life: 1
    });
  }

  if (confettiAnim) cancelAnimationFrame(confettiAnim);

  function frame() {
    confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
    let alive = 0;

    confettiPieces.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.14;
      p.rot += p.vr;
      p.life -= 0.008;

      if (p.life > 0) {
        alive++;
        confettiCtx.save();
        confettiCtx.globalAlpha = Math.max(p.life, 0);
        confettiCtx.translate(p.x, p.y);
        confettiCtx.rotate(p.rot);
        confettiCtx.fillStyle = p.color;
        confettiCtx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.65);
        confettiCtx.restore();
      }
    });

    if (alive > 0) {
      confettiAnim = requestAnimationFrame(frame);
    } else {
      confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
      confettiAnim = null;
    }
  }

  frame();
}

addActivityBtn.addEventListener("click", addActivity);
spinBtn.addEventListener("click", spinWheel);
resetBucketBtn.addEventListener("click", resetCurrentBucket);
resetAllBtn.addEventListener("click", resetAllBuckets);
closeWinnerBtn.addEventListener("click", hideWinnerModal);
winnerModal.addEventListener("click", (e) => {
  if (e.target.classList.contains("winner-backdrop")) hideWinnerModal();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") hideWinnerModal();
});
activityName.addEventListener("keydown", (e) => {
  if (e.key === "Enter") addActivity();
});

init();
