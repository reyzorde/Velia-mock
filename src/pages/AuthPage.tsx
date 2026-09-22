import { FormEvent, useEffect, useState } from 'react';
import { Loader2, Moon, Sun } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { isConfigured, supabase } from '../lib/supabase';

const UNIT_PRICE = 100;

export default function AuthPage() {
  const nav = useNavigate();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem('velia_mock_theme') || 'dark');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('velia_mock_theme', theme);
  }, [theme]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!isConfigured) {
      setError('.env da VITE_SUPABASE_URL va VITE_SUPABASE_ANON_KEY yozing.');
      return;
    }
    setBusy(true);
    try {
      const mail = email.trim().toLowerCase();
      if (mode === 'login') {
        const { error: err } = await supabase.auth.signInWithPassword({ email: mail, password });
        if (err) throw new Error(err.message.includes('Invalid') ? 'Email yoki parol notogri' : err.message);
      } else {
        if (password.length < 6) throw new Error('Parol kamida 6 belgi');
        const { data, error: err } = await supabase.auth.signUp({
          email: mail,
          password,
          options: { data: { full_name: fullName.trim() || mail } },
        });
        if (err) throw new Error(err.message);
        if (!data.session) {
          setError('Emailga tasdiqlash xati yuborilgan bolishi mumkin. Tasdiqlab, keyin kiring.');
          setMode('login');
          return;
        }
      }
      nav('/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Xatolik');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-wrap">
      <div className="glass auth-card">
        <div className="brand">
          <div className="brand-mark">M</div>
          <div className="brand-name">Velia Mock</div>
          <button className="btn btn-secondary" type="button" style={{ marginLeft: 'auto', padding: '8px 10px' }} onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}>
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>
        <h1>{mode === 'login' ? 'Kirish' : "Royxatdan otish"}</h1>
        <p className="sub">
          Email va parol. Velia oquvchisi (email mos) — markaz testlari bepul. Tashqi foydalanuvchi — {UNIT_PRICE} som/savol.
        </p>
        <div className="tabs">
          <button type="button" className={`tab ${mode === 'login' ? 'active' : ''}`} onClick={() => setMode('login')}>Kirish</button>
          <button type="button" className={`tab ${mode === 'register' ? 'active' : ''}`} onClick={() => setMode('register')}>Royxat</button>
        </div>
        <form onSubmit={submit}>
          {error && <div className="error">{error}</div>}
          {mode === 'register' && (
            <div className="field">
              <label>Ism</label>
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" />
            </div>
          )}
          <div className="field">
            <label>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          </div>
          <div className="field">
            <label>Parol</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
          </div>
          <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
            {busy ? <Loader2 className="spin" size={18} /> : null}
            {busy ? '...' : mode === 'login' ? 'Kirish' : "Royxatdan otish"}
          </button>
        </form>
      </div>
    </div>
  );
}
