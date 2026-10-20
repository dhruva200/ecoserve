import React, { useState } from 'react';
import { validateAuthInput } from '../../utils/validators.js';

export default function SignupForm({ loginRole, onAuthSuccess }) {
  const [orgName, setOrgName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignupSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    const validationError = validateAuthInput({
      name: orgName,
      email,
      password,
      isSignup: true,
    });
    if (validationError) {
      setErrorMsg(validationError);
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match! Please re-enter your password.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'signup',
          role: loginRole === 'kitchen' ? 'donor' : 'receiver',
          organization: orgName.trim(),
          email: email.trim(),
          password,
        }),
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        setErrorMsg(data.error || 'Could not create account.');
        setLoading(false);
        return;
      }

      onAuthSuccess({
        role: loginRole,
        name: data.user?.organization || orgName.trim(),
        email: data.user?.email || email.trim(),
        token: data.user?.token || '',
      });
    } catch {
      setErrorMsg('Unable to reach server. Please check if backend is running.');
    }
    setLoading(false);
  };

  return (
    <form onSubmit={handleSignupSubmit} noValidate className="space-y-3.5">
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
          placeholder={
            loginRole === 'kitchen' ? 'e.g. Hostel BH1 Mess' : 'e.g. Robin Hood Army NGO'
          }
          value={orgName}
          onChange={(e) => {
            setOrgName(e.target.value);
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
          placeholder={
            loginRole === 'kitchen' ? 'kitchen@college.edu' : 'contact@ngo.org'
          }
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setErrorMsg('');
          }}
          className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
            Password (Min 6 chars)
          </label>
          <input
            type="password"
            required
            placeholder="••••••"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setErrorMsg('');
            }}
            className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
            Confirm Password
          </label>
          <input
            type="password"
            required
            placeholder="••••••"
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              setErrorMsg('');
            }}
            className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm"
          />
        </div>
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
          ? 'Creating Account...'
          : loginRole === 'kitchen'
          ? '👨‍🍳 Sign Up & Enter as Kitchen'
          : '🤝 Sign Up & Enter as NGO'}
      </button>
    </form>
  );
}
