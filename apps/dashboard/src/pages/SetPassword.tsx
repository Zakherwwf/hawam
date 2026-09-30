import { useState } from 'react';
import { supabase } from '../data/client';
import { Button, Card, Field, inputClass } from '../ui';

/** Shown after opening a password-reset link: choose the new password. */
export function SetPassword({ onDone }: { onDone: () => void }) {
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.length < 8) {
      setError('Use at least 8 characters.');
      return;
    }
    setBusy(true);
    const { error: err } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (err) setError(err.message);
    else onDone();
  };
  return (
    <main className="min-h-screen grid place-items-center p-6">
      <Card className="w-full max-w-[400px] p-6">
        <form onSubmit={save} className="flex flex-col gap-4">
          <h1 className="text-[24px] font-bold">Choose a New Password</h1>
          <p className="text-[14px] text-ink2">It works for both the app and this portal.</p>
          <Field label="New password" htmlFor="new-pw" hint="At least 8 characters.">
            <input
              id="new-pw"
              name="new-password"
              type="password"
              autoComplete="new-password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              className={`${inputClass} w-full`}
            />
          </Field>
          {error ? (
            <p role="alert" className="text-[14px] text-danger">
              {error}
            </p>
          ) : null}
          <Button type="submit" disabled={busy}>
            {busy ? 'Saving…' : 'Save Password'}
          </Button>
        </form>
      </Card>
    </main>
  );
}
