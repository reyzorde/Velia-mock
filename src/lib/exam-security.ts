let audioCtx: AudioContext | null = null;
let alarmTimer: number | null = null;
function beep() {
  try {
    if (!audioCtx) audioCtx = new AudioContext();
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = 'square'; o.frequency.value = 880; g.gain.value = 0.35;
    o.connect(g); g.connect(audioCtx.destination);
    o.start(); o.stop(audioCtx.currentTime + 0.2);
  } catch { /* */ }
}
export function startAlarm() {
  stopAlarm(); beep();
  alarmTimer = window.setInterval(() => beep(), 400);
}
export function stopAlarm() {
  if (alarmTimer != null) { clearInterval(alarmTimer); alarmTimer = null; }
}
export async function enterExamFullscreen() {
  try { if (audioCtx?.state === 'suspended') await audioCtx.resume(); } catch { /* */ }
  try { await document.documentElement.requestFullscreen?.(); } catch { /* */ }
}
export function attachExamGuards(onExit: () => void) {
  const onFs = () => {
    if (!document.fullscreenElement) { startAlarm(); onExit(); }
    else stopAlarm();
  };
  const onVis = () => { if (document.hidden) { startAlarm(); onExit(); } };
  document.addEventListener('fullscreenchange', onFs);
  document.addEventListener('visibilitychange', onVis);
  return () => {
    document.removeEventListener('fullscreenchange', onFs);
    document.removeEventListener('visibilitychange', onVis);
    stopAlarm();
  };
}
