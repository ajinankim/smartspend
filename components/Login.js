'use client';
import { useState } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { auth } from '../lib/firebase';

export default function Login() {
  const [mode, setMode] = useState('login'); // login | signup
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setBusy(true);
    try {
      if (mode === 'login') {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      } else {
        await createUserWithEmailAndPassword(auth, email.trim(), password);
      }
    } catch (err) {
      setError(err.message || '로그인 실패');
    } finally { setBusy(false); }
  };

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="login-brand">💸 SmartSpend</div>
        <p className="login-sub">지능형 개인 재무 관리 대시보드</p>
        <div className="seg">
          <button className={mode === 'login' ? 'seg-on' : ''} onClick={() => { setMode('login'); setError(''); }}>로그인</button>
          <button className={mode === 'signup' ? 'seg-on' : ''} onClick={() => { setMode('signup'); setError(''); }}>회원가입</button>
        </div>
        <form onSubmit={submit}>
          <input type="email" placeholder="이메일" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input type="password" placeholder="비밀번호" value={password} onChange={(e) => setPassword(e.target.value)} required />
          {error && <div className="error">{error}</div>}
          <button type="submit" disabled={busy}>{busy ? '처리 중...' : mode === 'login' ? '로그인' : '가입하기'}</button>
        </form>
        <p className="login-foot">인증된 사용자만 접근할 수 있는 비공개 대시보드입니다.</p>
      </div>
    </div>
  );
}