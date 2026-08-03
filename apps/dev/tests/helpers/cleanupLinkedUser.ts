export const cleanupLinkedSupabaseTestUser = async (
  serverURL = 'http://localhost:3000',
): Promise<void> => {
  const email = process.env.SUPABASE_TEST_EMAIL
  const password = process.env.SUPABASE_TEST_PASSWORD
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

  if (!email || !password || !publishableKey || !supabaseUrl) return

  const tokenResponse = await fetch(
    `${supabaseUrl.replace(/\/+$/, '')}/auth/v1/token?grant_type=password`,
    {
      body: JSON.stringify({ email, password }),
      headers: { apikey: publishableKey, 'content-type': 'application/json' },
      method: 'POST',
    },
  )
  const tokenBody = (await tokenResponse.json()) as { access_token?: string }

  if (!tokenResponse.ok || !tokenBody.access_token) {
    throw new Error('Unable to authenticate the Supabase cleanup identity')
  }

  const headers = { authorization: `Bearer ${tokenBody.access_token}` }
  const meResponse = await fetch(`${serverURL}/api/users/me`, { headers })
  const meBody = (await meResponse.json()) as { user?: { id?: number | string } }

  if (!meResponse.ok || meBody.user?.id === undefined) {
    throw new Error('Unable to resolve the linked Payload cleanup user')
  }

  const deleteResponse = await fetch(`${serverURL}/api/users/${meBody.user.id}`, {
    headers,
    method: 'DELETE',
  })

  if (!deleteResponse.ok) {
    throw new Error('Unable to delete the linked Payload cleanup user')
  }
}
