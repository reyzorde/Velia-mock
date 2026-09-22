import { FormEvent, useEffect, useRef, useState } from 'react';
import { Routes, Route, Navigate, useNavigate, useParams } from 'react-router-dom';
import { supabase, isConfigured } from './lib/supabase';
import { attachExamGuards, enterExamFullscreen, stopAlarm } from './lib/exam-security';

const UNIT_PRICE = 100; // so'm / savol
const BOT = 'https://t.me/velia_adminbot';

type VeliaSession = {
  kind: 'velia';
  student_id: string;
  full_name: string;
  center_id: string;
};

type PublicSession = {
  kind: 'public';
  public_id: string;
  full_name: string;
  phone: string;
};

type Session = VeliaSession | PublicSession;

function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem('velia_mock_session');
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

function saveSession(s: Session) {
  localStorage.setItem('velia_mock_session', JSON.stringify(s));
}

function Login() {
  const nav = useNavigate();
  const [tab, setTab] = useState<'velia' | 'register'>('velia');
  const [studentId, setStudentId] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const loginVelia = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!isConfigured) {
      setError('.env da Supabase kalitlarini yozing va npm run dev ni qayta ishga tushiring.');
      return;
    }
    setBusy(true);
    try {
      const { data, error: err } = await supabase
        .from('students')
        .select('id, full_name, center_id, status')
        .eq('id', studentId.trim())
        .maybeSingle();
      if (err || !data) throw new Error('Velia o‘quvchisi topilmadi. ID ni markazdan oling.');
      if (data.status !== 'active') throw new Error('O‘quvchi nofaol.');
      saveSession({
        kind: 'velia',
        student_id: data.id,
        full_name: data.full_name,
        center_id: data.center_id,
      });
      nav('/');
    } catch (e2) {
      setError(e2 instanceof Error ? e2.message : 'Xato');
    } finally {
      setBusy(false);
    }
  };

  const registerPublic = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!isConfigured) {
      setError('.env sozlanmagan.');
      return;
    }
    setBusy(true);
    try {
      const id = crypto.randomUUID();
      const { data, error: err } = await supabase
        .from('mock_public_users')
        .insert({ id, full_name: fullName.trim(), phone: phone.trim() })
        .select('id, full_name, phone')
        .single();

      if (err || !data) {
        // table yo'q bo'lsa ham local session
        saveSession({
          kind: 'public',
          public_id: id,
          full_name: fullName.trim(),
          phone: phone.trim(),
        });
      } else {
        saveSession({
          kind: 'public',
          public_id: data.id,
          full_name: data.full_name,
          phone: data.phone,
        });
      }
      nav('/');
    } catch (e2) {
      setError(e2 instanceof Error ? e2.message : 'Xato');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page">
      <h1>Velia Mock</h1>
      <p className="muted">
        Velia o‘quvchisi — o‘z markazi testlari <strong>bepul</strong>. Ro‘yxatdan o‘tgan tashqi foydalanuvchi — har savol{' '}
        <strong>{UNIT_PRICE} so‘m</strong>.
      </p>
      <div className="tabs">
        <button type="button" className="btn" style={{ opacity: tab === 'velia' ? 1 : 0.55 }} onClick={() => setTab('velia')}>
          Velia o‘quvchisi
        </button>
        <button type="button" className="btn secondary" style={{ opacity: tab === 'register' ? 1 : 0.55 }} onClick={() => setTab('register')}>
          Ro‘yxatdan o‘tish
        </button>
      </div>

      {tab === 'velia' ? (
        <form className="card" onSubmit={loginVelia}>
          <label className="muted">O‘quvchi ID</label>
          <input className="input" value={studentId} onChange={(e) => setStudentId(e.target.value)} required placeholder="UUID" />
          {error && <p className="error">{error}</p>}
          <button className="btn" type="submit" disabled={busy} style={{ marginTop: 12 }}>
            {busy ? '...' : 'Kirish (bepul)'}
          </button>
        </form>
      ) : (
        <form className="card" onSubmit={registerPublic}>
          <p className="muted">Velia da yo‘q bo‘lsangiz, testlar pullik (savol × {UNIT_PRICE} so‘m).</p>
          <label className="muted">Ism</label>
          <input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          <label className="muted">Telefon</label>
          <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} required />
          {error && <p className="error">{error}</p>}
          <button className="btn" type="submit" disabled={busy} style={{ marginTop: 12 }}>
            {busy ? '...' : 'Ro‘yxatdan o‘tish'}
          </button>
        </form>
      )}
    </div>
  );
}

function Home() {
  const nav = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [code, setCode] = useState('');
  const [tests, setTests] = useState<Array<{ id: string; title: string; public_code: string; duration_minutes: number; center_id: string | null }>>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    const s = loadSession();
    if (!s) {
      nav('/login');
      return;
    }
    setSession(s);
    void (async () => {
      if (s.kind === 'velia') {
        const { data } = await supabase
          .from('mock_tests')
          .select('id, title, public_code, duration_minutes, center_id')
          .eq('is_published', true)
          .eq('center_id', s.center_id)
          .order('created_at', { ascending: false });
        setTests(data || []);
      } else {
        const { data } = await supabase
          .from('mock_tests')
          .select('id, title, public_code, duration_minutes, center_id')
          .eq('is_published', true)
          .order('created_at', { ascending: false })
          .limit(40);
        setTests(data || []);
      }
    })();
  }, [nav]);

  const openTest = async (testId: string) => {
    if (!session) return;
    if (session.kind === 'velia') {
      nav(`/exam/${testId}`);
      return;
    }
    // public: check paid
    const { data: paid } = await supabase
      .from('mock_test_payments')
      .select('id')
      .eq('test_id', testId)
      .eq('public_user_id', session.public_id)
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
      .select('id, title, public_code, center_id')
      .eq('public_code', code.trim().toUpperCase())
      .maybeSingle();
    if (!data) {
      setError('Test topilmadi');
      return;
    }
    if (session?.kind === 'velia' && data.center_id && data.center_id !== session.center_id) {
      setError('Bu test boshqa markazniki — siz uchun bepul emas');
      return;
    }
    await openTest(data.id);
  };

  if (!session) return null;

  return (
    <div className="page">
      <div className="top">
        <div>
          <h1 style={{ marginBottom: 4 }}>{session.full_name}</h1>
          <p className="muted">
            {session.kind === 'velia'
              ? 'Velia o‘quvchisi — markaz testlari bepul'
              : `Tashqi foydalanuvchi — har savol ${UNIT_PRICE} so‘m`}
          </p>
        </div>
        <button
          className="btn secondary"
          type="button"
          onClick={() => {
            localStorage.removeItem('velia_mock_session');
            nav('/login');
          }}
        >
          Chiqish
        </button>
      </div>

      <form className="card" onSubmit={search}>
        <strong>Test kodi (masalan VL-MK-A1B2C3)</strong>
        <input className="input" value={code} onChange={(e) => setCode(e.target.value)} placeholder="VL-MK-..." />
        {error && <p className="error">{error}</p>}
        <button className="btn" type="submit" style={{ marginTop: 10 }}>
          Topish
        </button>
      </form>

      <div className="card">
        <strong>Mavjud testlar</strong>
        {tests.length === 0 && <p className="muted">Hali test yo‘q</p>}
        {tests.map((t) => (
          <button key={t.id} type="button" className="opt" onClick={() => void openTest(t.id)}>
            <div>{t.title}</div>
            <div className="muted">
              {t.public_code} · {t.duration_minutes} daq
              {session.kind === 'public' ? ` · ${UNIT_PRICE} so‘m/savol` : ' · bepul'}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function Pay() {
  const { id } = useParams();
  const nav = useNavigate();
  const session = loadSession();
  const [test, setTest] = useState<{ title: string; public_code: string } | null>(null);
  const [qCount, setQCount] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!session || session.kind !== 'public') {
      nav('/login');
      return;
    }
    void (async () => {
      const { data: t } = await supabase.from('mock_tests').select('title, public_code').eq('id', id!).maybeSingle();
      setTest(t);
      const { count } = await supabase
        .from('mock_questions')
        .select('*', { count: 'exact', head: true })
        .eq('test_id', id!);
      setQCount(count || 0);
    })();
  }, [id, nav, session]);

  const amount = qCount * UNIT_PRICE;

  const demoPay = async () => {
    if (!session || session.kind !== 'public' || !id) return;
    setBusy(true);
    try {
      await supabase.from('mock_test_payments').upsert(
        {
          test_id: id,
          public_user_id: session.public_id,
          amount,
          status: 'paid',
          full_name: session.full_name,
          phone: session.phone,
        },
        { onConflict: 'test_id,public_user_id' }
      );
      nav(`/exam/${id}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page">
      <div className="card">
        <h1>To‘lov</h1>
        <p>
          Test: <strong>{test?.title || '...'}</strong>
        </p>
        <p className="muted">Kod: {test?.public_code}</p>
        <p>
          Savollar: <strong>{qCount}</strong> × {UNIT_PRICE} = <strong>{amount.toLocaleString()} so‘m</strong>
        </p>
        <p className="muted">To‘lovni admin tasdiqlashi mumkin. Demo uchun quyidagi tugma.</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
          <a className="btn" href={BOT} target="_blank" rel="noreferrer">
            @velia_adminbot
          </a>
          <button className="btn" type="button" disabled={busy || qCount === 0} onClick={() => void demoPay()}>
            {busy ? '...' : 'Demo to‘lov → test'}
          </button>
          <button className="btn secondary" type="button" onClick={() => nav('/')}>
            Orqaga
          </button>
        </div>
      </div>
    </div>
  );
}

function Exam() {
  const { id } = useParams();
  const nav = useNavigate();
  const session = loadSession();
  const [test, setTest] = useState<{ title: string; duration_minutes: number } | null>(null);
  const [questions, setQuestions] = useState<Array<{ id: string; prompt: string; points: number; image_url?: string | null }>>([]);
  const [options, setOptions] = useState<Record<string, Array<{ id: string; label: string; is_correct: boolean }>>>({});
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [done, setDone] = useState<{ score: number; max: number } | null>(null);
  const [warn, setWarn] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [confirmStart, setConfirmStart] = useState(true);
  const cleanupRef = useRef<(() => void) | null>(null);
  const finishedRef = useRef(false);
  const exitTimerRef = useRef<number | null>(null);
  const [exitCountdown, setExitCountdown] = useState<number | null>(null);

  useEffect(() => {
    if (!session) {
      nav('/login');
      return;
    }
    void (async () => {
      if (session.kind === 'public') {
        const { data: paid } = await supabase
          .from('mock_test_payments')
          .select('id')
          .eq('test_id', id!)
          .eq('public_user_id', session.public_id)
          .eq('status', 'paid')
          .maybeSingle();
        if (!paid) {
          nav(`/pay/${id}`);
          return;
        }
      }
      const { data: t } = await supabase.from('mock_tests').select('title, duration_minutes').eq('id', id!).maybeSingle();
      setTest(t);
      const { data: qs } = await supabase
        .from('mock_questions')
        .select('id, prompt, points, image_url, image_path')
        .eq('test_id', id!)
        .order('sort_order');
      const list = (qs || []).map((q: any) => ({
        id: q.id,
        prompt: q.prompt,
        points: Number(q.points) || 1,
        image_url: q.image_url || q.image_path,
      }));
      setQuestions(list);
      const map: typeof options = {};
      for (const q of list) {
        const { data: opts } = await supabase
          .from('mock_question_options')
          .select('id, label, is_correct')
          .eq('question_id', q.id)
          .order('sort_order');
        map[q.id] = opts || [];
      }
      setOptions(map);
    })();
  }, [id, nav, session]);

  const startExam = async () => {
    setConfirmStart(false);
    if (test?.duration_minutes) setSecondsLeft(test.duration_minutes * 60);
    await enterExamFullscreen();
    cleanupRef.current = attachExamGuards(() => {
      setWarn(true);
      // external: 30s countdown
      if (session?.kind === 'public') {
        setExitCountdown(30);
      }
    });
  };

  useEffect(() => {
    if (exitCountdown == null) return;
    if (exitCountdown <= 0) {
      void finish(true);
      return;
    }
    exitTimerRef.current = window.setTimeout(() => setExitCountdown((c) => (c == null ? c : c - 1)), 1000);
    return () => {
      if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
    };
  }, [exitCountdown]);

  useEffect(() => {
    if (secondsLeft == null || done || confirmStart) return;
    if (secondsLeft <= 0) {
      void finish(true);
      return;
    }
    const t = window.setTimeout(() => setSecondsLeft((s) => (s == null ? s : s - 1)), 1000);
    return () => clearTimeout(t);
  }, [secondsLeft, done, confirmStart]);

  useEffect(() => {
    return () => {
      cleanupRef.current?.();
      stopAlarm();
    };
  }, []);

  const finish = async (auto = false) => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    stopAlarm();
    cleanupRef.current?.();
    setExitCountdown(null);
    let score = 0;
    let max = 0;
    let correct = 0;
    for (const q of questions) {
      max += q.points;
      const correctOpt = (options[q.id] || []).find((o) => o.is_correct);
      if (correctOpt && answers[q.id] === correctOpt.id) {
        score += q.points;
        correct += 1;
      }
    }
    const payload: Record<string, unknown> = {
      test_id: id,
      score,
      max_score: max,
      percentage: max ? Math.round((score / max) * 100) : 0,
      correct_count: correct,
      wrong_count: questions.length - correct,
      status: auto ? 'auto_submitted' : 'completed',
      completed_at: new Date().toISOString(),
    };
    if (session?.kind === 'velia') {
      payload.student_id = session.student_id;
      payload.center_id = session.center_id;
    }
    await supabase.from('mock_attempts').insert(payload);
    setDone({ score, max });
    try {
      await document.exitFullscreen?.();
    } catch {
      /* */
    }
  };

  const resume = async () => {
    stopAlarm();
    setWarn(false);
    setExitCountdown(null);
    await enterExamFullscreen();
  };

  if (done) {
    return (
      <div className="page">
        <div className="card">
          <h1>Natija</h1>
          <p style={{ fontSize: 28, fontWeight: 800 }}>
            {done.score} / {done.max}
          </p>
          <button className="btn" type="button" onClick={() => nav('/')}>
            Bosh sahifa
          </button>
        </div>
      </div>
    );
  }

  if (!test) return <div className="page">Yuklanmoqda...</div>;

  if (confirmStart) {
    return (
      <div className="page">
        <div className="card">
          <h1>{test.title}</h1>
          <p className="muted">
            Vaqt: {test.duration_minutes} daqiqa · savollar: {questions.length || '...'}
          </p>
          <p>Test fullscreen rejimida ochiladi. Chiqib ketsangiz signal ishlaydi.</p>
          <button className="btn" type="button" onClick={() => void startExam()} disabled={!questions.length}>
            Boshlash
          </button>
        </div>
      </div>
    );
  }

  const mm = secondsLeft != null ? Math.floor(secondsLeft / 60) : 0;
  const ss = secondsLeft != null ? secondsLeft % 60 : 0;

  return (
    <div className="page">
      {(warn || exitCountdown != null) && (
        <div className="overlay">
          <div className="card" style={{ maxWidth: 420 }}>
            <h2 style={{ color: '#fecaca' }}>Diqqat!</h2>
            <p>Fullscreen dan chiqdingiz yoki boshqa oynaga o‘tdingiz.</p>
            {session?.kind === 'public' && exitCountdown != null && (
              <p>
                <strong>{exitCountdown}</strong> soniya ichida qaytmasangiz test yakunlanadi.
              </p>
            )}
            <button className="btn" type="button" onClick={() => void resume()}>
              Testga qaytish
            </button>
          </div>
        </div>
      )}

      <div className="top">
        <div>
          <h1 style={{ margin: '0 0 4px' }}>{test.title}</h1>
          <p className="muted">Savollar: {questions.length}</p>
        </div>
        <div className="timer">
          {String(mm).padStart(2, '0')}:{String(ss).padStart(2, '0')}
        </div>
      </div>

      {questions.map((q, i) => (
        <div className="card" key={q.id}>
          <strong>
            {i + 1}. {q.prompt}
          </strong>
          {q.image_url && (
            <img src={q.image_url} alt="" style={{ maxWidth: '100%', marginTop: 8, borderRadius: 8 }} />
          )}
          {(options[q.id] || []).map((o) => (
            <button
              key={o.id}
              type="button"
              className={`opt ${answers[q.id] === o.id ? 'active' : ''}`}
              onClick={() => setAnswers((a) => ({ ...a, [q.id]: o.id }))}
            >
              {o.label}
            </button>
          ))}
        </div>
      ))}

      <button className="btn" type="button" onClick={() => void finish(false)}>
        Testni yakunlash
      </button>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<Home />} />
      <Route path="/pay/:id" element={<Pay />} />
      <Route path="/exam/:id" element={<Exam />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
