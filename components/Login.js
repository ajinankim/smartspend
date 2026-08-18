'use client';
import { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../lib/firebase';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setBusy(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (err) {
      setError('이메일 또는 비밀번호가 올바르지 않습니다.');
    } finally { setBusy(false); }
  };

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="login-brand">💸 SmartSpend</div>
        <p className="login-sub">지능형 개인 재무 관리 대시보드</p>
        <form onSubmit={submit}>
          <input type="email" placeholder="이메일" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input type="password" placeholder="비밀번호" value={password} onChange={(e) => setPassword(e.target.value)} required />
          {error && <div className="error">{error}</div>}
          <button type="submit" disabled={busy}>{busy ? '로그인 중...' : '로그인'}</button>
        </form>
        <p className="login-foot">승인된 계정만 접근할 수 있는 비공개 대시보드입니다.</p>
      </div>
    </div>
  );
}