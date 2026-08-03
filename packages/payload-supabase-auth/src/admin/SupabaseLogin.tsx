'use client'

import type { CSSProperties, FormEvent } from 'react'
import { useMemo, useState } from 'react'

import {
  challengeSupabaseMfa,
  exchangeSupabaseAdminSession,
  signInWithSupabasePassword,
  type SupabaseAdminMfaFactor,
  verifySupabaseMfa,
} from './createAdminSession.js'
import type { SupabaseMfaPolicy } from '../token/verifyMfa.js'

export type SupabaseLoginProps = {
  adminRoute?: string
  description?: string
  exchangeCodeEndpoint?: string
  exchangeEndpoint?: string
  heading?: string
  mfaPolicy?: SupabaseMfaPolicy
  publishableKey?: string
  supabaseUrl?: string
}

const styles: Record<string, CSSProperties> = {
  actions: { display: 'grid', gap: '0.75rem', marginTop: '1.25rem' },
  alert: {
    background: 'var(--theme-error-50)',
    border: '1px solid var(--theme-error-250)',
    borderRadius: '4px',
    color: 'var(--theme-error-750)',
    padding: '0.75rem',
  },
  button: {
    background: 'var(--theme-elevation-1000)',
    border: 0,
    borderRadius: '3px',
    color: 'var(--theme-elevation-0)',
    cursor: 'pointer',
    font: 'inherit',
    fontWeight: 600,
    minHeight: '42px',
    padding: '0.7rem 1rem',
  },
  field: { display: 'grid', gap: '0.4rem' },
  form: { display: 'grid', gap: '1rem' },
  input: {
    background: 'var(--theme-input-bg)',
    border: '1px solid var(--theme-elevation-150)',
    borderRadius: '3px',
    color: 'var(--theme-elevation-800)',
    font: 'inherit',
    minHeight: '42px',
    padding: '0.65rem 0.75rem',
    width: '100%',
  },
  intro: { color: 'var(--theme-elevation-600)', lineHeight: 1.5, margin: '0 0 1.25rem' },
  label: { color: 'var(--theme-elevation-800)', fontWeight: 500 },
  panel: {
    borderBottom: '1px solid var(--theme-elevation-150)',
    marginBottom: '1.5rem',
    paddingBottom: '0.25rem',
  },
  title: { margin: '0 0 0.5rem' },
}

const getSafeRedirect = (fallback: string): string => {
  const redirect = new URLSearchParams(window.location.search).get('redirect')

  return redirect?.startsWith('/') && !redirect.startsWith('//') ? redirect : fallback
}

export const SupabaseLogin = ({
  adminRoute = '/admin',
  description = 'Use your Supabase account to access Payload.',
  exchangeCodeEndpoint,
  exchangeEndpoint,
  heading = 'Sign in with Supabase',
  mfaPolicy = 'if-enrolled',
  publishableKey,
  supabaseUrl,
}: SupabaseLoginProps) => {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string>()
  const [password, setPassword] = useState('')
  const [mfa, setMfa] = useState<{
    accessToken: string
    challengeId: string
    factor: SupabaseAdminMfaFactor
  }>()
  const [verificationCode, setVerificationCode] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const configurationError = useMemo(() => {
    if (!supabaseUrl || !publishableKey || !exchangeCodeEndpoint || !exchangeEndpoint) {
      return 'Supabase admin sign-in is not configured. Ask the site administrator to add the public Supabase URL and publishable key to the server configuration.'
    }

    return undefined
  }, [exchangeCodeEndpoint, exchangeEndpoint, publishableKey, supabaseUrl])

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (
      configurationError ||
      !supabaseUrl ||
      !publishableKey ||
      !exchangeCodeEndpoint ||
      !exchangeEndpoint
    ) {
      return
    }

    setError(undefined)
    setSubmitting(true)

    try {
      if (mfa) {
        const accessToken = await verifySupabaseMfa({
          ...mfa,
          code: verificationCode,
          publishableKey,
          supabaseUrl,
        })
        await exchangeSupabaseAdminSession({ accessToken, exchangeCodeEndpoint, exchangeEndpoint })
      } else {
        const signIn = await signInWithSupabasePassword({
          email,
          mfaPolicy,
          password,
          publishableKey,
          supabaseUrl,
        })

        if (signIn.requiresMfa) {
          const factor = signIn.factors[0]
          if (!factor) throw new Error('No supported MFA factor is available.')

          const challengeId = await challengeSupabaseMfa({
            accessToken: signIn.accessToken,
            factor,
            publishableKey,
            supabaseUrl,
          })
          setMfa({ accessToken: signIn.accessToken, challengeId, factor })
          setPassword('')
          setSubmitting(false)
          return
        }

        await exchangeSupabaseAdminSession({
          accessToken: signIn.accessToken,
          exchangeCodeEndpoint,
          exchangeEndpoint,
        })
      }
      window.location.assign(getSafeRedirect(adminRoute))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Sign-in failed. Please try again.')
      setSubmitting(false)
    }
  }

  return (
    <section aria-labelledby="supabase-login-heading" style={styles.panel}>
      <h2 id="supabase-login-heading" style={styles.title}>
        {heading}
      </h2>
      <p style={styles.intro}>{description}</p>

      {configurationError ? (
        <p role="alert" style={styles.alert}>
          {configurationError}
        </p>
      ) : (
        <form onSubmit={submit} style={styles.form}>
          {mfa ? (
            <>
              <p style={styles.intro}>
                Enter the code from{' '}
                {mfa.factor.friendlyName ??
                  (mfa.factor.factorType === 'phone'
                    ? (mfa.factor.phone ?? 'your phone')
                    : 'your authenticator app')}
                .
              </p>
              <label htmlFor="supabase-mfa-code" style={styles.field}>
                <span style={styles.label}>Verification code</span>
                <input
                  autoComplete="one-time-code"
                  id="supabase-mfa-code"
                  inputMode="numeric"
                  onChange={(event) => setVerificationCode(event.target.value)}
                  required
                  style={styles.input}
                  value={verificationCode}
                />
              </label>
            </>
          ) : (
            <>
              <label htmlFor="supabase-email" style={styles.field}>
                <span style={styles.label}>Email</span>
                <input
                  autoComplete="username"
                  id="supabase-email"
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  style={styles.input}
                  type="email"
                  value={email}
                />
              </label>
              <label htmlFor="supabase-password" style={styles.field}>
                <span style={styles.label}>Password</span>
                <input
                  autoComplete="current-password"
                  id="supabase-password"
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  style={styles.input}
                  type="password"
                  value={password}
                />
              </label>
            </>
          )}
          <div style={styles.actions}>
            {error ? (
              <p role="alert" style={styles.alert}>
                {error}
              </p>
            ) : null}
            <button
              disabled={submitting}
              style={{ ...styles.button, opacity: submitting ? 0.65 : 1 }}
              type="submit"
            >
              {submitting
                ? mfa
                  ? 'Verifying…'
                  : 'Signing in…'
                : mfa
                  ? 'Verify and sign in'
                  : 'Sign in with Supabase'}
            </button>
          </div>
        </form>
      )}
    </section>
  )
}
