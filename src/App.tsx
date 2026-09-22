import { lazy, Suspense, useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { Loader2 } from 'lucide-react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { supabase } from './lib/supabase';

const AuthPage = lazy(() => import('./pages/AuthPage'));
const Home = lazy(() => import('./pages/Home'));
const Pay = lazy(() => import('./pages/Pay'));
const Exam = lazy(() => import('./pages/Exam'));

function Spin() {
  return (
    <div className="auth-wrap">
      <Loader2 className="spin" size={28} />
    </div>
  );
}

function Gate({ children }: { children: (user: User) => React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      if (active) setSession(s);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  if (!ready) return <Spin />;
  if (!session?.user) return <Navigate to="/login" replace />;
  return <>{children(session.user)}</>;
}

export default function App() {
  return (
    <Suspense fallback={<Spin />}>
      <Routes>
        <Route path="/login" element={<AuthPage />} />
        <Route path="/" element={<Gate>{(user) => <Home user={user} />}</Gate>} />
        <Route path="/pay/:id" element={<Gate>{(user) => <Pay user={user} />}</Gate>} />
        <Route path="/exam/:id" element={<Gate>{(user) => <Exam user={user} />}</Gate>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
