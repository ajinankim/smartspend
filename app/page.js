'use client';
import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../lib/firebase';
import Login from '../components/Login';
import Dashboard from '../components/Dashboard';
import expenses from '../data/expenses.json';

export default function Home() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  if (loading) {
    return <div className="login-wrap"><div className="spinner" /></div>;
  }

  return user ? <Dashboard expenses={expenses} user={user} /> : <Login />;
}