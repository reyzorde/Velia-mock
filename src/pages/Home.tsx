import { FormEvent, useEffect, useState } from 'react';
import { LogOut, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { clearSession, loadSession, Session } from '../lib/session';
import { supabase } from '../lib/supabase';

const UNIT_PRICE = 100;

export default function Home() {
  const nav = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [code, setCode] = useState('');
  const [tests, setTests] = useState<Array<{ id: string; title: string; public_code: string; duration_minutes: number; center_id: string | null }>>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    const s = loadSession();
    if (!s) { nav('/login'); return; }
    setSession(s);
    document.documentElement.setAttribute('data-theme', localStorage.getItem('velia_mock_theme') || 'light');
    void (async () => {
      if (s.kind === 'velia') {
        const { data } = await supabase.from('mock_tests').select('id, title, public_code, duration_minutes, center_id').eq('is_published', true).eq('center_id', s.center_id).order('created_at', { ascending: false });
        setTests(data || []);
      } else {
        const { data } = await supabase.from('mock_tests').select('id, title, public_code, duration_minutes, center_id').eq('is_published', true).order('created_at', { ascending: false }).limit(50);
        setTests(data || []);
      }
    })();
  }, [nav]);

  const openTest = async (testId: string) => {
    if (!session) return;
    if (session.kind === 'velia') { nav(`/exam/${testId}`); return; }
    const { data: paid } = await supabase.from('mock_test_payments').select('id').eq('test_id', testId).eq('public_user_id', session.public_id).eq('status', 'paid').maybeSingle();
    if (paid) nav(`/exam/${testId}`);
    else nav(`/pay/${testId}`);
  };

  const search = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    const { data } = await supabase.from('mock_tests').select('id, title, public_code, center_id').eq('public_code', code.trim().toUpperCase()).maybeSingle();
    if (!data) { setError('Test topilmadi'); return; }
    if (session?.kind === 'velia' && data.center_id && data.center_id !== session.center_id) {
      setError('Bu test boshqa markazniki.');
      return;
    }
    await openTest(data.id);
  };

  if (!session) return null;

  return (
    <div className="page">
      <div className="top">
        <div>
          <div className="brand-row" style={{ marginBottom: 8 }}><div className="brand-mark">M</div><div className="brand-name">Velia Mock</div></div>
          <h1 style={{ fontSize: '1.2rem' }}>{session.full_name}</h1>
          <p className="muted">{session.kind === 'velia' ? 'Velia oquvchisi · bepul' : `Tashqi · ${UNIT_PRICE} som/savol`}</p>
        </div>
        <button className="btn btn-secondary" type="button" onClick={() => { clearSession(); nav('/login'); }}><LogOut size={16} /> Chiqish</button>
      </div>
      <form className="card" onSubmit={search}>
        <strong>Test kodi</strong>
        <input className="input" value={code} onChange={(e) => setCode(e.target.value)} placeholder="VL-MK-..." />
        {error && <div className="error" style={{ marginTop: 10 }}>{error}</div>}
        <button className="btn btn-primary" type="submit" style={{ marginTop: 12 }}><Search size={16} /> Topish</button>
      </form>
      <div className="card">
        <strong>Mavjud testlar</strong>
        {!tests.length && <p className="muted">Hali test yoq</p>}
        {tests.map((t) => (
          <button key={t.id} type="button" className="test-item" onClick={() => void openTest(t.id)}>
            <div style={{ fontWeight: 700 }}>{t.title}</div>
            <div className="muted">{t.public_code} · {t.duration_minutes} daq · {session.kind === 'public' ? `${UNIT_PRICE} som/savol` : 'bepul'}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
