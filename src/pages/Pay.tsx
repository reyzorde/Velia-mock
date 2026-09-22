import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { useNavigate, useParams } from 'react-router-dom';
import { resolveStudent } from '../lib/student';
import { supabase } from '../lib/supabase';

const UNIT_PRICE = 100;
const BOT = 'https://t.me/velia_adminbot';

export default function Pay({ user }: { user: User }) {
  const { id } = useParams();
  const nav = useNavigate();
  const [test, setTest] = useState<{ title: string; public_code: string } | null>(null);
  const [qCount, setQCount] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      const st = await resolveStudent(user.email || undefined);
      if (st) { nav(`/exam/${id}`, { replace: true }); return; }
      const { data: t } = await supabase.from('mock_tests').select('title, public_code').eq('id', id!).maybeSingle();
      setTest(t);
      const { count } = await supabase.from('mock_questions').select('*', { count: 'exact', head: true }).eq('test_id', id!);
      setQCount(count || 0);
    })();
  }, [id, nav, user.email]);

  const amount = qCount * UNIT_PRICE;

  const demoPay = async () => {
    if (!id) return;
    setBusy(true);
    try {
      await supabase.from('mock_test_payments').upsert({
        test_id: id, user_id: user.id, amount, status: 'paid',
        full_name: user.user_metadata?.full_name || user.email, email: user.email,
      }, { onConflict: 'test_id,user_id' });
      nav(`/exam/${id}`);
    } finally { setBusy(false); }
  };

  return (
    <div className="page">
      <div className="glass card" style={{ maxWidth: 520 }}>
        <h1>Tolov</h1>
        <p>Test: <strong>{test?.title || '...'}</strong></p>
        <p className="muted">Kod: {test?.public_code}</p>
        <p>Savollar: <strong>{qCount}</strong> x {UNIT_PRICE} = <strong>{amount.toLocaleString()} som</strong></p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 16 }}>
          <a className="btn btn-primary" href={BOT} target="_blank" rel="noreferrer">Admin bot</a>
          <button className="btn btn-secondary" type="button" disabled={busy || !qCount} onClick={() => void demoPay()}>{busy ? '...' : 'Demo tolov'}</button>
          <button className="btn btn-secondary" type="button" onClick={() => nav('/')}>Orqaga</button>
        </div>
      </div>
    </div>
  );
}
