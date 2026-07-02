import { redirect } from 'next/navigation'

type SearchParams = Record<string, string | string[] | undefined>

/** Legacy path — redirect to /support-session without forwarding JWT query params. */
export default async function ImpersonateLegacyRedirect({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const sp = await searchParams
  const code = typeof sp.code === 'string' ? sp.code : undefined
  if (code) {
    redirect(`/support-session?code=${encodeURIComponent(code)}`)
  }
  redirect('/login?message=support-link-expired')
}
