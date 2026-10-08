export default async function handler(
  req: any,
  res: any,
) {
  res.setHeader(
    'Access-Control-Allow-Origin',
    '*',
  )

  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET,OPTIONS',
  )

  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type',
  )

  res.setHeader(
    'Cache-Control',
    'no-store, max-age=0',
  )

  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }

  if (req.method !== 'GET') {
    res.status(405).json({
      error: 'Method not allowed',
    })
    return
  }

  const host =
    String(req.query?.host || '')

  const path =
    String(req.query?.path || '')

  const base =
    host === 'site'
      ? 'https://site.api.espn.com'
      : host === 'core'
        ? 'https://sports.core.api.espn.com'
        : null

  if (
    !base ||
    !path.startsWith('/')
  ) {
    res.status(400).json({
      error: 'Invalid ESPN request',
    })
    return
  }

  try {
    const response = await fetch(
      `${base}${path}`,
      {
        headers: {
          Accept: 'application/json',
          'User-Agent':
            'Mozilla/5.0 sports-ticker',
        },
      },
    )

    const body = await response.text()

    res.status(response.status)

    const contentType =
      response.headers.get(
        'content-type',
      )

    if (contentType) {
      res.setHeader(
        'Content-Type',
        contentType,
      )
    }

    res.send(body)
  } catch (error) {
    console.error(
      'ESPN proxy failed',
      error,
    )

    res.status(502).json({
      error:
        'ESPN request failed',
    })
  }
}
