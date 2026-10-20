import React, { useState } from 'react';
import { validateAuthInput } from '../../utils/validators.js';

export default function LoginForm({
  loginRole,
  loginName,
  setLoginName,
  loginEmail,
  setLoginEmail,
  loginPassword,
  setLoginPassword,
  onAuthSuccess,
}) {
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    const validationError = validateAuthInput({
      name: loginName,
      email: loginEmail,
      password: loginPassword,
      isSignup: false,
    });
    if (validationError) {
      setErrorMsg(validationError);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'login',
          role: loginRole === 'kitchen' ? 'donor' : 'receiver',
          organization: loginName.trim(),
          email: loginEmail.trim(),
          password: loginPassword,
        }),
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        setErrorMsg(data.error || 'Invalid email or password.');
        setLoading(false);
        return;
      }

      onAuthSuccess({
        role: loginRole,
        name: data.user?.organization || loginName.trim(),
        email: data.user?.email || loginEmail.trim(),
        token: data.user?.token || '',
      });
    } catch {
      setErrorMsg('Unable to reach server. Please check if backend is running.');
    }
    setLoading(false);
  };

  return (
    <form onSubmit={handleLoginSubmit} noValidate className="space-y-4">
      {errorMsg && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-semibold px-3.5 py-2.5 rounded-xl">
          ❌ {errorMsg}
        </div>
      )}

      <div>
        <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
          {loginRole === 'kitchen' ? 'Kitchen / Mess Name' : 'NGO / Organization Name'}
        </label>
        <input
          type="text"
          required
          value={loginName}
          onChange={(e) => {
            setLoginName(e.target.value);
            setErrorMsg('');
          }}
          className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm"
        />
      </div>

      <div>
        <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
          Email ID
        </label>
        <input
          type="email"
          required
          placeholder="e.g. kitchen@govindas.in"
          value={loginEmail}
          onChange={(e) => {
            setLoginEmail(e.target.value);
            setErrorMsg('');
          }}
          className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm"
        />
      </div>

      <div>
        <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
          Password
        </label>
        <input
          type="password"
          required
          placeholder="Minimum 6 characters"
          value={loginPassword}
          onChange={(e) => {
            setLoginPassword(e.target.value);
            setErrorMsg('');
          }}
          className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className={`w-full py-3.5 rounded-xl font-bold text-white shadow-md transition ${
          loginRole === 'kitchen'
            ? 'bg-emerald-600 hover:bg-emerald-700'
            : 'bg-blue-600 hover:bg-blue-700'
        }`}
      >
        {loading
          ? 'Verifying Credentials...'
          : loginRole === 'kitchen'
          ? '👨‍🍳 Enter as Kitchen (Food Donor)'
          : '🤝 Enter as NGO (Food Receiver)'}
      </button>
    </form>
  );
}
