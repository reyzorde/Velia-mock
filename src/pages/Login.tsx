import { FormEvent, useEffect, useState } from 'react';
import { Loader2, Moon, Sun } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { isConfigured, supabase } from '../lib/supabase';
import { normalizePhone, saveSession } from '../lib/session';

const UNIT_PRICE = 100;

export default function Login() {
  const nav = useNavigate();
  const [tab, setTab] = useState<'velia' | 'register'>('velia');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem('velia_mock_theme') || 'light');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('velia_mock_theme', theme);
  }, [theme]);

  const loginVelia = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!isConfigured) {
      setError('.env ga VITE_SUPABASE_URL va VITE_SUPABASE_ANON_KEY yozing.');
      return;
    }
    setBusy(true);
    try {
      const name = fullName.trim();
      const tail = normalizePhone(phone).replace(/\D/g, '').slice(-9);
      if (!name || tail.length < 9) throw new Error('Ism va telefon tolik kiriting.');
      const { data: rows, error: err } = await supabase
        .from('students')
        .select('id, full_name, phone, center_id, status')
        .eq('status', 'active')
        .ilike('full_name', name)
        .limit(25);
      if (err) throw new Error(err.message);
      const matched = (rows || []).filter((s) => {
        const sp = (s.phone || '').replace(/\D/g, '');
        return sp.endsWith(tail) || sp.includes(tail);
      });
      if (!matched.length) throw new Error('Velia oquvchisi topilmadi. Royxatdan oting (pullik).');
      const s = matched[0];
      saveSession({ kind: 'velia', student_id: s.id, full_name: s.full_name, center_id: s.center_id, phone: s.phone || phone });
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
    if (!isConfigured) { setError('.env sozlanmagan.'); return; }
    setBusy(true);
    try {
      const id = crypto.randomUUID();
      const payload = { id, full_name: fullName.trim(), phone: normalizePhone(phone) };
      await supabase.from('mock_public_users').insert(payload);
      saveSession({ kind: 'public', public_id: id, full_name: payload.full_name, phone: payload.phone });
      nav('/');
    } catch (e2) {
      setError(e2 instanceof Error ? e2.message : 'Xato');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page">
      <div className="brand-row">
        <div className="brand-mark">M</div>
        <div className="brand-name">Velia Mock</div>
        <button className="btn btn-secondary" type="button" style={{ marginLeft: 'auto', padding: '8px 10px' }} onClick={() => setTheme((t) => (t === 'light' ? 'dark' : 'light'))}>
          {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
        </button>
      </div>
      <h1>Mock test platformasi</h1>
      <p className="muted">Velia oquvchisi (ism + telefon) bepul. Tashqi — {UNIT_PRICE} som/savol. UUID yoq.</p>
      <div className="tabs">
        <button type="button" className={`tab ${tab === 'velia' ? 'active' : ''}`} onClick={() => setTab('velia')}>Velia oquvchisi</button>
        <button type="button" className={`tab ${tab === 'register' ? 'active' : ''}`} onClick={() => setTab('register')}>Royxatdan otish</button>
      </div>
      {tab === 'velia' ? (
        <form className="card" onSubmit={loginVelia}>
          {error && <div className="error">{error}</div>}
          <div className="field"><label>Toliq ism</label><input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} required /></div>
          <div className="field"><label>Telefon</label><input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} required inputMode="tel" placeholder="+998..." /></div>
          <button className="btn btn-primary btn-block" type="submit" disabled={busy}>{busy ? <Loader2 size={18} /> : null} {busy ? '...' : 'Kirish (bepul)'}</button>
        </form>
      ) : (
        <form className="card" onSubmit={registerPublic}>
          {error && <div className="error">{error}</div>}
          <div className="field"><label>Ism</label><input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} required /></div>
          <div className="field"><label>Telefon</label><input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} required inputMode="tel" /></div>
          <button className="btn btn-primary btn-block" type="submit" disabled={busy}>{busy ? '...' : 'Royxatdan otish'}</button>
        </form>
      )}
    </div>
  );
}
