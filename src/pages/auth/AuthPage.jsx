import React, { useState, useEffect } from 'react';
import LoginForm from './LoginForm.jsx';
import SignupForm from './SignupForm.jsx';

export default function AuthPage({ onAuthSuccess }) {
  const [authMode, setAuthMode] = useState('login'); // 'login' | 'signup'
  const [loginRole, setLoginRole] = useState('kitchen'); // 'kitchen' | 'ngo'
  const [loginName, setLoginName] = useState('Govindas kitchen');
  const [loginEmail, setLoginEmail] = useState('kitchen@govindas.in');
  const [loginPassword, setLoginPassword] = useState('123456');

  // Google Sign-In State
  const [googleClientId, setGoogleClientId] = useState(
    import.meta.env.VITE_GOOGLE_CLIENT_ID || ''
  );
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleError, setGoogleError] = useState('');

  // Clean 2-Step Google Sign-In Modal State
  // Step 1 = Enter Google Email, Step 2 = Enter Kitchen / NGO Name
  const [showGoogleModal, setShowGoogleModal] = useState(false);
  const [googleStep, setGoogleStep] = useState(1);
  const [googleEmail, setGoogleEmail] = useState('');
  const [googleOrgName, setGoogleOrgName] = useState('');
  const [verifiedGoogleToken, setVerifiedGoogleToken] = useState('');
  const [verifiedGoogleProfile, setVerifiedGoogleProfile] = useState(null);

  useEffect(() => {
    fetch('/api/auth/google-config')
      .then((r) => r.json())
      .then((data) => {
        if (data?.clientId) {
          setGoogleClientId(data.clientId);
        }
      })
      .catch(() => {});
  }, []);

  const selectRole = (role) => {
    setLoginRole(role);
    setGoogleError('');
    if (role === 'kitchen') {
      setLoginName('Govindas kitchen');
      setLoginEmail('kitchen@govindas.in');
      setLoginPassword('123456');
    } else {
      setLoginName('Adi-Yuva Foundation');
      setLoginEmail('ngo@ecoserve.in');
      setLoginPassword('123456');
    }
  };

  // Triggered if GOOGLE_CLIENT_ID is set in .env and Google's popup returns an access_token
  const verifyGoogleTokenOnBackend = async (accessToken) => {
    setGoogleLoading(true);
    setGoogleError('');
    try {
      const res = await fetch('/api/google-auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessToken,
          role: loginRole === 'kitchen' ? 'donor' : 'receiver',
        }),
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        setGoogleError(data.error || 'Google authentication failed.');
        setGoogleLoading(false);
        return;
      }

      if (data.exists && data.user) {
        onAuthSuccess({
          role: loginRole,
          name: data.user.organization || data.user.name,
          email: data.user.email,
          token: data.user.token || '',
        });
        setGoogleLoading(false);
        return;
      }

      // First-time Google user -> Open Step 2 to ask for Kitchen / NGO Name
      setVerifiedGoogleToken(accessToken);
      setVerifiedGoogleProfile(data.googleProfile || {});
      setGoogleEmail(data.googleProfile?.email || '');
      setGoogleOrgName('');
      setGoogleStep(2);
      setShowGoogleModal(true);
    } catch {
      setGoogleError('Unable to reach backend server.');
    }
    setGoogleLoading(false);
  };

  // Triggered when user clicks "Continue with Google"
  const handleContinueWithGoogle = () => {
    const activeClientId = (googleClientId || '').trim();
    setGoogleError('');

    // If GOOGLE_CLIENT_ID is configured in .env, open Google's official OAuth popup
    if (
      activeClientId &&
      window.google &&
      window.google.accounts &&
      window.google.accounts.oauth2
    ) {
      try {
        const tokenClient = window.google.accounts.oauth2.initTokenClient({
          client_id: activeClientId,
          scope: 'openid email profile',
          callback: (tokenResponse) => {
            if (tokenResponse && tokenResponse.access_token) {
              verifyGoogleTokenOnBackend(tokenResponse.access_token);
            } else if (tokenResponse?.error) {
              setGoogleError(`Google OAuth Error: ${tokenResponse.error}`);
            }
          },
        });
        tokenClient.requestAccessToken({ prompt: 'select_account' });
        return;
      } catch (err) {
        console.warn('Google SDK fallback:', err.message);
      }
    }

    // Otherwise open the clean 2-Step Google Sign-In Modal immediately (No Client ID prompt!)
    setVerifiedGoogleToken('');
    setVerifiedGoogleProfile(null);
    setGoogleEmail('');
    setGoogleOrgName('');
    setGoogleStep(1);
    setShowGoogleModal(true);
  };

  // Step 1: Verify Google Email in Database (With Safe Fallback to Step 2)
  const handleStep1CheckEmail = async (e) => {
    e.preventDefault();
    setGoogleError('');

    const cleanEmail = googleEmail.trim().toLowerCase();
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!cleanEmail || !emailRegex.test(cleanEmail)) {
      setGoogleError('Please enter a valid Google email address (e.g. yourname@gmail.com).');
      return;
    }

    setGoogleLoading(true);

    try {
      const res = await fetch('/api/google-auth/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: loginRole === 'kitchen' ? 'donor' : 'receiver',
          email: cleanEmail,
        }),
      });

      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await res.json();
        if (!res.ok || data.error) {
          setGoogleError(data.error || 'Please enter a valid Google email.');
          setGoogleLoading(false);
          return;
        }

        // Existing user -> Log in directly with saved Kitchen / NGO Name!
        if (data.exists && data.user) {
          setShowGoogleModal(false);
          onAuthSuccess({
            role: loginRole,
            name: data.user.organization || data.user.name,
            email: data.user.email,
            token: data.user.token || '',
          });
          setGoogleLoading(false);
          return;
        }
      }

      // Proceed to Step 2: Ask for Kitchen / NGO Name!
      setGoogleStep(2);
    } catch {
      // Even if /api/google-auth/check is unavailable on an un-restarted backend, go to Step 2
      setGoogleStep(2);
    }
    setGoogleLoading(false);
  };

  // Step 2: Save Kitchen / NGO Name & Enter Dashboard
  const handleStep2Complete = async (e) => {
    e.preventDefault();
    setGoogleError('');
    setGoogleLoading(true);

    try {
      const endpoint = verifiedGoogleToken
        ? '/api/google-auth/complete'
        : '/api/google-auth';
      const payload = verifiedGoogleToken
        ? {
            accessToken: verifiedGoogleToken,
            role: loginRole === 'kitchen' ? 'donor' : 'receiver',
            organization: googleOrgName.trim(),
          }
        : {
            email: googleEmail.trim(),
            role: loginRole === 'kitchen' ? 'donor' : 'receiver',
            organization: googleOrgName.trim(),
          };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        setGoogleError(data.error || 'Could not save Kitchen/NGO name.');
        setGoogleLoading(false);
        return;
      }

      setShowGoogleModal(false);
      onAuthSuccess({
        role: loginRole,
        name: data.user?.organization || googleOrgName.trim(),
        email: data.user?.email || googleEmail.trim(),
        token: data.user?.token || '',
      });
    } catch {
      setGoogleError('Unable to reach server.');
    }
    setGoogleLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-950 via-slate-900 to-teal-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-8 space-y-5">
        <div className="text-center">
          <div className="w-14 h-14 bg-emerald-600 rounded-2xl flex items-center justify-center text-2xl mx-auto mb-3 shadow-md">
            🌱
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900">
            {authMode === 'login' ? 'EcoServe Login' : 'EcoServe Sign Up'}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            AI-Driven Institutional Food Waste & NGO Redistribution Network
          </p>
        </div>

        {/* Option 1: Login vs Create New Account Switcher */}
        <div className="grid grid-cols-2 bg-slate-100 p-1 rounded-xl text-xs font-bold">
          <button
            type="button"
            onClick={() => setAuthMode('login')}
            className={`py-2 rounded-lg transition ${
              authMode === 'login'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Login to Account
          </button>
          <button
            type="button"
            onClick={() => setAuthMode('signup')}
            className={`py-2 rounded-lg transition ${
              authMode === 'signup'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Create New Account
          </button>
        </div>

        {/* Role Toggle Buttons */}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => selectRole('kitchen')}
            className={`p-4 rounded-2xl border-2 text-center transition ${
              loginRole === 'kitchen'
                ? 'border-emerald-600 bg-emerald-50/70'
                : 'border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="text-2xl mb-1">👨‍🍳</div>
            <div className="font-extrabold text-sm text-slate-900">Kitchen Login</div>
            <div className="text-[11px] text-slate-500">Jo Khana Baat Raha Hai</div>
          </button>

          <button
            type="button"
            onClick={() => selectRole('ngo')}
            className={`p-4 rounded-2xl border-2 text-center transition ${
              loginRole === 'ngo'
                ? 'border-blue-600 bg-blue-50/70'
                : 'border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="text-2xl mb-1">🤝</div>
            <div className="font-extrabold text-sm text-slate-900">NGO Login</div>
            <div className="text-[11px] text-slate-500">Jo Food Accept Karega</div>
          </button>
        </div>

        {authMode === 'login' ? (
          <LoginForm
            loginRole={loginRole}
            loginName={loginName}
            setLoginName={setLoginName}
            loginEmail={loginEmail}
            setLoginEmail={setLoginEmail}
            loginPassword={loginPassword}
            setLoginPassword={setLoginPassword}
            onAuthSuccess={onAuthSuccess}
          />
        ) : (
          <SignupForm loginRole={loginRole} onAuthSuccess={onAuthSuccess} />
        )}

        {/* Option 2: Continue with Google */}
        <div className="pt-3 border-t border-slate-100 space-y-2">
          <div className="text-center text-[11px] text-slate-400 font-semibold uppercase">
            Or Continue With Google
          </div>

          {googleError && !showGoogleModal && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-semibold p-2.5 rounded-xl">
              ❌ {googleError}
            </div>
          )}

          <button
            type="button"
            disabled={googleLoading}
            onClick={handleContinueWithGoogle}
            className="w-full py-2.5 px-4 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center justify-center gap-2.5 transition shadow-sm"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.3 0 6.08-1.09 8.1-2.96l-3.88-3.05c-1.08.72-2.45 1.16-4.22 1.16-3.24 0-5.99-2.19-6.97-5.14H1.02v3.14C3.03 21.14 7.21 24 12 24z"
              />
              <path
                fill="#FBBC05"
                d="M5.03 14.01c-.25-.72-.39-1.5-.39-2.31s.14-1.59.39-2.31V6.25H1.02C.37 7.54 0 9.09 0 11.7s.37 4.16 1.02 5.45l4.01-3.14z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.8 0 3.41.62 4.68 1.84l3.51-3.51C18.07 1.19 15.3 0 12 0 7.21 0 3.03 2.86 1.02 6.85l4.01 3.14c.98-2.95 3.73-5.24 6.97-5.24z"
              />
            </svg>
            <span>
              {googleLoading
                ? 'Connecting to Google...'
                : `Continue with Google (${
                    loginRole === 'kitchen' ? 'Kitchen' : 'NGO'
                  })`}
            </span>
          </button>
        </div>
      </div>

      {/* CLEAN 2-STEP GOOGLE SIGN-IN MODAL */}
      {showGoogleModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.3 0 6.08-1.09 8.1-2.96l-3.88-3.05c-1.08.72-2.45 1.16-4.22 1.16-3.24 0-5.99-2.19-6.97-5.14H1.02v3.14C3.03 21.14 7.21 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.03 14.01c-.25-.72-.39-1.5-.39-2.31s.14-1.59.39-2.31V6.25H1.02C.37 7.54 0 9.09 0 11.7s.37 4.16 1.02 5.45l4.01-3.14z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.8 0 3.41.62 4.68 1.84l3.51-3.51C18.07 1.19 15.3 0 12 0 7.21 0 3.03 2.86 1.02 6.85l4.01 3.14c.98-2.95 3.73-5.24 6.97-5.24z"
                  />
                </svg>
                <span className="font-extrabold text-slate-900 text-base">
                  {googleStep === 1
                    ? 'Sign in with Google'
                    : loginRole === 'kitchen'
                    ? 'Enter Kitchen Name'
                    : 'Enter NGO Name'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowGoogleModal(false)}
                className="text-slate-400 hover:text-slate-700 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {googleError && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-semibold p-2.5 rounded-xl">
                ❌ {googleError}
              </div>
            )}

            {googleStep === 1 ? (
              /* STEP 1: Enter Google Email */
              <form onSubmit={handleStep1CheckEmail} className="space-y-4 text-sm">
                <p className="text-xs text-slate-500">
                  Continue to <b>EcoServe</b> with your Google account as a{' '}
                  <b>{loginRole === 'kitchen' ? 'Kitchen (Donor)' : 'NGO (Receiver)'}</b>:
                </p>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                    Google Email ID
                  </label>
                  <input
                    type="email"
                    required
                    autoFocus
                    placeholder="yourname@gmail.com"
                    value={googleEmail}
                    onChange={(e) => {
                      setGoogleEmail(e.target.value);
                      setGoogleError('');
                    }}
                    className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm"
                  />
                </div>

                <button
                  type="submit"
                  disabled={googleLoading}
                  className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition"
                >
                  {googleLoading ? 'Verifying Google Account...' : 'Next →'}
                </button>
              </form>
            ) : (
              /* STEP 2: Enter Kitchen / NGO Name Separately */
              <form onSubmit={handleStep2Complete} className="space-y-4 text-sm">
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center gap-3">
                  {verifiedGoogleProfile?.picture && (
                    <img
                      src={verifiedGoogleProfile.picture}
                      alt="Google Profile"
                      className="w-9 h-9 rounded-full border border-emerald-300"
                    />
                  )}
                  <div className="text-xs">
                    <div className="font-extrabold text-emerald-950">
                      ✅ Google Account Verified
                    </div>
                    <div className="text-emerald-800 font-semibold">{googleEmail}</div>
                  </div>
                </div>

                <p className="text-xs text-slate-600">
                  Almost done! Please enter your{' '}
                  <b>
                    {loginRole === 'kitchen'
                      ? 'Kitchen / Mess Name'
                      : 'NGO / Organization Name'}
                  </b>{' '}
                  to open your dashboard:
                </p>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                    {loginRole === 'kitchen'
                      ? 'Your Kitchen / Mess Name'
                      : 'Your NGO / Organization Name'}
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    placeholder={
                      loginRole === 'kitchen'
                        ? "e.g. Vaibhav's Kitchen"
                        : 'e.g. Robin Hood Army NGO'
                    }
                    value={googleOrgName}
                    onChange={(e) => {
                      setGoogleOrgName(e.target.value);
                      setGoogleError('');
                    }}
                    className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm"
                  />
                </div>

                <div className="flex gap-2">
                  {!verifiedGoogleToken && (
                    <button
                      type="button"
                      onClick={() => {
                        setGoogleStep(1);
                        setGoogleError('');
                      }}
                      className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs"
                    >
                      ← Back
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={googleLoading}
                    className={`flex-1 py-2.5 rounded-xl text-white font-bold text-xs transition ${
                      loginRole === 'kitchen'
                        ? 'bg-emerald-600 hover:bg-emerald-700'
                        : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                  >
                    {googleLoading
                      ? 'Saving...'
                      : loginRole === 'kitchen'
                      ? '👨‍🍳 Save Kitchen Name & Enter'
                      : '🤝 Save NGO Name & Enter'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
