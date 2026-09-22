import type { Session, User } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { supabase } from './lib/supabase';
import AuthPage from './pages/AuthPage';
import Exam from './pages/Exam';
import Home from './pages/Home';
import Pay from './pages/Pay';

function Gate({ children }: { children: (user: User) => React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (!ready) {
    return (
      <div className="auth-wrap">
        <Loader2 className="spin" size={28} />
      </div>
    );
  }
  if (!session?.user) return <Navigate to="/login" replace />;
  return <>{children(session.user)}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<AuthPage />} />
      <Route path="/" element={<Gate>{(user) => <Home user={user} />}</Gate>} />
      <Route path="/pay/:id" element={<Gate>{(user) => <Pay user={user} />}</Gate>} />
      <Route path="/exam/:id" element={<Gate>{(user) => <Exam user={user} />}</Gate>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
