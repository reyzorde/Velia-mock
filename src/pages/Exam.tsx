import { useEffect, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { useNavigate, useParams } from 'react-router-dom';
import { attachExamGuards, enterExamFullscreen, stopAlarm } from '../lib/exam-security';
import { resolveStudent, type StudentLink } from '../lib/student';
import { supabase } from '../lib/supabase';

export default function Exam({ user }: { user: User }) {
  const { id } = useParams();
  const nav = useNavigate();
  const [student, setStudent] = useState<StudentLink | null>(null);
  const [test, setTest] = useState<{ title: string; duration_minutes: number } | null>(null);
  const [questions, setQuestions] = useState<Array<{ id: string; prompt: string; points: number; image_url?: string | null }>>([]);
  const [options, setOptions] = useState<Record<string, Array<{ id: string; label: string; is_correct: boolean }>>>({});
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [done, setDone] = useState<{ score: number; max: number } | null>(null);
  const [warn, setWarn] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [confirmStart, setConfirmStart] = useState(true);
  const [exitCountdown, setExitCountdown] = useState<number | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const finishedRef = useRef(false);
  const exitTimerRef = useRef<number | null>(null);

  useEffect(() => {
    void (async () => {
      const st = await resolveStudent(user.email || undefined);
      setStudent(st);
      if (!st) {
        const { data: paid } = await supabase.from('mock_test_payments').select('id').eq('test_id', id!).eq('user_id', user.id).eq('status', 'paid').maybeSingle();
        if (!paid) { nav(`/pay/${id}`, { replace: true }); return; }
      }
      const { data: t } = await supabase.from('mock_tests').select('title, duration_minutes').eq('id', id!).maybeSingle();
      setTest(t);
      const { data: qs } = await supabase.from('mock_questions').select('id, prompt, points, image_url, image_path').eq('test_id', id!).order('sort_order');
      const list = (qs || []).map((q: any) => ({ id: q.id, prompt: q.prompt, points: Number(q.points) || 1, image_url: q.image_url || q.image_path }));
      setQuestions(list);
      const map: typeof options = {};
      for (const q of list) {
        const { data: opts } = await supabase.from('mock_question_options').select('id, label, is_correct').eq('question_id', q.id).order('sort_order');
        map[q.id] = opts || [];
      }
      setOptions(map);
    })();
  }, [id, nav, user]);

  const finish = async (auto = false) => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    stopAlarm();
    cleanupRef.current?.();
    setExitCountdown(null);
    let score = 0, max = 0, correct = 0;
    for (const q of questions) {
      max += q.points;
      const c = (options[q.id] || []).find((o) => o.is_correct);
      if (c && answers[q.id] === c.id) { score += q.points; correct += 1; }
    }
    const payload: Record<string, unknown> = {
      test_id: id, score, max_score: max,
      percentage: max ? Math.round((score / max) * 100) : 0,
      correct_count: correct, wrong_count: questions.length - correct,
      status: auto ? 'auto_submitted' : 'completed', completed_at: new Date().toISOString(),
    };
    if (student) { payload.student_id = student.id; payload.center_id = student.center_id; }
    await supabase.from('mock_attempts').insert(payload);
    setDone({ score, max });
    try { await document.exitFullscreen?.(); } catch { /* */ }
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
    if (exitCountdown <= 0) { void finish(true); return; }
    exitTimerRef.current = window.setTimeout(() => setExitCountdown((c) => (c == null ? c : c - 1)), 1000);
    return () => { if (exitTimerRef.current) clearTimeout(exitTimerRef.current); };
  }, [exitCountdown]);

  useEffect(() => {
    if (secondsLeft == null || done || confirmStart) return;
    if (secondsLeft <= 0) { void finish(true); return; }
    const t = window.setTimeout(() => setSecondsLeft((s) => (s == null ? s : s - 1)), 1000);
    return () => clearTimeout(t);
  }, [secondsLeft, done, confirmStart]);

  useEffect(() => () => { cleanupRef.current?.(); stopAlarm(); }, []);

  const resume = async () => {
    stopAlarm(); setWarn(false); setExitCountdown(null);
    await enterExamFullscreen();
  };

  if (done) {
    return (
      <div className="page"><div className="glass card" style={{ maxWidth: 480 }}>
        <h1>Natija</h1>
        <p style={{ fontSize: 32, fontWeight: 800 }}>{done.score} / {done.max}</p>
        <button className="btn btn-primary" type="button" onClick={() => nav('/')}>Bosh sahifa</button>
      </div></div>
    );
  }
  if (!test) return <div className="auth-wrap">Yuklanmoqda...</div>;
  if (confirmStart) {
    return (
      <div className="page"><div className="glass card" style={{ maxWidth: 560 }}>
        <h1>{test.title}</h1>
        <p className="muted">Vaqt: {test.duration_minutes} daqiqa · savollar: {questions.length || '...'}</p>
        <p>Fullscreen rejim. Chiqib ketsangiz signal ishlaydi.</p>
        <button className="btn btn-primary" type="button" onClick={() => void startExam()} disabled={!questions.length}>Boshlash</button>
      </div></div>
    );
  }

  const mm = secondsLeft != null ? Math.floor(secondsLeft / 60) : 0;
  const ss = secondsLeft != null ? secondsLeft % 60 : 0;

  return (
    <div className="page">
      {(warn || exitCountdown != null) && (
        <div className="overlay"><div className="glass card" style={{ maxWidth: 420 }}>
          <h2 style={{ color: '#fecaca' }}>Diqqat!</h2>
          <p>Fullscreen dan chiqdingiz.</p>
          {!student && exitCountdown != null && <p><strong>{exitCountdown}</strong> soniya ichida qayting.</p>}
          <button className="btn btn-primary" type="button" onClick={() => void resume()}>Testga qaytish</button>
        </div></div>
      )}
      <div className="layout-top">
        <div>
          <h1 style={{ fontSize: '1.2rem', marginBottom: 4 }}>{test.title}</h1>
          <p className="muted">Savollar: {questions.length}</p>
        </div>
        <div className="timer">{String(mm).padStart(2, '0')}:{String(ss).padStart(2, '0')}</div>
      </div>
      {questions.map((q, i) => (
        <div className="glass card" key={q.id}>
          <strong>{i + 1}. {q.prompt}</strong>
          {q.image_url && <img src={q.image_url} alt="" style={{ maxWidth: '100%', marginTop: 10, borderRadius: 10 }} />}
          {(options[q.id] || []).map((o) => (
            <button key={o.id} type="button" className={`opt ${answers[q.id] === o.id ? 'active' : ''}`} onClick={() => setAnswers((a) => ({ ...a, [q.id]: o.id }))}>{o.label}</button>
          ))}
        </div>
      ))}
      <button className="btn btn-primary btn-block" type="button" onClick={() => void finish(false)}>Testni yakunlash</button>
    </div>
  );
}
