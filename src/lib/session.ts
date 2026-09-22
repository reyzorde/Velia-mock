export type VeliaSession = {
  kind: 'velia';
  student_id: string;
  full_name: string;
  center_id: string;
  phone: string;
};

export type PublicSession = {
  kind: 'public';
  public_id: string;
  full_name: string;
  phone: string;
};

export type Session = VeliaSession | PublicSession;

export function normalizePhone(raw: string) {
  return raw.replace(/[^\d+]/g, '');
}

export function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem('velia_mock_session_v2');
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export function saveSession(s: Session) {
  localStorage.setItem('velia_mock_session_v2', JSON.stringify(s));
}

export function clearSession() {
  localStorage.removeItem('velia_mock_session_v2');
}
