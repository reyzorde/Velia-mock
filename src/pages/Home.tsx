import { FormEvent, useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { LogOut, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { resolveStudent, type StudentLink } from '../lib/student';
import { supabase } from '../lib/supabase';

const UNIT_PRICE = 100;

export default function Home({ user }: { user: User }) {
  const nav = useNavigate();
  const [student, setStudent] = useState<StudentLink | null>(null);
  const [code, setCode] = useState('');
  const [tests, setTests] = useState<Array<{ id: string; title: string; public_code: string; duration_minutes: number; center_id: string | null }>>([]);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', localStorage.getItem('velia_mock_theme') || 'dark');
    void (async () => {
      const st = await resolveStudent(user.email || undefined);
      setStudent(st);
      if (st) {
        const { data } = await supabase.from('mock_tests').select('id, title, public_code, duration_minutes, center_id').eq('is_published', true).eq('center_id', st.center_id).order('created_at', { ascending: false });
        setTests(data || []);
      } else {
        const { data } = await supabase.from('mock_tests').select('id, title, public_code, duration_minutes, center_id').eq('is_published', true).order('created_at', { ascending: false }).limit(40);
        setTests(data || []);
      }
      setReady(true);
    })();
  }, [user.email]);

  const openTest = async (testId: string) => {
    if (student) { nav(`/exam/${testId}`); return; }
    const { data: paid } = await supabase.from('mock_test_payments').select('id').eq('test_id', testId).eq('user_id', user.id).eq('status', 'paid').maybeSingle();
    if (paid) nav(`/exam/${testId}`);
    else nav(`/pay/${testId}`);
  };

  const search = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    const { data } = await supabase.from('mock_tests').select('id, public_code, center_id').eq('public_code', code.trim().toUpperCase()).maybeSingle();
    if (!data) { setError('Test topilmadi'); return; }
    if (student && data.center_id && data.center_id !== student.center_id) {
      setError('Bu test boshqa markazniki — tashqi rejimda pullik.');
      return;
    }
    await openTest(data.id);
  };

  if (!ready) return <div className="auth-wrap"><span className="spin">...</span></div>;

  return (
    <div className="page">
      <div className="layout-top">
        <div>
          <div className="brand" style={{ marginBottom: 8 }}>
            <div className="brand-mark">M</div>
            <div className="brand-name">Velia Mock</div>
          </div>
          <h1 style={{ fontSize: '1.35rem' }}>{student?.full_name || user.user_metadata?.full_name || user.email}</h1>
          <p className="muted">{student ? 'Velia oquvchisi · bepul' : `Tashqi · ${UNIT_PRICE} som/savol`}</p>
        </div>
        <button className="btn btn-secondary" type="button" onClick={async () => { await supabase.auth.signOut(); nav('/login', { replace: true }); }}>
          <LogOut size={16} /> Chiqish
        </button>
      </div>
      <div className="grid-2">
        <form className="glass card" onSubmit={search}>
          <h2>Test kodi</h2>
          <p className="muted">Masalan VL-MK-A1B2C3</p>
          <input className="input" value={code} onChange={(e) => setCode(e.target.value)} placeholder="VL-MK-..." />
          {error && <div className="error" style={{ marginTop: 12 }}>{error}</div>}
          <button className="btn btn-primary" type="submit" style={{ marginTop: 14 }}><Search size={16} /> Topish</button>
        </form>
        <div className="glass card">
          <h2>Mavjud testlar</h2>
          {!tests.length && <p className="muted">Hali test yoq</p>}
          {tests.map((t) => (
            <button key={t.id} type="button" className="test-item" onClick={() => void openTest(t.id)}>
              <div style={{ fontWeight: 700 }}>{t.title}</div>
              <div className="muted">{t.public_code} · {t.duration_minutes} daq · {student ? 'bepul' : `${UNIT_PRICE} som/savol`}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
