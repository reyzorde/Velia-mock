import { useEffect, useMemo, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CheckCircle2, Flag, Loader2 } from 'lucide-react';
import { attachExamGuards, enterExamFullscreen, stopAlarm } from '../lib/exam-security';
import { resolveStudent, type StudentLink } from '../lib/student';
import { supabase } from '../lib/supabase';

const VELIA_APP_URL = 'https://veliaapp.netlify.app/';

export default function Exam({ user }: { user: User }) {
  const { id } = useParams();
  const nav = useNavigate();
  const [student, setStudent] = useState<StudentLink | null>(null);
  const [test, setTest] = useState<{ title: string; duration_minutes: number } | null>(null);
  const [questions, setQuestions] = useState<
    Array<{ id: string; prompt: string; points: number; image_url?: string | null }>
  >([]);
  const [options, setOptions] = useState<
    Record<string, Array<{ id: string; label: string; is_correct: boolean }>>
  >({});
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [textAnswers, setTextAnswers] = useState<Record<string, string>>({});
  const [marked, setMarked] = useState<Record<string, boolean>>({});
  const [current, setCurrent] = useState(0);
  const [done, setDone] = useState<{ score: number; max: number; correct: number; wrong: number; blank: number } | null>(null);
  const [warn, setWarn] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [confirmStart, setConfirmStart] = useState(true);
  const [showFinish, setShowFinish] = useState(false);
  const [exitCountdown, setExitCountdown] = useState<number | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const finishedRef = useRef(false);
  const exitTimerRef = useRef<number | null>(null);
  const answersRef = useRef(answers);
  answersRef.current = answers;

  useEffect(() => {
    void (async () => {
      const st = await resolveStudent(user.email || undefined);
      setStudent(st);
      if (!st) {
        const { data: paid } = await supabase
          .from('mock_test_payments')
          .select('id')
          .eq('test_id', id!)
          .eq('user_id', user.id)
          .eq('status', 'paid')
          .maybeSingle();
        if (!paid) {
          nav(`/pay/${id}`, { replace: true });
          return;
        }
      }
      const { data: t } = await supabase
        .from('mock_tests')
        .select('title, duration_minutes')
        .eq('id', id!)
        .maybeSingle();
      setTest(t);
      const { data: qs } = await supabase
        .from('mock_questions')
        .select('id, prompt, points, image_url, image_path, question_type')
        .eq('test_id', id!)
        .order('sort_order');
      const list = (qs || []).map((q: any) => ({
        id: q.id,
        prompt: q.prompt,
        points: Number(q.points) || 1,
        image_url: q.image_url || q.image_path,
      }));
      setQuestions(list);
      const ids = list.map((q) => q.id);
      if (ids.length) {
        const { data: opts } = await supabase
          .from('mock_question_options')
          .select('id, question_id, label, is_correct, sort_order')
          .in('question_id', ids)
          .order('sort_order');
        const map: Record<string, Array<{ id: string; label: string; is_correct: boolean }>> = {};
        for (const o of opts || []) {
          if (!map[o.question_id]) map[o.question_id] = [];
          map[o.question_id].push({ id: o.id, label: o.label, is_correct: o.is_correct });
        }
        setOptions(map);
      }
    })();
  }, [id, user.email, user.id, nav]);

  const finish = async (auto = false) => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    cleanupRef.current?.();
    stopAlarm();
    let score = 0;
    let max = 0;
    let correct = 0;
    let wrong = 0;
    let blank = 0;
    for (const q of questions) {
      max += q.points;
      const opts = options[q.id] || [];
      const ans = answersRef.current[q.id];
      if (!ans && !textAnswers[q.id]?.trim()) {
        blank++;
        continue;
      }
      const ok = opts.find((o) => o.id === ans)?.is_correct;
      if (ok) {
        score += q.points;
        correct++;
      } else wrong++;
    }
    setDone({ score, max, correct, wrong, blank });
    setShowFinish(false);
    try {
      await supabase.from('mock_attempts').insert({
        test_id: id,
        student_id: student?.id || null,
        external_user_id: student ? null : user.id,
        center_id: student?.center_id || null,
        status: auto ? 'auto_submitted' : 'completed',
        score,
        max_score: max,
        percentage: max ? Math.round((score / max) * 1000) / 10 : 0,
        correct_count: correct,
        wrong_count: wrong,
        unanswered_count: blank,
        completed_at: new Date().toISOString(),
      });
    } catch {
      /* ignore */
    }
    try {
      await document.exitFullscreen?.();
    } catch {
      /* */
    }
  };

  const startExam = async () => {
    setConfirmStart(false);
    if (test?.duration_minutes) setSecondsLeft(test.duration_minutes * 60);
    await enterExamFullscreen();
    cleanupRef.current = attachExamGuards(() => {
      setWarn(true);
      if (!student) setExitCountdown(30);
      else void finish(true);
    });
  };

  useEffect(() => {
    if (exitCountdown == null) return;
    if (exitCountdown <= 0) {
      void finish(true);
      return;
    }
    exitTimerRef.current = window.setTimeout(
      () => setExitCountdown((c) => (c == null ? c : c - 1)),
      1000
    );
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

  useEffect(
    () => () => {
      cleanupRef.current?.();
      stopAlarm();
    },
    []
  );

  const resume = async () => {
    stopAlarm();
    setWarn(false);
    setExitCountdown(null);
    await enterExamFullscreen();
  };

  const answeredCount = useMemo(
    () => questions.filter((q) => answers[q.id] || textAnswers[q.id]?.trim()).length,
    [questions, answers, textAnswers]
  );

  const formatTime = (s: number | null) => {
    if (s == null) return '--:--:--';
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  if (!test) {
    return (
      <div className="exam-boot">
        <Loader2 className="spin" size={28} />
      </div>
    );
  }

  if (done) {
    return (
      <div className="exam-shell result-shell">
        <div className="exam-card result-card">
          <img
            src="/assets/velia-logo.png"
            alt="Velia"
            className="exam-logo"
            onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')}
          />
          <h1>Imtihon natijasi</h1>
          <p className="muted">{test.title}</p>
          <div className="result-score">
            {done.score} <span>/ {done.max}</span>
          </div>
          <div className="result-grid">
            <div>
              <span className="muted">Togri</span>
              <strong>{done.correct}</strong>
            </div>
            <div>
              <span className="muted">Xato</span>
              <strong>{done.wrong}</strong>
            </div>
            <div>
              <span className="muted">Javobsiz</span>
              <strong>{done.blank}</strong>
            </div>
          </div>
          <button className="btn btn-primary" type="button" onClick={() => nav('/')}>
            Bosh sahifa
          </button>
        </div>
      </div>
    );
  }

  if (confirmStart) {
    return (
      <div className="exam-shell start-shell">
        <div className="start-grid">
          <div className="exam-card start-main">
            <img
              src="/assets/velia-logo.png"
              alt="Velia"
              className="exam-logo"
              onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')}
            />
            <div className="eyebrow">VELIA MOCK</div>
            <h1>{test.title}</h1>
            <ul className="start-meta">
              <li>{questions.length || '—'} ta savol</li>
              <li>{test.duration_minutes} daqiqa</li>
              <li>Fullscreen imtihon rejimi</li>
            </ul>
            <p className="muted">Testni boshlashdan oldin tayyorlaning. Chiqib ketish signal bilan kuzatiladi.</p>
            <button
              className="btn btn-primary btn-xl"
              type="button"
              onClick={() => void startExam()}
              disabled={!questions.length}
            >
              TESTNI BOSHLASH
            </button>
          </div>
          <aside className="exam-card promo-card">
            <div className="eyebrow">VELIA APP</div>
            <h2>Oquv markazingizni bir joydan boshqaring</h2>
            <ul className="promo-list">
              <li>Oquvchilar va guruhlar</li>
              <li>Davomat nazorati</li>
              <li>Tolovlar</li>
              <li>Ota-ona aloqasi</li>
            </ul>
            <a className="btn btn-secondary" href={VELIA_APP_URL} target="_blank" rel="noreferrer">
              Velia App
            </a>
          </aside>
        </div>
      </div>
    );
  }

  const q = questions[current];
  const lowTime = secondsLeft != null && secondsLeft < 300;

  return (
    <div className="exam-shell cbt-shell">
      {(warn || exitCountdown != null) && (
        <div className="exam-overlay">
          <div className="exam-card warn-card">
            <h2>Diqqat</h2>
            <p>Fullscreen rejimdan chiqdingiz.</p>
            {!student && exitCountdown != null && (
              <p>
                <strong>{exitCountdown}</strong> soniya ichida qayting — aks holda test yakunlanadi.
              </p>
            )}
            <button className="btn btn-primary" type="button" onClick={() => void resume()}>
              Testga qaytish
            </button>
          </div>
        </div>
      )}

      {showFinish && (
        <div className="exam-overlay">
          <div className="exam-card finish-card">
            <h2>Testni yakunlash</h2>
            <p>Jami: {questions.length}</p>
            <p>Ishlangan: {answeredCount}</p>
            <p>Ishlanmagan: {questions.length - answeredCount}</p>
            <p>Belgilangan: {Object.values(marked).filter(Boolean).length}</p>
            <div className="finish-actions">
              <button className="btn btn-secondary" type="button" onClick={() => setShowFinish(false)}>
                Testga qaytish
              </button>
              <button className="btn btn-primary" type="button" onClick={() => void finish(false)}>
                Yakunlash
              </button>
            </div>
          </div>
        </div>
      )}

      <header className="cbt-header">
        <div className="cbt-brand">
          <img
            src="/assets/velia-logo.png"
            alt=""
            className="exam-logo-sm"
            onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')}
          />
          <div>
            <div className="cbt-title">{test.title}</div>
            <div className="muted" style={{ fontSize: 12 }}>
              {answeredCount}/{questions.length} javob
            </div>
          </div>
        </div>
        <div className={`cbt-timer ${lowTime ? 'warn' : ''}`}>{formatTime(secondsLeft)}</div>
      </header>

      <div className="cbt-body">
        <section className="cbt-main exam-card">
          {q && (
            <>
              <div className="q-num">QUESTION {current + 1}</div>
              <h2 className="q-text">{q.prompt}</h2>
              {q.image_url && <img src={q.image_url} alt="" className="q-img" />}
              {(options[q.id] || []).length > 0 ? (
                <div className="opt-list">
                  {(options[q.id] || []).map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      className={`opt-card ${answers[q.id] === o.id ? 'active' : ''}`}
                      onClick={() => setAnswers((a) => ({ ...a, [q.id]: o.id }))}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              ) : (
                <textarea
                  className="written-input"
                  rows={5}
                  placeholder="Javobingizni yozing..."
                  value={textAnswers[q.id] || ''}
                  onChange={(e) => setTextAnswers((t) => ({ ...t, [q.id]: e.target.value }))}
                />
              )}
              <div className="cbt-nav-btns">
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={current === 0}
                  onClick={() => setCurrent((c) => Math.max(0, c - 1))}
                >
                  <ArrowLeft size={16} /> Oldingi
                </button>
                <button
                  type="button"
                  className={`btn ${marked[q.id] ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setMarked((m) => ({ ...m, [q.id]: !m[q.id] }))}
                >
                  <Flag size={16} /> {marked[q.id] ? 'Belgilandi' : 'Belgilash'}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={current >= questions.length - 1}
                  onClick={() => setCurrent((c) => Math.min(questions.length - 1, c + 1))}
                >
                  Keyingi <ArrowRight size={16} />
                </button>
              </div>
            </>
          )}
        </section>

        <aside className="cbt-side exam-card">
          <div className="nav-label">Savollar</div>
          <div className="q-nav">
            {questions.map((item, i) => {
              const answered = Boolean(answers[item.id] || textAnswers[item.id]?.trim());
              const cls = [
                'q-dot',
                i === current ? 'current' : '',
                answered ? 'done' : '',
                marked[item.id] ? 'flag' : '',
              ]
                .filter(Boolean)
                .join(' ');
              return (
                <button key={item.id} type="button" className={cls} onClick={() => setCurrent(i)}>
                  {i + 1}
                </button>
              );
            })}
          </div>
          <button className="btn btn-primary btn-block" type="button" onClick={() => setShowFinish(true)}>
            <CheckCircle2 size={16} /> Yakunlash
          </button>
        </aside>
      </div>
    </div>
  );
}
