import { Navigate, Route, Routes } from 'react-router-dom';
import Exam from './pages/Exam';
import Home from './pages/Home';
import Login from './pages/Login';
import Pay from './pages/Pay';

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
