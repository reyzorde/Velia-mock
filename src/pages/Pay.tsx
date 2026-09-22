import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { loadSession } from '../lib/session';
import { supabase } from '../lib/supabase';

const UNIT_PRICE = 100;
const BOT = 'https://t.me/velia_adminbot';

export default function Pay() {
  const { id } = useParams();
  const nav = useNavigate();
  const session = loadSession();
  const [test, setTest] = useState<{ title: string; public_code: string } | null>(null);
  const [qCount, setQCount] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!session || session.kind !== 'public') { nav('/login'); return; }
    void (async () => {
      const { data: t } = await supabase.from('mock_tests').select('title, public_code').eq('id', id!).maybeSingle();
      setTest(t);
      const { count } = await supabase.from('mock_questions').select('*', { count: 'exact', head: true }).eq('test_id', id!);
      setQCount(count || 0);
    })();
  }, [id, nav, session]);

  const amount = qCount * UNIT_PRICE;

  const demoPay = async () => {
    if (!session || session.kind !== 'public' || !id) return;
    setBusy(true);
    try {
      await supabase.from('mock_test_payments').upsert({
        test_id: id, public_user_id: session.public_id, amount, status: 'paid',
        full_name: session.full_name, phone: session.phone,
      }, { onConflict: 'test_id,public_user_id' });
      nav(`/exam/${id}`);
    } finally { setBusy(false); }
  };

  return (
    <div className="page">
      <div className="card">
        <h1>Tolov</h1>
        <p>Test: <strong>{test?.title || '...'}</strong></p>
        <p className="muted">Kod: {test?.public_code}</p>
        <p>Savollar: <strong>{qCount}</strong> x {UNIT_PRICE} = <strong>{amount.toLocaleString()} som</strong></p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
          <a className="btn btn-primary" href={BOT} target="_blank" rel="noreferrer">Admin bot</a>
          <button className="btn btn-secondary" type="button" disabled={busy || !qCount} onClick={() => void demoPay()}>{busy ? '...' : 'Demo tolov'}</button>
          <button className="btn btn-secondary" type="button" onClick={() => nav('/')}>Orqaga</button>
        </div>
      </div>
    </div>
  );
}
