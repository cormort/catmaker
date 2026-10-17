// main.js — 進入點：貓咪夢工廠（小屋、學院、屬性、商店、扭蛋、稱號、紀念、活動）
import { audio } from "../audio.js";
import { startLife } from "./life.js";
import { petData, showPetHome, showStarterSetup, syncGrowthStages } from "./pet.js?v=20261004";
import { loadSubjects, loadUnits } from "./quiz.js";
import { $, LS, hideSheet } from "./ui.js";

const subjectsReady = Promise.all([loadSubjects(), loadUnits()]).catch((err) =>
  console.error("讀取題庫失敗", err),
);

function route() {
  hideSheet();
  showPetHome();
  audio.setScene("room");
  scrollTo(0, 0);
}

$("themeBtn").onclick = () => {
  const dark = document.documentElement.dataset.theme !== "dark";
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  localStorage.setItem(LS.theme, dark ? "dark" : "light");
  $("themeBtn").textContent = dark ? "☀️" : "🌙";
};
$("overlay").addEventListener("click", (e) => {
  if (e.target === $("overlay")) hideSheet();
});
function updateAudioUI() {
  const audioBtn = $("audioBtn");
  const bgmToggle = $("bgmToggle");
  const sfxToggle = $("sfxToggle");
  if (bgmToggle) bgmToggle.checked = !!audio.bgmEnabled;
  if (sfxToggle) sfxToggle.checked = !!audio.sfxEnabled;

  if (audioBtn) {
    let icon = "🔇";
    let title = "聲音：已全部靜音（點擊開啟／長按展開細調）";
    let isOn = false;
    if (audio.bgmEnabled && audio.sfxEnabled) {
      icon = "🔊";
      title = "聲音：音樂與音效皆開啟（點擊全部靜音／長按展開細調）";
      isOn = true;
    } else if (audio.bgmEnabled) {
      icon = "🎵";
      title = "聲音：僅音樂開啟（點擊全部靜音／長按展開細調）";
      isOn = true;
    } else if (audio.sfxEnabled) {
      icon = "🔈";
      title = "聲音：僅音效開啟（點擊全部靜音／長按展開細調）";
      isOn = true;
    }
    audioBtn.textContent = icon;
    audioBtn.title = title;
    audioBtn.classList.toggle("on", isOn);
  }
}

const audioBtn = $("audioBtn");
const audioPopup = $("audioPopup");
let lastAudioState = { bgm: true, sfx: true };

if (audioBtn && audioPopup) {
  let pressTimer = null;
  let isLongPress = false;

  const togglePopup = (show) => {
    const shouldShow = show ?? audioPopup.classList.contains("hidden");
    audioPopup.classList.toggle("hidden", !shouldShow);
  };

  audioBtn.addEventListener("pointerdown", () => {
    isLongPress = false;
    pressTimer = setTimeout(() => {
      isLongPress = true;
      togglePopup(true);
      navigator.vibrate?.(20);
    }, 450);
  });

  const clearTimer = () => clearTimeout(pressTimer);
  audioBtn.addEventListener("pointerup", clearTimer);
  audioBtn.addEventListener("pointercancel", clearTimer);
  audioBtn.addEventListener("mouseup", clearTimer);
  audioBtn.addEventListener("mouseleave", clearTimer);

  audioBtn.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    togglePopup(true);
  });

  const setBgm = (enable) => {
    if (audio.bgmEnabled !== !!enable) {
      if (typeof audio.setBgm === "function") audio.setBgm(enable);
      else audio.toggleBgm();
    }
  };
  const setSfx = (enable) => {
    if (audio.sfxEnabled !== !!enable) {
      if (typeof audio.setSfx === "function") audio.setSfx(enable);
      else audio.toggleSfx();
    }
  };

  audioBtn.addEventListener("click", () => {
    if (isLongPress) {
      isLongPress = false;
      return;
    }
    if (!audioPopup.classList.contains("hidden")) {
      togglePopup(false);
      return;
    }
    if (audio.bgmEnabled || audio.sfxEnabled) {
      lastAudioState = { bgm: audio.bgmEnabled, sfx: audio.sfxEnabled };
      setBgm(false);
      setSfx(false);
    } else {
      setBgm(lastAudioState.bgm ?? true);
      setSfx(lastAudioState.sfx ?? true);
    }
    updateAudioUI();
  });

  $("bgmToggle")?.addEventListener("change", (e) => {
    setBgm(e.target.checked);
    updateAudioUI();
  });

  $("sfxToggle")?.addEventListener("change", (e) => {
    setSfx(e.target.checked);
    updateAudioUI();
  });

  document.addEventListener("click", (e) => {
    if (!audioPopup.classList.contains("hidden") && !e.target.closest(".audio-ctrl-wrap")) {
      togglePopup(false);
    }
  });
}

updateAudioUI();
// 瀏覽器要求先有使用者操作才能出聲：第一次互動時解鎖並補播背景音樂
window.addEventListener(
  "pointerdown",
  () => {
    audio.init();
    if (audio.bgmEnabled) audio.startBgm();
  },
  { once: true },
);
// 觸控裝置按鈕輕震（一個委派監聽取代每局重綁到所有按鈕）
document.addEventListener(
  "pointerup",
  (e) => {
    if (e.target.closest?.("button") && navigator.vibrate && matchMedia("(pointer:coarse)").matches)
      navigator.vibrate(4);
  },
  { passive: true },
);
window.addEventListener("hashchange", route);

(async function boot() {
  // 預設亮色（可自行切換夜間模式）
  const savedTheme = localStorage.getItem(LS.theme);
  document.documentElement.dataset.theme = savedTheme === "dark" ? "dark" : "light";
  const themeBtnEl = $("themeBtn");
  if (themeBtnEl) {
    themeBtnEl.hidden = false;
    themeBtnEl.textContent = savedTheme === "dark" ? "☀️" : "🌙";
  }
  startLife();
  if (petData.initialized) syncGrowthStages();
  else setTimeout(showStarterSetup, 180);
  await subjectsReady; // 學院頁需要學科表
  route();
  if ("serviceWorker" in navigator && location.protocol !== "file:")
    navigator.serviceWorker.register("./sw.js").catch(() => {});
})();
