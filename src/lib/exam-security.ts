let audioCtx: AudioContext | null = null;
let alarmTimer: number | null = null;

function beep() {
  try {
    if (!audioCtx) audioCtx = new AudioContext();
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = 'square';
    o.frequency.value = 880;
    g.gain.value = 0.32;
    o.connect(g);
    g.connect(audioCtx.destination);
    o.start();
    o.stop(audioCtx.currentTime + 0.22);
  } catch {
    /* ignore */
  }
}

export function startAlarm() {
  stopAlarm();
  beep();
  alarmTimer = window.setInterval(() => beep(), 450);
}

export function stopAlarm() {
  if (alarmTimer != null) {
    clearInterval(alarmTimer);
    alarmTimer = null;
  }
}

export async function enterExamFullscreen() {
  try {
    if (audioCtx?.state === 'suspended') await audioCtx.resume();
  } catch {
    /* */
  }
  try {
    await document.documentElement.requestFullscreen?.();
  } catch {
    /* user gesture */
  }
}

export function attachExamGuards(onExit: () => void) {
  const onFs = () => {
    if (!document.fullscreenElement) {
      startAlarm();
      onExit();
    } else stopAlarm();
  };
  const onVis = () => {
    if (document.hidden) {
      startAlarm();
      onExit();
    }
  };
  document.addEventListener('fullscreenchange', onFs);
  document.addEventListener('visibilitychange', onVis);
  return () => {
    document.removeEventListener('fullscreenchange', onFs);
    document.removeEventListener('visibilitychange', onVis);
    stopAlarm();
  };
}
