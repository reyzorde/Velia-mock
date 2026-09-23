import { FormEvent, useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import {
  BookOpen, Clock, Loader2, LogOut, Moon, Search, Sun, User as UserIcon,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import logoLight from '../assets/velia-logo.png';
import logoDark from '../assets/velia-night-logo.png';
import { resolveStudent, type StudentLink } from '../lib/student';
import { supabase } from '../lib/supabase';

const UNIT_PRICE = 100;

export default function Home({ user }: { user: User }) {
  const nav = useNavigate();
  const [student, setStudent] = useState<StudentLink | null>(null);
  const [code, setCode] = useState('');
  const [tests, setTests] = useState<
    Array<{ id: string; title: string; public_code: string; duration_minutes: number; center_id: string | null }>
  >([]);
  const [error, setError] = useState('');
  const [loadingTests, setLoadingTests] = useState(true);
  const [theme, setTheme] = useState(() => localStorage.getItem('velia_mock_theme') || 'dark');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('velia_mock_theme', theme);
  }, [theme]);

  useEffect(() => {
    let active = true;
    void (async () => {
      setLoadingTests(true);
      try {
        const st = await resolveStudent(user.email || undefined);
        if (!active) return;
        setStudent(st);
        if (st) {
          const { data } = await supabase
            .from('mock_tests')
            .select('id, title, public_code, duration_minutes, center_id')
            .eq('is_published', true)
            .eq('center_id', st.center_id)
            .order('created_at', { ascending: false });
          if (active) setTests(data || []);
        } else {
          const { data } = await supabase
            .from('mock_tests')
            .select('id, title, public_code, duration_minutes, center_id')
            .eq('is_published', true)
            .order('created_at', { ascending: false })
            .limit(40);
          if (active) setTests(data || []);
        }
      } finally {
        if (active) setLoadingTests(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [user.email]);

  const openTest = async (testId: string) => {
    if (student) {
      nav(`/exam/${testId}`);
      return;
    }
    const { data: paid } = await supabase
      .from('mock_test_payments')
      .select('id')
      .eq('test_id', testId)
      .eq('user_id', user.id)
      .eq('status', 'paid')
      .maybeSingle();
    if (paid) nav(`/exam/${testId}`);
    else nav(`/pay/${testId}`);
  };

  const search = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    const { data } = await supabase
      .from('mock_tests')
      .select('id, public_code, center_id')
      .eq('public_code', code.trim().toUpperCase())
      .maybeSingle();
    if (!data) {
      setError('Test topilmadi');
      return;
    }
    if (student && data.center_id && data.center_id !== student.center_id) {
      setError("Bu test boshqa markazniki — tashqi rejimda pullik.");
      return;
    }
    await openTest(data.id);
  };

  const displayName =
    student?.full_name || user.user_metadata?.full_name || user.email || 'Foydalanuvchi';

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-left">
          <img
            src={theme === 'dark' ? logoDark : logoLight}
            alt="Velia"
            className="brand-logo"
          />
          <div>
            <div className="app-title">Velia Mock</div>
            <div className="muted" style={{ fontSize: 12 }}>Imtihon platformasi</div>
          </div>
        </div>
        <div className="app-header-right">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            aria-label="Theme"
            onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <div className="user-chip">
            <UserIcon size={14} />
            <span>{displayName}</span>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={async () => {
              await supabase.auth.signOut();
              nav('/login', { replace: true });
            }}
          >
            <LogOut size={14} /> Chiqish
          </button>
        </div>
      </header>

      <div className="app-body">
        <aside className="app-side">
          <div className="side-card">
            <div className="eyebrow">Holat</div>
            <strong>{student ? 'Velia o\u2018quvchisi' : 'Tashqi foydalanuvchi'}</strong>
            <p className="muted" style={{ marginTop: 8, fontSize: 13 }}>
              {student
                ? 'Markaz testlari bepul'
                : `${UNIT_PRICE} so\u2018m / savol`}
            </p>
          </div>
          <div className="side-card">
            <div className="eyebrow">Statistika</div>
            <div className="side-stat">
              <BookOpen size={16} />
              <span>{tests.length} ta test</span>
            </div>
          </div>
        </aside>

        <main className="app-main">
          <section className="main-block">
            <h1>Testlar</h1>
            <p className="muted">Kod orqali qidiring yoki ro'yxatdan tanlang.</p>
          </section>

          <div className="content-grid">
            <form className="panel" onSubmit={search}>
              <h2>Test kodi</h2>
              <p className="muted">Markaz bergan kod (masalan VL-MK-A1B2C3)</p>
              <input
                className="input"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="VL-MK-..."
                autoComplete="off"
              />
              {error && <div className="error" style={{ marginTop: 12 }}>{error}</div>}
              <button className="btn btn-primary" type="submit" style={{ marginTop: 14 }}>
                <Search size={16} /> Topish
              </button>
            </form>

            <div className="panel">
              <h2>Mavjud testlar</h2>
              {loadingTests && (
                <div className="inline-load">
                  <Loader2 className="spin" size={20} />
                  <span className="muted">Yuklanmoqda...</span>
                </div>
              )}
              {!loadingTests && !tests.length && (
                <p className="muted">Hali test yo\u2018q</p>
              )}
              {!loadingTests &&
                tests.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className="test-item"
                    onClick={() => void openTest(t.id)}
                  >
                    <div style={{ fontWeight: 700 }}>{t.title}</div>
                    <div className="muted" style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
                      <Clock size={12} />
                      {t.public_code} · {t.duration_minutes} daq ·{' '}
                      {student ? 'bepul' : `${UNIT_PRICE} so'm/savol`}
                    </div>
                  </button>
                ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
