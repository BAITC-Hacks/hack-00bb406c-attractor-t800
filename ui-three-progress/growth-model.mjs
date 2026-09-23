// Prototype rules shared by the tree, demo controls and call screen.
export const CALL_TARGET_MS = 15 * 60 * 1000;
export const CALL_XP = 100;

export function canEditTest(fixtures, actorId, skillId) {
  return Boolean(fixtures.tests.find(test => test.id === skillId)?.editorIds?.includes(actorId));
}

export function actorFromCookie(cookie = '') {
  return cookie.split(';').map(part => part.trim()).find(part => part.startsWith('halyk_demo_actor='))?.slice(17) || 'employee';
}

export function createCall() {
  return { id: crypto.randomUUID(), elapsed: 0, startedAt: null, employeePresent: true, leadPresent: true, consent: false, status: 'ready', rewarded: false, demoAdvanced: false };
}

export function tickCall(call, now) {
  if (call.startedAt !== null) {
    if (call.status === 'active' && call.employeePresent && call.leadPresent && !call.muted) call.elapsed += Math.max(0, now - call.startedAt);
    call.startedAt = now;
  }
  if (call.consent && call.status === 'active' && call.employeePresent && call.leadPresent && !call.muted && call.elapsed >= CALL_TARGET_MS && !call.rewarded) {
    call.rewarded = true;
    return CALL_XP;
  }
  return 0;
}

export function clockText(ms) {
  const seconds = Math.floor(ms / 1000);
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}
