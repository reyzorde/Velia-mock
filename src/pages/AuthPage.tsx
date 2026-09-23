import { FormEvent, useEffect, useRef, useState } from 'react';
import { Loader2, Moon, Sun } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import logoLight from '../assets/velia-logo.png';
import logoDark from '../assets/velia-night-logo.png';
import { clearStoredOtp, generateOtp, sendOtpEmail, verifyStoredOtp } from '../lib/otp';
import { isConfigured, supabase } from '../lib/supabase';

const UNIT_PRICE = 100;
type Mode = 'login' | 'register-email' | 'register-otp' | 'register-password';

export default function AuthPage() {
  const nav = useNavigate();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [fullName, setFullName] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem('velia_mock_theme') || 'dark');
  const otpRefs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('velia_mock_theme', theme);
  }, [theme]);

  const sendRegisterCode = async (e?: FormEvent) => {
    e?.preventDefault();
    setError('');
    setInfo('');
    if (!isConfigured) {
      setError('.env da Supabase + EmailJS kalitlarini yozing.');
      return;
    }
    const mail = email.trim().toLowerCase();
    if (!mail.includes('@')) {
      setError('Email noto\'g\'ri');
      return;
    }
    setBusy(true);
    try {
      const otp = generateOtp();
      await sendOtpEmail(mail, otp);
      setMode('register-otp');
      setInfo("Kod emailga yuborildi. Tasdiqlagach ro'yxatdan o'tasiz.");
      setOtpCode('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kod yuborilmadi');
    } finally {
      setBusy(false);
    }
  };

  const verifyRegisterOtp = (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (otpCode.trim().length !== 6) {
      setError('6 xonali kod kiriting');
      return;
    }
    if (!verifyStoredOtp(email.trim().toLowerCase(), otpCode)) {
      setError("Kod noto'g'ri yoki muddati o'tgan");
      return;
    }
    clearStoredOtp();
    setMode('register-password');
    setInfo('Email tasdiqlandi. Ism va parol kiriting.');
  };

  const completeRegister = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 6) {
      setError('Parol kamida 6 belgi');
      return;
    }
    if (password !== confirm) {
      setError('Parollar mos emas');
      return;
    }
    setBusy(true);
    const mail = email.trim().toLowerCase();
    try {
      const { error: tryLogin } = await supabase.auth.signInWithPassword({ email: mail, password });
      if (!tryLogin) {
        nav('/', { replace: true });
        return;
      }
      const { data, error: err } = await supabase.auth.signUp({
        email: mail,
        password,
        options: { data: { full_name: fullName.trim() || mail } },
      });
      if (err) {
        if (err.status === 422 || /already|registered|exists/i.test(err.message)) {
          throw new Error("Bu email allaqachon bor. «Kirish» orqali to'g'ri parol bilan kiring.");
        }
        throw new Error(err.message);
      }
      if (!data.session) {
        const { error: loginErr } = await supabase.auth.signInWithPassword({ email: mail, password });
        if (loginErr) {
          throw new Error('Hisob yaratildi. Supabase Confirm email ni OCHIRING, keyin kiring.');
        }
      }
      nav('/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Xatolik');
    } finally {
      setBusy(false);
    }
  };

  const login = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!isConfigured) {
      setError('.env sozlanmagan');
      return;
    }
    setBusy(true);
    try {
      const { error: err } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (err) {
        throw new Error(
          err.message.includes('Invalid')
            ? "Email yoki parol noto'gri. Avval ro'yxatdan oting."
            : err.message
        );
      }
      nav('/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Xato');
    } finally {
      setBusy(false);
    }
  };

  const updateOtpDigit = (value: string, index: number) => {
    const digits = value.replace(/\D/g, '');
    const arr = otpCode.padEnd(6, ' ').split('').slice(0, 6);
    if (!digits) {
      arr[index] = ' ';
      setOtpCode(arr.join('').replace(/ /g, ''));
      return;
    }
    for (let i = 0; i < digits.length && index + i < 6; i++) arr[index + i] = digits[i];
    setOtpCode(arr.join('').replace(/ /g, '').slice(0, 6));
    otpRefs.current[Math.min(index + digits.length, 5)]?.focus();
  };

  return (
    <div className="auth-wrap">
      <div className="glass auth-card">
        <div className="brand">
          <img src={theme === 'dark' ? logoDark : logoLight} alt="Velia" className="brand-logo" />
          <div className="brand-name">Mock</div>
          <button
            className="btn btn-ghost btn-sm"
            type="button"
            style={{ marginLeft: 'auto' }}
            onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
            aria-label="Theme"
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>
        <h1>
          {mode === 'login' && 'Kirish'}
          {mode === 'register-email' && "Ro'yxat — email"}
          {mode === 'register-otp' && 'Kodni tasdiqlang'}
          {mode === 'register-password' && "Parol o'rnating"}
        </h1>
        <p className="sub">
          {mode === 'login' && "Email + parol. Velia o'quvchisi bepul, tashqi — ${UNIT_PRICE} so'm/savol."}
          {mode === 'register-email' && "Avval emailga kod. Faqat tasdiqlagach ro'yxatdan o'tasiz."}
          {mode === 'register-otp' && `${email} ga yuborilgan 6 xonali kod.`}
          {mode === 'register-password' && 'Email tasdiqlandi. Ism va parol bilan yakunlang.'}
        </p>
        {(mode === 'login' || mode === 'register-email') && (
          <div className="tabs">
            <button type="button" className={`tab ${mode === 'login' ? 'active' : ''}`} onClick={() => { setMode('login'); setError(''); }}>Kirish</button>
            <button type="button" className={`tab ${mode === 'register-email' ? 'active' : ''}`} onClick={() => { setMode('register-email'); setError(''); }}>Ro'yxat</button>
          </div>
        )}
        {error && <div className="error">{error}</div>}
        {info && !error && <p className="muted" style={{ color: '#34d399' }}>{info}</p>}
        {mode === 'login' && (
          <form onSubmit={login}>
            <div className="field"><label>Email</label><input type="email" name="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
            <div className="field"><label>Parol</label><input type="password" name="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} /></div>
            <button className="btn btn-primary btn-block" type="submit" disabled={busy}>{busy ? <Loader2 className="spin" size={18} /> : null} Kirish</button>
          </form>
        )}
        {mode === 'register-email' && (
          <form onSubmit={sendRegisterCode}>
            <div className="field"><label>Email</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" /></div>
            <button className="btn btn-primary btn-block" type="submit" disabled={busy}>{busy ? '...' : 'Kod yuborish'}</button>
          </form>
        )}
        {mode === 'register-otp' && (
          <form onSubmit={verifyRegisterOtp}>
            <div className="field">
              <label>Kod</label>
              <div className="otp-row">
                {Array.from({ length: 6 }).map((_, i) => (
                  <input key={i} ref={(el) => { otpRefs.current[i] = el; }} inputMode="numeric" maxLength={6} value={otpCode[i] || ''} onChange={(e) => updateOtpDigit(e.target.value, i)} />
                ))}
              </div>
            </div>
            <button className="btn btn-primary btn-block" type="submit">Tasdiqlash</button>
            <button className="btn btn-secondary btn-block" type="button" style={{ marginTop: 8 }} onClick={() => void sendRegisterCode()} disabled={busy}>Qayta yuborish</button>
          </form>
        )}
        {mode === 'register-password' && (
          <form onSubmit={completeRegister}>
            <input type="email" name="username" autoComplete="username" value={email} readOnly hidden aria-hidden />
            <div className="field"><label>Ism</label><input value={fullName} onChange={(e) => setFullName(e.target.value)} /></div>
            <div className="field"><label>Parol</label><input type="password" name="new-password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} /></div>
            <div className="field"><label>Parolni tasdiqlang</label><input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={6} /></div>
            <button className="btn btn-primary btn-block" type="submit" disabled={busy}>{busy ? '...' : "Ro'yxatdan o'tish"}</button>
          </form>
        )}
      </div>
    </div>
  );
}
