import { NextResponse } from 'next/server'

const RETRY_AFTER_SECONDS = '600'

const MAINTENANCE_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Under maintenance</title>
<style>
  :root { color-scheme: light dark; }
  body {
    margin: 0;
    min-height: 100vh;
    display: grid;
    place-items: center;
    padding: 0 16px;
    font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
    background: #fff;
    color: #111;
  }
  @media (prefers-color-scheme: dark) {
    body { background: #0a0a0a; color: #ededed; }
    p { color: #a1a1a1; }
  }
  main { max-width: 28rem; text-align: center; }
  h1 { font-size: 1.25rem; font-weight: 600; margin: 0 0 0.5rem; }
  p { margin: 0; line-height: 1.6; color: #555; }
</style>
</head>
<body>
<main>
  <h1>We'll be back shortly</h1>
  <p>Morphic is undergoing scheduled maintenance. Your chats are safe. Please check back in a few minutes.</p>
</main>
</body>
</html>`

export function isMaintenanceMode(): boolean {
  return process.env.MAINTENANCE_MODE === 'true'
}

// API callers get JSON so clients can show their own error state
export function maintenanceResponse(pathname: string): NextResponse {
  const headers = {
    'Retry-After': RETRY_AFTER_SECONDS,
    'Cache-Control': 'no-store'
  }
  if (pathname.startsWith('/api/')) {
    return NextResponse.json(
      { error: 'Service under maintenance' },
      { status: 503, headers }
    )
  }
  return new NextResponse(MAINTENANCE_HTML, {
    status: 503,
    headers: { ...headers, 'Content-Type': 'text/html; charset=utf-8' }
  })
}
