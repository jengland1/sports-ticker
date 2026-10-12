const ALLOWED_LEAGUES: Record<string, string> = {
  '731674787': 'Jeds slander',
  '79802277': 'SFL',
  '952783234': 'EP Fellas',
}

const POSITION_NAMES: Record<number, string> = {
  0: 'QB',
  1: 'QB',
  2: 'RB',
  3: 'RB',
  4: 'WR',
  5: 'WR',
  6: 'TE',
  7: 'TE',
  8: 'DT',
  9: 'DE',
  10: 'LB',
  11: 'DL',
  12: 'CB',
  13: 'S',
  14: 'DB',
  15: 'DP',
  16: 'D/ST',
  17: 'K',
  18: 'P',
  19: 'HC',
  20: 'BE',
  21: 'IR',
  23: 'FLEX',
  24: 'ER',
}

const LINEUP_SLOT_NAMES: Record<number, string> = {
  0: 'QB',
  2: 'RB',
  4: 'WR',
  6: 'TE',
  16: 'D/ST',
  17: 'K',
  20: 'BE',
  21: 'IR',
  23: 'FLEX',
}


type ProGameInfo = {
  teamId: string
  teamAbbrev: string
  opponentAbbrev: string
  opponentTeamId: string
  homeAway: 'home' | 'away'
  kickoff?: string
  statusState?: string
  statusDetail?: string
  network?: string
  teamScore?: string
  opponentScore?: string
}

function fantasyHeadshot(playerId: string) {
  return `https://a.espncdn.com/i/headshots/nfl/players/full/${playerId}.png`
}

async function fetchNflWeekGames(week: number) {
  const url =
    `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=2026&seasontype=2&week=${week}&limit=100`

  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'Mozilla/5.0 sports-ticker',
    },
  })

  if (!response.ok) {
    return new Map<string, ProGameInfo>()
  }

  const data = await response.json()
  const map = new Map<string, ProGameInfo>()

  for (const event of data?.events || []) {
    const competition = event?.competitions?.[0] || {}
    const competitors = competition?.competitors || []
    const network = (competition?.broadcasts || [])
      .flatMap((item: any) => item?.names || [])
      .filter(Boolean)
      .join(' · ')

    for (const competitor of competitors) {
      const team = competitor?.team || {}
      const opponent = competitors.find(
        (item: any) => item !== competitor,
      )
      const opponentTeam = opponent?.team || {}
      const teamId = String(team?.id || '')

      if (!teamId) continue

      map.set(teamId, {
        teamId,
        teamAbbrev:
          team?.abbreviation || team?.shortDisplayName || '',
        opponentAbbrev:
          opponentTeam?.abbreviation || opponentTeam?.shortDisplayName || '',
        opponentTeamId: String(opponentTeam?.id || ''),
        homeAway:
          competitor?.homeAway === 'home' ? 'home' : 'away',
        kickoff: event?.date,
        statusState: event?.status?.type?.state,
        statusDetail:
          event?.status?.type?.shortDetail ||
          event?.status?.type?.detail,
        network: network || undefined,
        teamScore:
          competitor?.score !== undefined
            ? String(competitor.score)
            : undefined,
        opponentScore:
          opponent?.score !== undefined
            ? String(opponent.score)
            : undefined,
      })
    }
  }

  return map
}

function numberValue(
  value: unknown,
  fallback = 0,
) {
  const parsed = Number(value)
  return Number.isFinite(parsed)
    ? parsed
    : fallback
}

function playerPoints(
  entry: any,
  week: number,
) {
  const pool =
    entry?.playerPoolEntry || {}

  if (
    Number.isFinite(
      Number(pool?.appliedStatTotal),
    )
  ) {
    return Number(
      pool.appliedStatTotal,
    )
  }

  const stats =
    pool?.player?.stats || []

  const actual =
    stats.find(
      (stat: any) =>
        Number(
          stat?.scoringPeriodId,
        ) === week &&
        Number(
          stat?.statSourceId,
        ) === 0,
    )

  return numberValue(
    actual?.appliedTotal ??
      actual?.appliedStatTotal ??
      0,
  )
}

function playerProjection(
  entry: any,
  week: number,
) {
  const stats =
    entry?.playerPoolEntry
      ?.player?.stats || []

  const projection =
    stats.find(
      (stat: any) =>
        Number(
          stat?.scoringPeriodId,
        ) === week &&
        Number(
          stat?.statSourceId,
        ) === 1,
    )

  const value =
    projection?.appliedTotal ??
    projection?.appliedStatTotal

  return value === undefined
    ? undefined
    : numberValue(value)
}

function parsePlayers(
  side: any,
  week: number,
  proGames: Map<string, ProGameInfo>,
) {
  const entries =
    side
      ?.rosterForCurrentScoringPeriod
      ?.entries ||
    side?.rosterForMatchupPeriod
      ?.entries ||
    side?.roster?.entries ||
    []

  return entries
    .map((entry: any) => {
      const pool =
        entry?.playerPoolEntry || {}
      const player =
        pool?.player || {}

      const playerId = String(
        player?.id ||
          entry?.id ||
          Math.random(),
      )

      const lineupSlotId =
        Number(
          entry?.lineupSlotId ??
            20,
        )

      const positionId =
        Number(
          player?.defaultPositionId ??
            -1,
        )

      const lineupSlot =
        LINEUP_SLOT_NAMES[
          lineupSlotId
        ] ||
        POSITION_NAMES[
          positionId
        ] ||
        'FLEX'

      const proTeamId = String(
        player?.proTeamId ?? '',
      )
      const game =
        proGames.get(proTeamId)

      const ownership =
        player?.ownership ||
        pool?.ratings?.[0] ||
        {}

      return {
        id: playerId,
        name:
          player?.fullName ||
          player?.displayName ||
          player?.lastName ||
          'Player',
        position:
          POSITION_NAMES[
            positionId
          ] || lineupSlot,
        lineupSlot,
        started:
          ![20, 21].includes(
            lineupSlotId,
          ),
        points:
          playerPoints(
            entry,
            week,
          ),
        projected:
          playerProjection(
            entry,
            week,
          ),
        headshot:
          player?.headshot?.href ||
          fantasyHeadshot(playerId),
        proTeamId,
        proTeam:
          game?.teamAbbrev || undefined,
        opponent:
          game?.opponentAbbrev || undefined,
        homeAway:
          game?.homeAway,
        kickoff:
          game?.kickoff,
        gameStatus:
          game?.statusDetail,
        gameState:
          game?.statusState,
        network:
          game?.network,
        teamScore:
          game?.teamScore,
        opponentScore:
          game?.opponentScore,
        injuryStatus:
          player?.injuryStatus ||
          player?.injury?.status ||
          undefined,
        percentOwned:
          Number.isFinite(Number(ownership?.percentOwned))
            ? Number(ownership.percentOwned)
            : undefined,
        percentStarted:
          Number.isFinite(Number(ownership?.percentStarted))
            ? Number(ownership.percentStarted)
            : undefined,
      }
    })
    .sort(
      (a: any, b: any) => {
        if (
          a.started !==
          b.started
        ) {
          return a.started
            ? -1
            : 1
        }

        return (
          b.points -
          a.points
        )
      },
    )
}

function sideScore(
  side: any,
  week: number,
) {
  const weekPoints =
    side?.pointsByScoringPeriod?.[
      String(week)
    ] ??
    side?.pointsByScoringPeriod?.[
      week
    ]

  if (
    weekPoints !== undefined
  ) {
    return numberValue(
      weekPoints,
    )
  }

  return numberValue(
    side?.totalPoints,
  )
}

function parseSide(
  side: any,
  teams: Map<string, any>,
  week: number,
  proGames: Map<string, ProGameInfo>,
) {
  const teamId =
    String(
      side?.teamId ?? '',
    )

  const team =
    teams.get(teamId) || {}

  const projectedRaw =
    side?.totalProjectedPointsLive ??
    side?.totalProjectedPoints

  return {
    teamId,
    teamName:
      team?.name ||
      (
        team?.location &&
        team?.nickname
          ? `${team.location} ${team.nickname}`
          : team?.abbrev ||
            `Team ${teamId}`
      ),
    score:
      sideScore(
        side,
        week,
      ),
    projected:
      projectedRaw === undefined
        ? undefined
        : numberValue(
            projectedRaw,
          ),
    players:
      parsePlayers(
        side,
        week,
        proGames,
      ),
  }
}

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

  const leagueId =
    String(
      req.query?.leagueId || '',
    )

  const week =
    Math.max(
      1,
      Math.min(
        22,
        Number(
          req.query?.week || 1,
        ),
      ),
    )

  if (
    !ALLOWED_LEAGUES[
      leagueId
    ]
  ) {
    res.status(400).json({
      error:
        'Unknown fantasy league',
    })
    return
  }

  const espnS2 =
    process.env.ESPN_S2

  const swid =
    process.env.ESPN_SWID

  if (!espnS2 || !swid) {
    res.status(503).json({
      error:
        'ESPN Fantasy is not connected on Vercel yet.',
    })
    return
  }

  const seasonYear = 2026

  const params =
    new URLSearchParams()

  for (const view of [
    'mTeam',
    'mMatchupScore',
    'mBoxscore',
    'mRoster',
  ]) {
    params.append(
      'view',
      view,
    )
  }

  params.set(
    'scoringPeriodId',
    String(week),
  )
  params.set(
    'matchupPeriodId',
    String(week),
  )

  const url =
    `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/${seasonYear}/segments/0/leagues/${leagueId}?${params.toString()}`

  try {
    const response =
      await fetch(
        url,
        {
          headers: {
            Accept:
              'application/json',
            'User-Agent':
              'Mozilla/5.0 sports-ticker',
            Cookie:
              `espn_s2=${espnS2}; SWID=${swid}`,
          },
        },
      )

    if (!response.ok) {
      const body =
        await response.text()

      console.error(
        'ESPN fantasy request failed',
        response.status,
        body.slice(0, 500),
      )

      res.status(
        response.status ===
          401
          ? 401
          : 502,
      ).json({
        error:
          response.status ===
          401
            ? 'ESPN Fantasy connection expired. Update the Vercel ESPN cookies.'
            : 'ESPN Fantasy data could not be loaded.',
      })
      return
    }

    const data =
      await response.json()

    const proGames =
      await fetchNflWeekGames(week)

    const teams =
      new Map<string, any>()

    for (const team of
      data?.teams || []) {
      teams.set(
        String(team.id),
        team,
      )
    }

    const schedule =
      Array.isArray(
        data?.schedule,
      )
        ? data.schedule.filter(
            (item: any) =>
              Number(
                item?.matchupPeriodId,
              ) === week,
          )
        : []

    const matchups =
      schedule
        .filter(
          (item: any) =>
            item?.home &&
            item?.away,
        )
        .map(
          (
            item: any,
            index: number,
          ) => ({
            id: String(
              item?.id ??
                index,
            ),
            home:
              parseSide(
                item.home,
                teams,
                week,
                proGames,
              ),
            away:
              parseSide(
                item.away,
                teams,
                week,
                proGames,
              ),
          }),
        )

    res.status(200).json({
      leagueId,
      leagueName:
        data?.settings?.name ||
        data?.name ||
        ALLOWED_LEAGUES[
          leagueId
        ],
      week,
      matchups,
      espnUrl: `https://fantasy.espn.com/football/boxscore?leagueId=${leagueId}&matchupPeriodId=${week}&scoringPeriodId=${week}&seasonId=${seasonYear}`,
    })
  } catch (error) {
    console.error(
      'Fantasy proxy failed',
      error,
    )

    res.status(502).json({
      error:
        'ESPN Fantasy request failed.',
    })
  }
}
