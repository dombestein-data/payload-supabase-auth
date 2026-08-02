'use client'

import type { CSSProperties, FormEvent } from 'react'
import { useMemo, useState } from 'react'

import { createSupabaseAdminSession } from './createAdminSession.js'

export type SupabaseLoginProps = {
  adminRoute?: string
  description?: string
  exchangeCodeEndpoint?: string
  exchangeEndpoint?: string
  heading?: string
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
  divider: { alignItems: 'center', display: 'flex', gap: '0.75rem', margin: '1.5rem 0' },
  dividerLine: { background: 'var(--theme-elevation-150)', flex: 1, height: '1px' },
  dividerText: { color: 'var(--theme-elevation-500)', fontSize: '0.85rem' },
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
  publishableKey,
  supabaseUrl,
}: SupabaseLoginProps) => {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string>()
  const [password, setPassword] = useState('')
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
      await createSupabaseAdminSession({
        email,
        exchangeCodeEndpoint,
        exchangeEndpoint,
        password,
        publishableKey,
        supabaseUrl,
      })
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
              {submitting ? 'Signing in…' : 'Sign in with Supabase'}
            </button>
          </div>
        </form>
      )}

      <div aria-hidden="true" style={styles.divider}>
        <span style={styles.dividerLine} />
        <span style={styles.dividerText}>or use Payload credentials</span>
        <span style={styles.dividerLine} />
      </div>
    </section>
  )
}
