import { useId, useState, type FormEvent } from 'react';
import { loginInputSchema, signupInputSchema, LIMITS } from '@tripforge/shared';
import { errorMessage } from '../../api/messages';
import { useAuth } from '../../auth/AuthContext';
import { ErrorBanner } from '../../components/ErrorBanner';

type Mode = 'login' | 'signup';
type Fields = { name: string; email: string; password: string };
type FieldErrors = Partial<Record<keyof Fields, string>>;

function validate(mode: Mode, values: Fields): FieldErrors {
  const errors: FieldErrors = {};
  if (mode === 'signup' && !values.name.trim()) errors.name = 'Enter your name.';
  if (!values.email.trim()) errors.email = 'Enter your email.';
  else if (!loginInputSchema.shape.email.safeParse(values.email).success)
    errors.email = 'Enter a valid email address.';
  if (!values.password) errors.password = 'Enter your password.';
  else if (mode === 'signup' && values.password.length < LIMITS.passwordMin)
    errors.password = `Use at least ${LIMITS.passwordMin} characters.`;
  else if (values.password.length > LIMITS.passwordMax)
    errors.password = `Use at most ${LIMITS.passwordMax} characters.`;
  return errors;
}

type Props = { onSuccess: () => void };

export function AuthForm({ onSuccess }: Props) {
  const { login, signup } = useAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [values, setValues] = useState<Fields>({ name: '', email: '', password: '' });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const id = useId();

  const isSignup = mode === 'signup';

  function switchMode() {
    setMode(isSignup ? 'login' : 'signup');
    setErrors({});
    setServerError(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const found = validate(mode, values);
    setErrors(found);
    setServerError(null);
    if (Object.keys(found).length > 0) return;

    setSubmitting(true);
    try {
      if (isSignup) await signup(signupInputSchema.parse(values));
      else await login(loginInputSchema.parse({ email: values.email, password: values.password }));
      onSuccess();
    } catch (err) {
      setServerError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  const field = (name: keyof Fields, label: string, type: string, autoComplete: string) => (
    <div>
      <label htmlFor={`${id}-${name}`} className="field-label">
        {label}
      </label>
      <input
        id={`${id}-${name}`}
        type={type}
        autoComplete={autoComplete}
        className="field-input"
        value={values[name]}
        onChange={(e) => setValues((v) => ({ ...v, [name]: e.target.value }))}
        aria-invalid={errors[name] ? true : undefined}
        aria-describedby={errors[name] ? `${id}-${name}-error` : undefined}
      />
      {errors[name] && (
        <p id={`${id}-${name}-error`} className="field-error">
          {errors[name]}
        </p>
      )}
    </div>
  );

  return (
    <div className="card p-6">
      <h2 className="text-xl font-semibold">{isSignup ? 'Create your account' : 'Log in'}</h2>
      <form className="mt-4 space-y-4" onSubmit={handleSubmit} noValidate>
        {serverError && <ErrorBanner>{serverError}</ErrorBanner>}
        {isSignup && field('name', 'Name', 'text', 'name')}
        {field('email', 'Email', 'email', 'email')}
        {field('password', 'Password', 'password', isSignup ? 'new-password' : 'current-password')}
        <button type="submit" className="btn-primary w-full" disabled={submitting}>
          {submitting ? 'Please wait…' : isSignup ? 'Sign up' : 'Log in'}
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-slate-600">
        {isSignup ? 'Already have an account?' : 'New to TripForge?'}{' '}
        <button
          type="button"
          onClick={switchMode}
          className="font-semibold text-sky-700 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-sky-600"
        >
          {isSignup ? 'Log in' : 'Create an account'}
        </button>
      </p>
    </div>
  );
}
