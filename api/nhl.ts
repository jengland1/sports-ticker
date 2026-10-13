import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(204).end()
  }

  const season = String(req.query.season || '')
  const limit = Math.min(100, Math.max(1, Number(req.query.limit || 25)))

  if (!/^\d{8}$/.test(season)) {
    return res.status(400).json({ error: 'Invalid NHL season.' })
  }

  const params = new URLSearchParams({
    isAggregate: 'false',
    isGame: 'false',
    start: '0',
    limit: String(limit),
    sort: JSON.stringify([
      { property: 'points', direction: 'DESC' },
      { property: 'goals', direction: 'DESC' },
    ]),
    cayenneExp: `seasonId=${season} and gameTypeId=2`,
  })

  const url = `https://api.nhle.com/stats/rest/en/skater/summary?${params.toString()}`

  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'sports-ticker/1.0',
      },
    })

    if (!response.ok) {
      return res.status(response.status).json({
        error: `NHL stats request failed (${response.status}).`,
      })
    }

    const data = await response.json()
    res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=300')
    return res.status(200).json(data)
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'NHL stats unavailable.',
    })
  }
}
