import { useState } from 'react';
import { Mascot } from '../app/Shell';
import { supabase } from '../data/client';
import { Button, Field, inputClass } from '../ui';

export function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const back = `${window.location.origin}${window.location.pathname}`;

  const google = async () => {
    setError(null);
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: back },
    });
    if (err) setError(err.message);
  };

  const forgot = async () => {
    if (!email.trim()) {
      setError('Enter your email above first, then choose Forgot Password.');
      return;
    }
    setError(null);
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: back,
    });
    if (err) setError(err.message);
    else
      setNotice(
        `If ${email.trim()} has an account, a link to set a new password is on its way. Open it on this computer.`
      );
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setBusy(false);
    if (err)
      setError(
        err.message === 'Invalid login credentials'
          ? 'That email and password do not match an account. Use the same account as in the app.'
          : err.message
      );
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div
        className="hidden lg:flex flex-col text-white min-h-screen overflow-hidden"
        style={{ background: 'linear-gradient(160deg, #144513 0%, #2F7A2B 60%, #8FD45C 100%)' }}
      >
        <div className="px-12 pt-14">
          <h1 className="text-[40px] font-bold leading-tight max-w-[16ch]">
            Every walk becomes evidence.
          </h1>
          <p className="text-[17px] mt-3 max-w-[44ch] text-white/85">
            Review surveys, check data quality and export analysis-ready records for your research.
          </p>
        </div>
        {/* The same street dog and cat as the app's welcome screen, standing on the bottom edge */}
        <div
          role="img"
          aria-label="A street dog and a street cat looking up"
          className="flex-1 flex items-end justify-center min-h-0"
        >
          <img
            src="/auth_dog.png"
            alt=""
            width={515}
            height={560}
            className="h-[min(44vh,420px)] w-auto object-contain"
          />
          <img
            src="/auth_cat.png"
            alt=""
            width={464}
            height={560}
            className="h-[min(39vh,372px)] w-auto object-contain -ms-[12%]"
          />
        </div>
      </div>
      <main className="flex items-center justify-center p-6">
        <form onSubmit={submit} className="w-full max-w-[380px] flex flex-col gap-5" noValidate>
          <div className="flex items-center gap-2.5 mb-2">
            <span
              aria-hidden
              className="w-12 h-12 rounded-[14px] bg-[#FAF5EE] grid place-items-end overflow-hidden"
            >
              <Mascot className="w-11 h-11" />
            </span>
            <div>
              <p className="font-bold text-[17px]" translate="no">
                Strayo
              </p>
              <p className="text-[13px] text-ink2">Research portal</p>
            </div>
          </div>
          <h2 className="text-[24px] font-bold">Sign In</h2>
          <Button kind="secondary" onClick={google}>
            Continue with Google
          </Button>
          <div className="flex items-center gap-3 text-[13px] text-ink3" aria-hidden>
            <span className="h-px flex-1 bg-line" />
            or with email
            <span className="h-px flex-1 bg-line" />
          </div>
          <Field label="Email" htmlFor="email">
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              spellCheck={false}
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@university.org…"
              className={`${inputClass} w-full`}
            />
          </Field>
          <Field label="Password" htmlFor="password">
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`${inputClass} w-full`}
            />
          </Field>
          {error ? (
            <p role="alert" aria-live="polite" className="text-[14px] text-danger">
              {error}
            </p>
          ) : null}
          {notice ? (
            <p role="status" aria-live="polite" className="text-[14px] text-accent">
              {notice}
            </p>
          ) : null}
          <Button type="submit" disabled={busy || !email || !password}>
            {busy ? 'Signing In…' : 'Sign In'}
          </Button>
          <Button kind="ghost" onClick={forgot}>
            Forgot Password
          </Button>
          <p className="text-[13px] text-ink2">
            Use the same account as in the Strayo app. The portal is open to researchers and
            administrators.
          </p>
        </form>
      </main>
    </div>
  );
}
