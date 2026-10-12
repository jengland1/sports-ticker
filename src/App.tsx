import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import './App.css'

type LeagueKey = 'NHL' | 'NFL' | 'NBA' | 'MLB'

type ViewKey =
  | 'ALL'
  | 'NHL'
  | 'NFL'
  | 'NBA'
  | 'MLB'
  | 'PLAYOFFS'
  | 'FAVORITES'

type StandingInfo = {
  leagueRank?: number
  divisionRank?: number
  division?: string
}

type TeamInfo = {
  id: string
  code: string
  name: string
  displayName: string
  logo?: string
  color?: string
  record?: string
  score?: string
  standing?: StandingInfo
}

type WinProbabilityPoint = {
  home: number
  text?: string
}

type OddsInfo = {
  provider?: string
  awaySpread?: string
  awaySpreadOdds?: string
  homeSpread?: string
  homeSpreadOdds?: string
  total?: string
  overOdds?: string
  underOdds?: string
  awayMoneyline?: string
  homeMoneyline?: string
}

type Game = {
  id: string
  competitionId: string
  league: LeagueKey
  date: string
  week?: number
  statusState: 'pre' | 'in' | 'post'
  statusDetail: string
  away: TeamInfo
  home: TeamInfo
  network?: string
  odds?: OddsInfo
  winProbability?: WinProbabilityPoint[]
  summaryData?: any
  seasonType?: number
  seriesTitle?: string
  seriesSummary?: string
  seriesBestOf?: number
  roundLabel?: string
  link?: string
}

type FavoriteRef = {
  league: LeagueKey
  code: string
}

type SearchTeam = {
  id: string
  league: LeagueKey
  code: string
  name: string
  logo?: string
}

type NflWeekData = {
  games: Game[]
  week?: number
}

type PlayoffSeries = {
  key: string
  league: LeagueKey
  teams: [TeamInfo, TeamInfo]
  games: Game[]
  wins: Record<string, number>
  bestOf: number
  roundLabel: string
  summary: string
  nextGame?: Game
}

type MiniPlayer = {
  id: string
  name: string
  shortName?: string
  headshot?: string
  value?: string
  sub?: string
  position?: string
  teamCode?: string
  fantasyPoints?: number
}

type FantasyPlayer = {
  id: string
  name: string
  position: string
  lineupSlot: string
  started: boolean
  points: number
  projected?: number
  headshot?: string
  proTeam?: string
  opponent?: string
  homeAway?: 'home' | 'away'
  kickoff?: string
  gameStatus?: string
  gameState?: string
  network?: string
  teamScore?: string
  opponentScore?: string
  injuryStatus?: string
  percentOwned?: number
  percentStarted?: number
}

type FantasyMatchupSide = {
  teamId: string
  teamName: string
  score: number
  projected?: number
  players: FantasyPlayer[]
}

type FantasyMatchup = {
  id: string
  home: FantasyMatchupSide
  away: FantasyMatchupSide
}

type FantasyLeagueResponse = {
  leagueId: string
  leagueName: string
  week: number
  matchups: FantasyMatchup[]
  espnUrl?: string
}

type FantasyLeagueConfig = {
  id: string
  name: string
  teamId: string
}

const FANTASY_LEAGUES: FantasyLeagueConfig[] = [
  {
    id: '731674787',
    name: 'Jeds slander',
    teamId: '2',
  },
  {
    id: '79802277',
    name: 'SFL',
    teamId: '10',
  },
  {
    id: '952783234',
    name: 'EP Fellas',
    teamId: '1',
  },
]

const FANTASY_PROXY =
  'https://sports-ticker-mocha.vercel.app/api/fantasy'

const LEAGUES: Record<
  LeagueKey,
  { sport: string; slug: string }
> = {
  NHL: { sport: 'hockey', slug: 'nhl' },
  NFL: { sport: 'football', slug: 'nfl' },
  NBA: { sport: 'basketball', slug: 'nba' },
  MLB: { sport: 'baseball', slug: 'mlb' },
}

const LEAGUE_ORDER: LeagueKey[] = [
  'NHL',
  'NFL',
  'NBA',
  'MLB',
]

const DEFAULT_FAVORITES: FavoriteRef[] = [
  { league: 'NHL', code: 'STL' },
  { league: 'NHL', code: 'MIN' },
  { league: 'NFL', code: 'MIN' },
  { league: 'NBA', code: 'MIN' },
  { league: 'MLB', code: 'STL' },
]


const ESPN_PROXY =
  'https://sports-ticker-mocha.vercel.app/api/espn'

function espnUrl(
  host: 'site' | 'core',
  path: string,
) {
  return (
    `${ESPN_PROXY}?host=${host}` +
    `&path=${encodeURIComponent(path)}`
  )
}

const standingsCache = new Map<
  LeagueKey,
  Promise<Map<string, StandingInfo>>
>()

const gameSummaryCache = new Map<
  string,
  Promise<any>
>()

const teamLeadersCache = new Map<
  string,
  Promise<any>
>()

function fetchGameSummary(
  game: Game,
) {
  const cached =
    gameSummaryCache.get(game.id)

  if (cached) return cached

  const config =
    LEAGUES[game.league]

  const request = fetchJson(
    espnUrl(
      'site',
      `/apis/site/v2/sports/${config.sport}/${config.slug}/summary?event=${game.id}`,
    ),
  ).catch(() => null)

  gameSummaryCache.set(
    game.id,
    request,
  )

  return request
}

function fetchTeamLeaders(
  league: LeagueKey,
  teamId: string,
) {
  const key =
    `${league}-${teamId}`

  const cached =
    teamLeadersCache.get(key)

  if (cached) return cached

  const config =
    LEAGUES[league]

  const request = fetchJson(
    espnUrl(
      'site',
      `/apis/site/v2/sports/${config.sport}/${config.slug}/teams/${teamId}/leaders`,
    ),
  ).catch(() => null)

  teamLeadersCache.set(
    key,
    request,
  )

  return request
}

function cleanNumber(
  value: unknown,
) {
  const parsed = Number(
    String(value ?? '')
      .replace(/[^0-9.-]/g, ''),
  )

  return Number.isFinite(parsed)
    ? parsed
    : undefined
}

function walkLeaderRows(
  node: any,
  category = '',
  output: {
    category: string
    athlete: any
    value?: string
    numeric?: number
  }[] = [],
  depth = 0,
) {
  if (!node || depth > 8) {
    return output
  }

  if (Array.isArray(node)) {
    for (const item of node) {
      walkLeaderRows(
        item,
        category,
        output,
        depth + 1,
      )
    }

    return output
  }

  if (typeof node !== 'object') {
    return output
  }

  const nextCategory =
    node.displayName ||
    node.shortDisplayName ||
    node.name ||
    node.abbreviation ||
    category

  if (
    node.athlete &&
    (node.value !== undefined ||
      node.displayValue !== undefined ||
      node.statistics !== undefined)
  ) {
    const display =
      node.displayValue ??
      node.value ??
      node.statistics?.displayValue ??
      node.statistics?.value

    output.push({
      category:
        String(category || nextCategory),
      athlete: node.athlete,
      value:
        display !== undefined
          ? String(display)
          : undefined,
      numeric:
        cleanNumber(
          node.value ??
            node.statistics?.value ??
            display,
        ),
    })
  }

  for (const [key, value] of
    Object.entries(node)) {
    if (
      key === 'athlete' ||
      key === 'team'
    ) {
      continue
    }

    if (
      value &&
      (Array.isArray(value) ||
        typeof value === 'object')
    ) {
      walkLeaderRows(
        value,
        nextCategory,
        output,
        depth + 1,
      )
    }
  }

  return output
}

function uniqueMiniPlayers(
  rows: {
    category: string
    athlete: any
    value?: string
    numeric?: number
  }[],
  limit: number,
) {
  const seen = new Set<string>()
  const result: MiniPlayer[] = []

  for (const row of rows) {
    const athlete =
      row.athlete || {}

    const id = String(
      athlete.id ||
        athlete.uid ||
        athlete.displayName ||
        athlete.fullName ||
        '',
    )

    if (!id || seen.has(id)) {
      continue
    }

    seen.add(id)

    result.push({
      id,
      name:
        athlete.displayName ||
        athlete.fullName ||
        athlete.shortName ||
        'Player',
      shortName:
        athlete.shortName,
      headshot:
        athlete.headshot?.href ||
        athlete.headshot,
      value: row.value,
      position:
        athlete.position?.abbreviation ||
        athlete.position?.name,
    })

    if (result.length >= limit) {
      break
    }
  }

  return result
}

function teamPointLeaders(
  data: any,
  limit: number,
) {
  const rows =
    walkLeaderRows(data)

  const points =
    rows
      .filter((row) =>
        /(^|\b)(points?|pts)(\b|$)/i.test(
          row.category,
        ),
      )
      .sort(
        (a, b) =>
          (b.numeric ?? -Infinity) -
          (a.numeric ?? -Infinity),
      )

  return uniqueMiniPlayers(
    points.length
      ? points
      : rows,
    limit,
  )
}

function topNBAPlayer(
  data: any,
) {
  const rows =
    walkLeaderRows(data)

  const scoring = rows
    .filter((row) =>
      /(points?|pts|scoring)/i.test(
        row.category,
      ),
    )
    .sort(
      (a, b) =>
        (b.numeric ?? -Infinity) -
        (a.numeric ?? -Infinity),
    )

  const picked =
    uniqueMiniPlayers(
      scoring.length
        ? scoring
        : rows,
      1,
    )[0]

  if (picked?.value) {
    picked.sub = 'PPG'
  }

  return picked
}

function topMLBPlayer(
  data: any,
) {
  const rows =
    walkLeaderRows(data)

  const preferred =
    rows.filter((row) =>
      /(home runs?|hr|ops|batting average|avg|rbi)/i.test(
        row.category,
      ),
    )

  return uniqueMiniPlayers(
    preferred.length
      ? preferred
      : rows,
    1,
  )[0]
}

function getCompetitorFromSummary(
  summary: any,
  teamId: string,
) {
  return summary?.header
    ?.competitions?.[0]
    ?.competitors?.find(
      (item: any) =>
        String(item?.team?.id) ===
        String(teamId),
    )
}

function statMapFromObject(
  source: any,
) {
  const map =
    new Map<string, string>()

  const lists = [
    source?.statistics,
    source?.stats,
  ]

  for (const list of lists) {
    if (!Array.isArray(list)) {
      continue
    }

    for (const stat of list) {
      if (
        stat &&
        typeof stat === 'object'
      ) {
        const key = String(
          stat.abbreviation ||
            stat.name ||
            stat.displayName ||
            '',
        ).toUpperCase()

        const value =
          stat.displayValue ??
          stat.value

        if (key && value !== undefined) {
          map.set(
            key,
            String(value),
          )
        }
      }
    }
  }

  return map
}

function findStarter(
  summary: any,
  teamId: string,
  kind: 'goalie' | 'pitcher',
): MiniPlayer | undefined {
  const competitor =
    getCompetitorFromSummary(
      summary,
      teamId,
    )

  const probables =
    competitor?.probables ||
    competitor?.probablePitchers ||
    []

  const probable =
    Array.isArray(probables)
      ? probables.find(
          (item: any) => {
            const position =
              String(
                item?.athlete
                  ?.position
                  ?.abbreviation ||
                  item?.position
                    ?.abbreviation ||
                  '',
              ).toUpperCase()

            return kind === 'goalie'
              ? position === 'G' ||
                  /goal/i.test(
                    item?.name || '',
                  )
              : position === 'SP' ||
                  position === 'P' ||
                  /pitch/i.test(
                    item?.name || '',
                  )
          },
        ) || probables[0]
      : undefined

  if (probable?.athlete) {
    const stats =
      statMapFromObject(probable)

    const record =
      stats.get('W-L') ||
      stats.get('W-L-OTL') ||
      stats.get('RECORD') ||
      probable?.statistics
        ?.find?.(
          (item: any) =>
            /record/i.test(
              item?.name ||
                item?.displayName ||
                '',
            ),
        )?.displayValue

    const secondary =
      kind === 'goalie'
        ? stats.get('SV%') ||
          stats.get('SVPCT') ||
          stats.get('SAVE%')
        : stats.get('ERA')

    return {
      id: String(
        probable.athlete.id ||
          probable.athlete.displayName,
      ),
      name:
        probable.athlete
          .displayName ||
        probable.athlete.fullName ||
        'Starter',
      headshot:
        probable.athlete
          .headshot?.href ||
        probable.athlete
          .headshot,
      position:
        probable.athlete
          .position?.abbreviation,
      value: record,
      sub: secondary,
    }
  }

  const playerGroups =
    summary?.boxscore?.players ||
    []

  const teamGroup =
    playerGroups.find(
      (group: any) =>
        String(group?.team?.id) ===
        String(teamId),
    )

  const statGroup =
    teamGroup?.statistics?.find(
      (group: any) => {
        const label = String(
          group?.name ||
            group?.displayName ||
            '',
        )

        return kind === 'goalie'
          ? /goal/i.test(label)
          : /pitch/i.test(label)
      },
    )

  const athleteRow =
    statGroup?.athletes?.find(
      (row: any) =>
        row?.starter === true,
    ) ||
    statGroup?.athletes?.[0]

  if (!athleteRow?.athlete) {
    return undefined
  }

  const labels =
    statGroup?.labels || []
  const values =
    athleteRow?.stats || []
  const rowMap =
    new Map<string, string>()

  labels.forEach(
    (label: string, index: number) =>
      rowMap.set(
        String(label).toUpperCase(),
        String(values[index] ?? ''),
      ),
  )

  return {
    id: String(
      athleteRow.athlete.id ||
        athleteRow.athlete
          .displayName,
    ),
    name:
      athleteRow.athlete
        .displayName ||
      athleteRow.athlete
        .fullName ||
      'Starter',
    headshot:
      athleteRow.athlete
        .headshot?.href ||
      athleteRow.athlete
        .headshot,
    position:
      athleteRow.athlete
        .position?.abbreviation,
    value:
      rowMap.get('W-L') ||
      rowMap.get('W-L-OTL') ||
      rowMap.get('REC') ||
      undefined,
    sub:
      kind === 'goalie'
        ? rowMap.get('SV%') ||
          rowMap.get('SVPCT')
        : rowMap.get('ERA'),
  }
}

function dateKey(date: Date) {
  const year = date.getFullYear()

  const month = String(
    date.getMonth() + 1,
  ).padStart(2, '0')

  const day = String(
    date.getDate(),
  ).padStart(2, '0')

  return `${year}${month}${day}`
}

function addDays(
  date: Date,
  amount: number,
) {
  const copy = new Date(date)

  copy.setDate(
    copy.getDate() + amount,
  )

  return copy
}

function formatGameTime(
  iso: string,
) {
  return new Date(
    iso,
  ).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  })
}

function formatNFLGameTime(
  iso: string,
) {
  const date = new Date(iso)

  const weekday = date
    .toLocaleDateString([], {
      weekday: 'short',
    })
    .toUpperCase()

  return `${weekday} · ${formatGameTime(
    iso,
  )}`
}

function formatFavoriteDate(
  iso: string,
) {
  const date = new Date(iso)
  const today = new Date()
  const tomorrow = addDays(today, 1)

  if (
    date.toDateString() ===
    today.toDateString()
  ) {
    return `TONIGHT · ${formatGameTime(iso)}`
  }

  if (
    date.toDateString() ===
    tomorrow.toDateString()
  ) {
    return `TOMORROW · ${formatGameTime(iso)}`
  }

  const weekday = date
    .toLocaleDateString([], {
      weekday: 'short',
    })
    .toUpperCase()

  return `${weekday} · ${formatGameTime(iso)}`
}

function getTimePeriod(date: Date) {
  const hour = date.getHours()

  if (hour < 5) return 'LATE NIGHT'
  if (hour < 12) return 'MORNING'
  if (hour < 17) return 'AFTERNOON'
  if (hour < 21) return 'EVENING'

  return 'NIGHT'
}

async function fetchJson(
  url: string,
) {
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(
      `Request failed: ${response.status}`,
    )
  }

  return response.json()
}

function getStatValue(
  entry: any,
  names: string[],
) {
  const stats =
    entry?.stats || []

  for (const name of names) {
    const stat = stats.find(
      (item: any) =>
        item.name === name ||
        item.abbreviation === name,
    )

    if (stat?.value !== undefined) {
      return Number(stat.value)
    }
  }

  return undefined
}

function collectStandingEntries(
  node: any,
  inheritedGroup = '',
  output: {
    code: string
    group: string
    entry: any
  }[] = [],
) {
  const currentGroup =
    node?.name ||
    node?.shortName ||
    inheritedGroup

  const entries =
    node?.standings?.entries

  if (Array.isArray(entries)) {
    for (const entry of entries) {
      const code =
        entry?.team?.abbreviation?.toUpperCase()

      if (code) {
        output.push({
          code,
          group: currentGroup,
          entry,
        })
      }
    }
  }

  if (
    Array.isArray(
      node?.children,
    )
  ) {
    for (const child of node.children) {
      collectStandingEntries(
        child,
        currentGroup,
        output,
      )
    }
  }

  return output
}

async function fetchStandings(
  league: LeagueKey,
) {
  if (
    standingsCache.has(
      league,
    )
  ) {
    return standingsCache.get(
      league,
    )!
  }

  const promise = (async () => {
    const config =
      LEAGUES[league]

    try {
      const data = await fetchJson(
        espnUrl(
          'site',
          `/apis/v2/sports/${config.sport}/${config.slug}/standings`,
        ),
      )

      const entries =
        collectStandingEntries(
          data,
        )

      const scoreForEntry = (
        item: any,
      ) => {
        if (
          league === 'NHL'
        ) {
          return (
            getStatValue(
              item.entry,
              ['points', 'PTS'],
            ) ?? 0
          )
        }

        return (
          getStatValue(
            item.entry,
            ['winPercent', 'PCT'],
          ) ?? 0
        )
      }

      const globallySorted =
        [...entries].sort(
          (a, b) =>
            scoreForEntry(b) -
            scoreForEntry(a),
        )

      const map =
        new Map<
          string,
          StandingInfo
        >()

      for (const item of entries) {
        const leagueRank =
          globallySorted.findIndex(
            (candidate) =>
              candidate.code ===
              item.code,
          ) + 1

        const sameDivision =
          entries
            .filter(
              (candidate) =>
                candidate.group ===
                item.group,
            )
            .sort(
              (a, b) =>
                scoreForEntry(b) -
                scoreForEntry(a),
            )

        const divisionRank =
          sameDivision.findIndex(
            (candidate) =>
              candidate.code ===
              item.code,
          ) + 1

        map.set(
          item.code,
          {
            leagueRank:
              leagueRank > 0
                ? leagueRank
                : undefined,

            divisionRank:
              divisionRank > 0
                ? divisionRank
                : undefined,

            division:
              item.group ||
              undefined,
          },
        )
      }

      return map
    } catch {
      return new Map<
        string,
        StandingInfo
      >()
    }
  })()

  standingsCache.set(
    league,
    promise,
  )

  return promise
}

function parseTeam(
  competitor: any,
  standingMap: Map<
    string,
    StandingInfo
  >,
): TeamInfo {
  const team =
    competitor?.team || {}

  const code =
    team.abbreviation?.toUpperCase() ||
    team.shortDisplayName ||
    'TBD'

  return {
    id: String(
      team.id || code,
    ),

    code,

    name:
      team.shortDisplayName ||
      team.name ||
      code,

    displayName:
      team.displayName ||
      team.shortDisplayName ||
      code,

    logo:
      team.logo ||
      team.logos?.[0]?.href ||
      undefined,

    color:
      team.color ||
      team.alternateColor ||
      undefined,

    record:
      competitor?.records?.[0]
        ?.summary ||
      competitor?.record ||
      undefined,

    score:
      competitor?.score !==
      undefined
        ? String(
            competitor.score,
          )
        : undefined,

    standing:
      standingMap.get(code),
  }
}

async function parseEvents(
  data: any,
  league: LeagueKey,
  standings: Map<
    string,
    StandingInfo
  >,
): Promise<Game[]> {
  const events =
    data?.events || []

  return Promise.all(
    events.map(
      async (
        event: any,
      ): Promise<Game> => {
        const competition =
          event
            ?.competitions?.[0] ||
          {}

        const competitionId =
          String(
            competition?.id ||
              event.id,
          )

        const competitors =
          competition
            ?.competitors || []

        const awayRaw =
          competitors.find(
            (item: any) =>
              item.homeAway ===
              'away',
          )

        const homeRaw =
          competitors.find(
            (item: any) =>
              item.homeAway ===
              'home',
          )

        const away =
          parseTeam(
            awayRaw,
            standings,
          )

        const home =
          parseTeam(
            homeRaw,
            standings,
          )

        const broadcasts =
          competition
            ?.broadcasts || []

        const network =
          broadcasts
            .flatMap(
              (broadcast: any) =>
                broadcast?.names ||
                [],
            )
            .filter(Boolean)
            .join(' · ')

        const link =
          event?.links?.find(
            (item: any) =>
              item?.rel?.includes(
                'summary',
              ),
          )?.href ||
          event?.links?.[0]
            ?.href ||
          undefined

        const series =
          competition?.series ||
          event?.series ||
          {}

        const notes =
          competition?.notes ||
          competition?.headlines ||
          []

        const noteText =
          notes?.[0]?.headline ||
          notes?.[0]?.description ||
          notes?.[0]?.text ||
          ''

        const seriesSummary =
          series?.summary ||
          series?.description ||
          noteText ||
          undefined

        const seriesTitle =
          series?.title ||
          series?.name ||
          competition?.type?.text ||
          competition?.type?.abbreviation ||
          undefined

        const bestOfText =
          `${seriesSummary || ''} ${seriesTitle || ''}`

        const bestOfMatch =
          bestOfText.match(/best\s+of\s+(\d+)/i)

        const seriesBestOf =
          Number(
            series?.totalCompetitions ||
              series?.bestOf ||
              bestOfMatch?.[1] ||
              0,
          ) || undefined

        return {
          id: String(event.id),

          competitionId,

          league,

          date: event.date,

          week:
            event?.week?.number ??
            competition?.week
              ?.number ??
            data?.week?.number ??
            undefined,

          statusState:
            event?.status?.type
              ?.state ||
            'pre',

          statusDetail:
            event?.status?.type
              ?.shortDetail ||
            event?.status?.type
              ?.detail ||
            '',

          away,

          home,

          network:
            network ||
            undefined,

          seasonType:
            event?.season?.type ??
            data?.season?.type ??
            data?.leagues?.[0]
              ?.season?.type ??
            undefined,

          seriesTitle,

          seriesSummary,

          seriesBestOf,

          roundLabel:
            seriesTitle ||
            undefined,

          link,
        }
      },
    ),
  )
}

async function fetchGames(
  league: LeagueKey,
  date: Date,
) {
  const config =
    LEAGUES[league]

  const standings =
    await fetchStandings(
      league,
    )

  const data =
    await fetchJson(
      espnUrl(
        'site',
        `/apis/site/v2/sports/${config.sport}/${config.slug}/scoreboard?dates=${dateKey(
          date,
        )}&limit=100`,
      ),
    )

  const games =
    await parseEvents(
      data,
      league,
      standings,
    )

  // ESPN's NFL scoreboard can return the entire week even when a
  // specific date is requested. Keep the ticker truly date-scoped
  // by filtering NFL games to the selected local calendar day.
  if (league === 'NFL') {
    const target =
      date.toDateString()

    return games.filter(
      (game) =>
        new Date(
          game.date,
        ).toDateString() ===
        target,
    )
  }

  return games
}

async function fetchPostseasonGames(
  league: LeagueKey,
  seasonYear: number,
): Promise<Game[]> {
  const config =
    LEAGUES[league]

  const standings =
    await fetchStandings(
      league,
    )

  const data =
    await fetchJson(
      espnUrl(
        'site',
        `/apis/site/v2/sports/${config.sport}/${config.slug}/scoreboard?dates=${seasonYear}&seasontype=3&limit=1000`,
      ),
    )

  const games =
    await parseEvents(
      data,
      league,
      standings,
    )

  return games.filter((game) => {
    if (game.seasonType === 3) {
      return true
    }

    const postseasonText =
      `${game.seriesTitle || ''} ${game.seriesSummary || ''}`
        .toLowerCase()

    return (
      postseasonText.includes('postseason') ||
      postseasonText.includes('playoff') ||
      postseasonText.includes('wild card') ||
      postseasonText.includes('division series') ||
      postseasonText.includes('championship series') ||
      postseasonText.includes('world series') ||
      postseasonText.includes('conference final') ||
      postseasonText.includes('stanley cup') ||
      postseasonText.includes('nba finals') ||
      postseasonText.includes('super bowl')
    )
  })
}

function postseasonIsActiveNow(
  games: Game[],
  now = new Date(),
) {
  if (!games.length) {
    return false
  }

  const DAY = 24 * 60 * 60 * 1000
  const windowStart =
    now.getTime() - 10 * DAY
  const windowEnd =
    now.getTime() + 21 * DAY

  return games.some((game) => {
    const time =
      new Date(game.date).getTime()

    return (
      Number.isFinite(time) &&
      time >= windowStart &&
      time <= windowEnd
    )
  })
}

function playoffBestOf(
  league: LeagueKey,
  games: Game[],
  label: string,
) {
  const explicit =
    games.find(
      (game) =>
        game.seriesBestOf,
    )?.seriesBestOf

  if (explicit) {
    return explicit
  }

  if (league === 'NFL') {
    return 1
  }

  const text =
    label.toLowerCase()

  if (league === 'MLB') {
    if (
      text.includes('wild card')
    ) {
      return 3
    }

    if (
      text.includes('division')
    ) {
      return 5
    }

    return 7
  }

  return 7
}

function seriesRoundLabel(
  league: LeagueKey,
  games: Game[],
) {
  const raw =
    games.find(
      (game) =>
        game.roundLabel ||
        game.seriesTitle,
    )

  const text =
    raw?.roundLabel ||
    raw?.seriesTitle ||
    `${league} PLAYOFFS`

  return text
    .replace(/postseason/gi, 'PLAYOFFS')
    .toUpperCase()
}

function buildPlayoffSeries(
  league: LeagueKey,
  games: Game[],
): PlayoffSeries[] {
  const groups =
    new Map<
      string,
      Game[]
    >()

  for (const game of games) {
    const ids = [
      game.away.id,
      game.home.id,
    ].sort()

    const key =
      `${league}-${ids.join('-')}`

    groups.set(
      key,
      [
        ...(groups.get(key) || []),
        game,
      ],
    )
  }

  return [
    ...groups.entries(),
  ]
    .map(([key, seriesGames]) => {
      const ordered =
        [...seriesGames].sort(
          (a, b) =>
            new Date(a.date).getTime() -
            new Date(b.date).getTime(),
        )

      const first = ordered[0]
      const teams: [
        TeamInfo,
        TeamInfo,
      ] = [
        first.away,
        first.home,
      ]

      const wins: Record<
        string,
        number
      > = {
        [teams[0].id]: 0,
        [teams[1].id]: 0,
      }

      for (const game of ordered) {
        if (
          game.statusState !==
          'post'
        ) {
          continue
        }

        const awayScore =
          Number(game.away.score)
        const homeScore =
          Number(game.home.score)

        if (
          Number.isFinite(awayScore) &&
          Number.isFinite(homeScore) &&
          awayScore !== homeScore
        ) {
          const winnerId =
            awayScore > homeScore
              ? game.away.id
              : game.home.id

          wins[winnerId] =
            (wins[winnerId] || 0) + 1
        }
      }

      const roundLabel =
        seriesRoundLabel(
          league,
          ordered,
        )

      const bestOf =
        playoffBestOf(
          league,
          ordered,
          roundLabel,
        )

      const nextGame =
        ordered.find(
          (game) =>
            game.statusState !==
            'post',
        )

      const leftWins =
        wins[teams[0].id] || 0
      const rightWins =
        wins[teams[1].id] || 0

      const leader =
        leftWins === rightWins
          ? `SERIES TIED ${leftWins}-${rightWins}`
          : leftWins > rightWins
            ? `${teams[0].code} LEADS ${leftWins}-${rightWins}`
            : `${teams[1].code} LEADS ${rightWins}-${leftWins}`

      const apiSummary =
        ordered.find(
          (game) =>
            game.seriesSummary,
        )?.seriesSummary

      return {
        key,
        league,
        teams,
        games: ordered,
        wins,
        bestOf,
        roundLabel,
        summary:
          apiSummary || leader,
        nextGame,
      }
    })
    .sort((a, b) => {
      const rank = (label: string) => {
        const text =
          label.toLowerCase()

        if (
          text.includes('wild card') ||
          text.includes('first round') ||
          text.includes('round 1')
        ) return 1

        if (
          text.includes('division') ||
          text.includes('semifinal') ||
          text.includes('round 2')
        ) return 2

        if (
          text.includes('conference final') ||
          text.includes('championship')
        ) return 3

        if (
          text.includes('final') ||
          text.includes('world series') ||
          text.includes('stanley cup')
        ) return 4

        return 2
      }

      const roundDiff =
        rank(a.roundLabel) -
        rank(b.roundLabel)

      if (roundDiff) return roundDiff

      return (
        new Date(
          a.games[0]?.date || 0,
        ).getTime() -
        new Date(
          b.games[0]?.date || 0,
        ).getTime()
      )
    })
}

function getNFLSeasonYear() {
  const now = new Date()
  const month = now.getMonth()

  return month === 0
    ? now.getFullYear() - 1
    : now.getFullYear()
}

async function fetchNFLWeekGames(
  week?: number,
): Promise<NflWeekData> {
  const standings =
    await fetchStandings(
      'NFL',
    )

  const seasonYear =
    getNFLSeasonYear()

  const query = week
    ? `?limit=100&dates=${seasonYear}&seasontype=2&week=${week}`
    : '?limit=100'

  const data =
    await fetchJson(
      espnUrl(
        'site',
        `/apis/site/v2/sports/football/nfl/scoreboard${query}`,
      ),
    )

  const games =
    await parseEvents(
      data,
      'NFL',
      standings,
    )

  const requestedWeek =
    week ??
    data?.week?.number ??
    games.find(
      (game) => game.week,
    )?.week

  const filteredGames =
    requestedWeek
      ? games.filter(
          (game) =>
            !game.week ||
            game.week === requestedWeek,
        )
      : games

  return {
    games: filteredGames,
    week: requestedWeek,
  }
}

async function fetchLiveGame(
  game: Game,
): Promise<Game> {
  const config =
    LEAGUES[game.league]

  try {
    const [games, summary] =
      await Promise.all([
        fetchGames(
          game.league,
          new Date(game.date),
        ),
        fetchJson(
          espnUrl(
            'site',
            `/apis/site/v2/sports/${config.sport}/${config.slug}/summary?event=${game.id}`,
          ),
        ).catch(() => null),
      ])

    const fresh =
      games.find(
        (candidate) =>
          candidate.id ===
          game.id,
      )

    const rawProbability =
      Array.isArray(
        summary?.winprobability,
      )
        ? summary.winprobability
        : []

    const winProbability: WinProbabilityPoint[] =
      rawProbability
        .map((point: any) => {
          const value =
            Number(
              point?.homeWinPercentage,
            )

          if (
            Number.isNaN(value)
          ) {
            return null
          }

          return {
            home:
              Math.max(
                0,
                Math.min(
                  1,
                  value,
                ),
              ),
            text:
              point?.play?.text ||
              point?.playText ||
              undefined,
          }
        })
        .filter(Boolean) as WinProbabilityPoint[]

    if (!fresh) {
      return {
        ...game,
        winProbability:
          winProbability.length
            ? winProbability
            : game.winProbability,
        summaryData:
          summary ||
          game.summaryData,
      }
    }

    return {
      ...game,
      ...fresh,
      away: {
        ...game.away,
        ...fresh.away,
      },
      home: {
        ...game.home,
        ...fresh.home,
      },
      winProbability:
        winProbability.length
          ? winProbability
          : game.winProbability,
      summaryData:
        summary ||
        game.summaryData,
      link:
        fresh.link ||
        game.link,
    }
  } catch (error) {
    console.error(
      'Live game refresh failed',
      error,
    )

    return game
  }
}

async function fetchLeagueTeams(
  league: LeagueKey,
): Promise<SearchTeam[]> {
  const config =
    LEAGUES[league]

  try {
    const data =
      await fetchJson(
        espnUrl(
          'site',
          `/apis/site/v2/sports/${config.sport}/${config.slug}/teams?limit=1000`,
        ),
      )

    const rawTeams =
      data?.sports?.[0]
        ?.leagues?.[0]
        ?.teams || []

    const parsed: SearchTeam[] =
      []

    for (const entry of rawTeams) {
      const team =
        entry?.team ||
        entry ||
        {}

      const code =
        team?.abbreviation?.toUpperCase()

      if (!code) {
        continue
      }

      parsed.push({
        id: String(
          team.id || code,
        ),

        league,

        code,

        name:
          team.displayName ||
          team.shortDisplayName ||
          team.name ||
          code,

        logo:
          team.logos?.[0]?.href ||
          team.logo ||
          undefined,
      })
    }

    return parsed
  } catch {
    return []
  }
}

function ordinal(
  value?: number,
) {
  if (!value) return ''

  const mod10 =
    value % 10

  const mod100 =
    value % 100

  if (
    mod10 === 1 &&
    mod100 !== 11
  ) {
    return `${value}st`
  }

  if (
    mod10 === 2 &&
    mod100 !== 12
  ) {
    return `${value}nd`
  }

  if (
    mod10 === 3 &&
    mod100 !== 13
  ) {
    return `${value}rd`
  }

  return `${value}th`
}

function standingText(
  team: TeamInfo,
  league: LeagueKey,
) {
  const standing =
    team.standing

  if (!standing) {
    return team.record || ''
  }

  const leaguePart =
    standing.leagueRank
      ? `#${standing.leagueRank} ${league}`
      : ''

  const divisionPart =
    standing.divisionRank &&
    standing.division
      ? `${ordinal(
          standing.divisionRank,
        )} ${standing.division}`
      : ''

  return [
    leaguePart,
    divisionPart,
  ]
    .filter(Boolean)
    .join(' · ')
}

function TeamLogo({
  team,
  large = false,
}: {
  team: {
    code: string
    displayName?: string
    name?: string
    logo?: string
  }

  large?: boolean
}) {
  return (
    <div
      className={`teamLogo ${
        large
          ? 'teamLogoLarge'
          : ''
      }`}
    >
      {team.logo ? (
        <img
          src={team.logo}
          alt={`${
            team.displayName ||
            team.name ||
            team.code
          } logo`}
        />
      ) : (
        <span>
          {team.code}
        </span>
      )}
    </div>
  )
}


function normalizeTeamColor(
  color?: string,
  fallback = '#8a94a3',
) {
  if (!color) return fallback

  const clean =
    color.replace('#', '').trim()

  return /^[0-9a-f]{6}$/i.test(clean)
    ? `#${clean}`
    : fallback
}

function ProbabilityGraph({
  game,
}: {
  game: Game
}) {
  const points =
    game.winProbability || []

  const awayColor =
    normalizeTeamColor(
      game.away.color,
      '#7f8b99',
    )

  const homeColor =
    normalizeTeamColor(
      game.home.color,
      '#d8dde5',
    )

  if (points.length < 2) {
    return (
      <section
        style={{
          marginTop: 22,
          paddingTop: 18,
          borderTop:
            '1px solid rgba(255,255,255,.08)',
        }}
      >
        <div
          style={{
            color:
              'rgba(255,255,255,.38)',
            fontSize: 8,
            fontWeight: 900,
            letterSpacing: '.15em',
          }}
        >
          WIN PROBABILITY
        </div>

        <div
          style={{
            marginTop: 14,
            minHeight: 90,
            display: 'grid',
            placeItems: 'center',
            border:
              '1px solid rgba(255,255,255,.06)',
            background:
              'rgba(255,255,255,.015)',
            color:
              'rgba(255,255,255,.28)',
            fontSize: 9,
            fontWeight: 800,
          }}
        >
          LIVE WIN PROBABILITY WILL APPEAR HERE
        </div>
      </section>
    )
  }

  const width = 440
  const height = 150
  const paddingX = 10
  const paddingY = 12
  const usableWidth =
    width - paddingX * 2
  const usableHeight =
    height - paddingY * 2

  const coords =
    points.map(
      (point, index) => ({
        x:
          paddingX +
          (index /
            Math.max(
              1,
              points.length - 1,
            )) *
            usableWidth,
        y:
          paddingY +
          (1 - point.home) *
            usableHeight,
        home:
          point.home,
      }),
    )

  const latest =
    points[points.length - 1]
      .home

  const awayPct =
    Math.round(
      (1 - latest) * 100,
    )

  const homePct =
    Math.round(latest * 100)

  return (
    <section
      style={{
        marginTop: 22,
        paddingTop: 18,
        borderTop:
          '1px solid rgba(255,255,255,.08)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent:
            'space-between',
          gap: 12,
        }}
      >
        <div>
          <div
            style={{
              color:
                'rgba(255,255,255,.38)',
              fontSize: 8,
              fontWeight: 900,
              letterSpacing: '.15em',
            }}
          >
            WIN PROBABILITY
          </div>

          <div
            style={{
              marginTop: 4,
              color:
                'rgba(255,255,255,.25)',
              fontSize: 7,
              fontWeight: 800,
            }}
          >
            LINE COLOR = TEAM CURRENTLY FAVORED
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            gap: 12,
            fontSize: 10,
            fontWeight: 950,
          }}
        >
          <span
            style={{
              color: awayColor,
            }}
          >
            {game.away.code}{' '}
            {awayPct}%
          </span>

          <span
            style={{
              color: homeColor,
            }}
          >
            {game.home.code}{' '}
            {homePct}%
          </span>
        </div>
      </div>

      <div
        style={{
          marginTop: 12,
          padding: '7px 4px 2px',
          border:
            '1px solid rgba(255,255,255,.06)',
          borderRadius: 8,
          background:
            'linear-gradient(180deg, rgba(255,255,255,.025), rgba(255,255,255,.008))',
          overflow: 'hidden',
        }}
      >
        <svg
          viewBox={`0 0 ${width} ${height}`}
          width="100%"
          height="150"
          preserveAspectRatio="none"
          aria-label="Game win probability history"
        >
          <line
            x1={paddingX}
            x2={width - paddingX}
            y1={paddingY}
            y2={paddingY}
            stroke="rgba(255,255,255,.04)"
          />

          <line
            x1={paddingX}
            x2={width - paddingX}
            y1={height / 2}
            y2={height / 2}
            stroke="rgba(255,255,255,.13)"
            strokeDasharray="4 5"
          />

          <line
            x1={paddingX}
            x2={width - paddingX}
            y1={height - paddingY}
            y2={height - paddingY}
            stroke="rgba(255,255,255,.04)"
          />

          {coords.slice(1).map(
            (point, index) => {
              const previous =
                coords[index]

              const midpoint =
                (previous.home +
                  point.home) /
                2

              const stroke =
                midpoint > 0.5
                  ? homeColor
                  : midpoint < 0.5
                    ? awayColor
                    : '#a8b0bb'

              return (
                <line
                  key={index}
                  x1={previous.x}
                  y1={previous.y}
                  x2={point.x}
                  y2={point.y}
                  stroke={stroke}
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              )
            },
          )}
        </svg>
      </div>
    </section>
  )
}


type DetailStatRow = {
  label: string
  away: string
  home: string
}

type DetailLeader = {
  name: string
  value: string
  label: string
  headshot?: string
}

function cleanStatKey(
  value?: string,
) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

function getSummaryTeamEntry(
  summary: any,
  teamId: string,
) {
  const teams =
    summary?.boxscore?.teams || []

  return teams.find(
    (entry: any) =>
      String(
        entry?.team?.id ||
          entry?.id ||
          '',
      ) === String(teamId),
  )
}

function getSummaryStatMap(
  summary: any,
  teamId: string,
) {
  const entry =
    getSummaryTeamEntry(
      summary,
      teamId,
    )

  const map =
    new Map<string, string>()

  for (const stat of
    entry?.statistics || []) {
    const value =
      stat?.displayValue ??
      stat?.value

    if (
      value === undefined ||
      value === null ||
      value === ''
    ) {
      continue
    }

    for (const key of [
      stat?.name,
      stat?.label,
      stat?.displayName,
      stat?.shortDisplayName,
      stat?.abbreviation,
    ]) {
      if (!key) continue

      map.set(
        cleanStatKey(key),
        String(value),
      )
    }
  }

  return map
}

function findStatValue(
  map: Map<string, string>,
  aliases: string[],
) {
  for (const alias of aliases) {
    const exact =
      map.get(
        cleanStatKey(alias),
      )

    if (exact !== undefined) {
      return exact
    }
  }

  for (const [
    key,
    value,
  ] of map) {
    if (
      aliases.some((alias) =>
        key.includes(
          cleanStatKey(alias),
        ),
      )
    ) {
      return value
    }
  }

  return '—'
}

function buildDetailStats(
  game: Game,
): DetailStatRow[] {
  const summary =
    game.summaryData

  const awayMap =
    getSummaryStatMap(
      summary,
      game.away.id,
    )

  const homeMap =
    getSummaryStatMap(
      summary,
      game.home.id,
    )

  const configs: Record<
    LeagueKey,
    Array<{
      label: string
      aliases: string[]
    }>
  > = {
    NHL: [
      { label: 'Shots', aliases: ['shots', 'shotsOnGoal'] },
      { label: 'Faceoff %', aliases: ['faceoffPercent', 'faceoffPercentage'] },
      { label: 'Power Play', aliases: ['powerPlay', 'powerPlayGoals'] },
      { label: 'Hits', aliases: ['hits'] },
      { label: 'Blocks', aliases: ['blockedShots', 'blocks'] },
      { label: 'Takeaways', aliases: ['takeaways'] },
    ],
    NBA: [
      { label: 'FG %', aliases: ['fieldGoalPct', 'fieldGoalPercentage'] },
      { label: '3PT %', aliases: ['threePointFieldGoalPct', 'threePointPct'] },
      { label: 'Rebounds', aliases: ['totalRebounds', 'rebounds'] },
      { label: 'Assists', aliases: ['assists'] },
      { label: 'Turnovers', aliases: ['turnovers'] },
      { label: 'Points in Paint', aliases: ['pointsInPaint'] },
    ],
    NFL: [
      { label: 'Total Yards', aliases: ['totalYards', 'netTotalYards'] },
      { label: 'Pass Yards', aliases: ['netPassingYards', 'passingYards'] },
      { label: 'Rush Yards', aliases: ['rushingYards'] },
      { label: 'First Downs', aliases: ['firstDowns'] },
      { label: '3rd Down', aliases: ['thirdDownEff', 'thirdDownEfficiency'] },
      { label: 'Turnovers', aliases: ['turnovers'] },
    ],
    MLB: [
      { label: 'Hits', aliases: ['hits'] },
      { label: 'Home Runs', aliases: ['homeRuns'] },
      { label: 'Walks', aliases: ['walks', 'basesOnBalls'] },
      { label: 'Strikeouts', aliases: ['strikeouts'] },
      { label: 'Errors', aliases: ['errors'] },
      { label: 'LOB', aliases: ['leftOnBase'] },
    ],
  }

  return configs[
    game.league
  ]
    .map((config) => ({
      label: config.label,
      away: findStatValue(
        awayMap,
        config.aliases,
      ),
      home: findStatValue(
        homeMap,
        config.aliases,
      ),
    }))
    .filter(
      (row) =>
        row.away !== '—' ||
        row.home !== '—',
    )
}

function collectLeaderCandidates(
  node: any,
  inheritedLabel = '',
  out: DetailLeader[] = [],
  depth = 0,
) {
  if (
    !node ||
    depth > 8 ||
    out.length > 20
  ) {
    return out
  }

  if (Array.isArray(node)) {
    for (const item of node) {
      collectLeaderCandidates(
        item,
        inheritedLabel,
        out,
        depth + 1,
      )
    }

    return out
  }

  if (
    typeof node !== 'object'
  ) {
    return out
  }

  const nextLabel =
    node?.displayName ||
    node?.shortDisplayName ||
    node?.name ||
    inheritedLabel

  const athlete =
    node?.athlete

  if (
    athlete?.displayName ||
    athlete?.fullName
  ) {
    const value =
      node?.displayValue ??
      node?.value ??
      node?.summary ??
      ''

    if (String(value)) {
      out.push({
        name:
          athlete.displayName ||
          athlete.fullName,
        value: String(value),
        label:
          String(
            inheritedLabel ||
              nextLabel ||
              'Leader',
          ),
        headshot:
          athlete?.headshot?.href ||
          athlete?.headshot,
      })
    }
  }

  for (const value of
    Object.values(node)) {
    if (
      value &&
      typeof value ===
        'object'
    ) {
      collectLeaderCandidates(
        value,
        String(nextLabel || ''),
        out,
        depth + 1,
      )
    }
  }

  return out
}

function getDetailLeaders(
  game: Game,
) {
  const all =
    collectLeaderCandidates(
      game.summaryData?.leaders ||
        [],
    )

  const unique =
    Array.from(
      new Map(
        all.map((leader) => [
          `${leader.name}-${leader.label}`,
          leader,
        ]),
      ).values(),
    )

  return unique.slice(0, 6)
}

function rankText(
  team: TeamInfo,
) {
  const leagueRank =
    team.standing?.leagueRank

  if (!leagueRank) {
    return '—'
  }

  return `#${leagueRank}`
}

function gameDateLong(
  iso: string,
) {
  return new Date(
    iso,
  ).toLocaleDateString(
    [],
    {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    },
  )
}

const GAME_DETAIL_STYLES = `
  .gameDrawer.popupDrawer {
    width: 100%;
    min-height: calc(100vh - 20px);
    padding: 18px 20px 24px;
    overflow: hidden;
    background:
      radial-gradient(circle at 50% -4%, rgba(75,118,160,.15), transparent 31%),
      linear-gradient(180deg, #0d1217 0%, #080b0e 56%, #06080a 100%);
  }

  .popupDrawer .drawerClose { z-index: 20; }

  .gd-kicker {
    display:flex; justify-content:center; align-items:center; gap:8px;
    margin:2px 0 10px; color:rgba(255,255,255,.38);
    font-size:8px; font-weight:900; letter-spacing:.18em;
  }

  .gd-kicker-dot {
    width:5px; height:5px; border-radius:999px; background:#63dc83;
    box-shadow:0 0 10px rgba(99,220,131,.55);
  }

  .gd-hero {
    position:relative; display:grid; grid-template-columns:1fr 120px 1fr;
    align-items:center; gap:10px; min-height:190px; padding:22px 10px 18px;
    border:1px solid rgba(255,255,255,.07); border-radius:14px;
    background:rgba(255,255,255,.018); overflow:hidden;
  }

  .gd-team-glow {
    position:absolute; inset:auto auto 0 0; width:44%; height:65%;
    opacity:.09; filter:blur(30px); pointer-events:none;
  }

  .gd-team-glow.right { left:auto; right:0; }

  .gd-team {
    position:relative; z-index:1; display:flex; flex-direction:column;
    align-items:center; min-width:0;
  }

  .gd-team .teamLogo.large {
    width:76px; height:76px;
    filter:drop-shadow(0 10px 18px rgba(0,0,0,.35));
  }

  .gd-team-code {
    margin-top:8px; color:#fff; font-size:27px; line-height:1;
    font-weight:950; letter-spacing:-.04em;
  }

  .gd-record {
    margin-top:5px; color:rgba(255,255,255,.48); font-size:10px; font-weight:750;
  }

  .gd-rank {
    margin-top:8px; padding:4px 7px; border:1px solid rgba(255,255,255,.08);
    border-radius:999px; color:rgba(255,255,255,.55); font-size:7px;
    font-weight:900; letter-spacing:.1em;
  }

  .gd-center { position:relative; z-index:1; text-align:center; }

  .gd-status {
    color:#fff; font-size:21px; font-weight:950; letter-spacing:-.035em;
  }

  .gd-substatus {
    margin-top:6px; color:rgba(255,255,255,.38); font-size:8px;
    font-weight:850; letter-spacing:.08em;
  }

  .gd-live {
    color:#ff6b65; font-size:9px; font-weight:950; letter-spacing:.13em;
  }

  .gd-score {
    display:flex; justify-content:center; align-items:center; gap:8px;
    margin-top:6px; font-size:31px; font-weight:950;
  }

  .gd-score span { color:rgba(255,255,255,.22); font-size:15px; }

  .gd-grid {
    display:grid; grid-template-columns:repeat(4,minmax(0,1fr));
    gap:8px; margin-top:10px;
  }

  .gd-mini {
    min-width:0; padding:10px 9px; border:1px solid rgba(255,255,255,.065);
    border-radius:9px; background:rgba(255,255,255,.018);
  }

  .gd-mini-label {
    color:rgba(255,255,255,.27); font-size:6px; font-weight:950; letter-spacing:.13em;
  }

  .gd-mini-value {
    margin-top:5px; overflow:hidden; color:rgba(255,255,255,.82);
    font-size:9px; font-weight:850; line-height:1.25; text-overflow:ellipsis; white-space:nowrap;
  }

  .gd-section {
    margin-top:12px; padding:14px; border:1px solid rgba(255,255,255,.065);
    border-radius:12px; background:rgba(255,255,255,.014);
  }

  .gd-section-head {
    display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:12px;
  }

  .gd-section-title {
    color:rgba(255,255,255,.43); font-size:8px; font-weight:950; letter-spacing:.16em;
  }

  .gd-section-note {
    color:rgba(255,255,255,.22); font-size:7px; font-weight:800;
  }

  .gd-comparison-row {
    display:grid; grid-template-columns:62px 1fr 90px 1fr 62px;
    align-items:center; gap:8px; min-height:29px;
    border-top:1px solid rgba(255,255,255,.045);
  }

  .gd-comparison-row:first-of-type { border-top:0; }

  .gd-stat-value { color:#fff; font-size:10px; font-weight:950; }
  .gd-stat-value.right { text-align:right; }

  .gd-stat-label {
    color:rgba(255,255,255,.30); font-size:7px; font-weight:900;
    text-align:center; letter-spacing:.06em;
  }

  .gd-bar {
    height:4px; border-radius:99px; background:rgba(255,255,255,.055); overflow:hidden;
  }

  .gd-bar > span { display:block; height:100%; border-radius:99px; }
  .gd-bar.reverse { display:flex; justify-content:flex-end; }

  .gd-leaders {
    display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:8px;
  }

  .gd-leader {
    min-width:0; padding:10px; border:1px solid rgba(255,255,255,.055);
    border-radius:9px; background:rgba(0,0,0,.14);
  }

  .gd-leader-top { display:flex; align-items:center; gap:7px; }

  .gd-headshot {
    width:30px; height:30px; border-radius:50%; object-fit:cover;
    background:rgba(255,255,255,.06);
  }

  .gd-leader-name {
    overflow:hidden; color:rgba(255,255,255,.82); font-size:8px; font-weight:900;
    text-overflow:ellipsis; white-space:nowrap;
  }

  .gd-leader-label {
    margin-top:2px; overflow:hidden; color:rgba(255,255,255,.27);
    font-size:6px; font-weight:800; text-overflow:ellipsis; white-space:nowrap;
  }

  .gd-leader-value {
    margin-top:8px; color:#fff; font-size:14px; font-weight:950; letter-spacing:-.025em;
  }

  .gd-empty {
    padding:15px 10px; color:rgba(255,255,255,.27); font-size:8px;
    font-weight:800; text-align:center; letter-spacing:.04em;
  }

  .popupDrawer .espnButton { margin-top:12px; border-radius:10px; }

  @media (max-width:470px) {
    .gd-hero { grid-template-columns:1fr 94px 1fr; }
    .gd-team .teamLogo.large { width:62px; height:62px; }
    .gd-team-code { font-size:23px; }
    .gd-grid { grid-template-columns:repeat(2,minmax(0,1fr)); }
    .gd-leaders { grid-template-columns:1fr; }
    .gd-comparison-row { grid-template-columns:48px 1fr 76px 1fr 48px; gap:6px; }
  }
`

function GameDetail({
  game,
  popup = false,
}: {
  game: Game
  popup?: boolean
}) {
  function openEspn() {
    if (!game.link) return

    window.open(
      game.link,
      '_blank',
      'noopener,noreferrer',
    )
  }

  const stats =
    buildDetailStats(game)

  const leaders =
    getDetailLeaders(game)

  const summary =
    game.summaryData

  const competition =
    summary?.header
      ?.competitions?.[0]

  const venue =
    summary?.gameInfo
      ?.venue?.fullName ||
    competition?.venue
      ?.fullName ||
    'Venue pending'

  const attendanceRaw =
    summary?.gameInfo
      ?.attendance

  const attendance =
    attendanceRaw
      ? Number(
          attendanceRaw,
        ).toLocaleString()
      : '—'

  const broadcast =
    game.network ||
    competition?.broadcasts
      ?.flatMap(
        (item: any) =>
          item?.names || [],
      )
      ?.filter(Boolean)
      ?.join(' · ') ||
    'Local'

  const awayColor =
    normalizeTeamColor(
      game.away.color,
      '#67bbdf',
    )

  const homeColor =
    normalizeTeamColor(
      game.home.color,
      '#d8dde5',
    )

  function percentWidth(
    value: string,
  ) {
    const number =
      Number(
        String(value)
          .replace(/[^0-9.-]/g, ''),
      )

    if (
      Number.isNaN(number)
    ) {
      return 50
    }

    return Math.max(
      8,
      Math.min(
        100,
        Math.abs(number),
      ),
    )
  }

  const statusMain =
    game.statusState === 'in'
      ? null
      : game.statusState ===
          'post'
        ? 'FINAL'
        : game.league ===
            'NFL'
          ? formatNFLGameTime(
              game.date,
            )
          : formatGameTime(
              game.date,
            )

  return (
    <section
      className={`gameDrawer ${
        popup
          ? 'popupDrawer'
          : ''
      }`}
    >
      {popup && (
        <style>
          {GAME_DETAIL_STYLES}
        </style>
      )}

      {popup && (
        <button
          type="button"
          className="drawerClose"
          onClick={() =>
            window.close()
          }
        >
          ×
        </button>
      )}

      <div className="gd-kicker">
        <span
          className="gd-kicker-dot"
        />

        {game.league}
        {' · '}
        GAME CENTER
      </div>

      <div className="gd-hero">
        <div
          className="gd-team-glow"
          style={{
            background:
              awayColor,
          }}
        />

        <div
          className="gd-team-glow right"
          style={{
            background:
              homeColor,
          }}
        />

        <div className="gd-team">
          <TeamLogo
            team={game.away}
            large
          />

          <div className="gd-team-code">
            {game.away.code}
          </div>

          <div className="gd-record">
            {game.away.record ||
              '—'}
          </div>

          <div className="gd-rank">
            {rankText(
              game.away,
            )}{' '}
            LEAGUE
          </div>
        </div>

        <div className="gd-center">
          {game.statusState ===
          'in' ? (
            <>
              <div className="gd-live">
                ● LIVE
              </div>

              <div className="gd-score">
                <strong>
                  {game.away.score}
                </strong>

                <span>—</span>

                <strong>
                  {game.home.score}
                </strong>
              </div>

              <div className="gd-substatus">
                {game.statusDetail}
              </div>
            </>
          ) : (
            <>
              <div className="gd-status">
                {statusMain}
              </div>

              <div className="gd-substatus">
                {game.statusState ===
                'post'
                  ? game.statusDetail
                  : '@'}
              </div>

              {game.statusState !==
                'post' && (
                <div className="gd-substatus">
                  {broadcast}
                </div>
              )}
            </>
          )}
        </div>

        <div className="gd-team">
          <TeamLogo
            team={game.home}
            large
          />

          <div className="gd-team-code">
            {game.home.code}
          </div>

          <div className="gd-record">
            {game.home.record ||
              '—'}
          </div>

          <div className="gd-rank">
            {rankText(
              game.home,
            )}{' '}
            LEAGUE
          </div>
        </div>
      </div>

      <div className="gd-grid">
        <div className="gd-mini">
          <div className="gd-mini-label">
            DATE
          </div>
          <div className="gd-mini-value">
            {gameDateLong(
              game.date,
            )}
          </div>
        </div>

        <div className="gd-mini">
          <div className="gd-mini-label">
            VENUE
          </div>
          <div
            className="gd-mini-value"
            title={venue}
          >
            {venue}
          </div>
        </div>

        <div className="gd-mini">
          <div className="gd-mini-label">
            BROADCAST
          </div>
          <div
            className="gd-mini-value"
            title={broadcast}
          >
            {broadcast}
          </div>
        </div>

        <div className="gd-mini">
          <div className="gd-mini-label">
            ATTENDANCE
          </div>
          <div className="gd-mini-value">
            {attendance}
          </div>
        </div>
      </div>

      <section className="gd-section">
        <div className="gd-section-head">
          <div className="gd-section-title">
            TEAM COMPARISON
          </div>
          <div className="gd-section-note">
            ESPN GAME DATA
          </div>
        </div>

        {stats.length ? (
          stats.map((row) => (
            <div
              className="gd-comparison-row"
              key={row.label}
            >
              <div className="gd-stat-value">
                {row.away}
              </div>

              <div className="gd-bar reverse">
                <span
                  style={{
                    width: `${percentWidth(
                      row.away,
                    )}%`,
                    background:
                      awayColor,
                  }}
                />
              </div>

              <div className="gd-stat-label">
                {row.label}
              </div>

              <div className="gd-bar">
                <span
                  style={{
                    width: `${percentWidth(
                      row.home,
                    )}%`,
                    background:
                      homeColor,
                  }}
                />
              </div>

              <div className="gd-stat-value right">
                {row.home}
              </div>
            </div>
          ))
        ) : (
          <div className="gd-empty">
            LIVE TEAM STATS WILL
            POPULATE AS ESPN
            PUBLISHES THE GAME
            FEED.
          </div>
        )}
      </section>

      <section className="gd-section">
        <div className="gd-section-head">
          <div className="gd-section-title">
            IMPACT PLAYERS
          </div>
          <div className="gd-section-note">
            LEADERS / GAME IMPACT
          </div>
        </div>

        {leaders.length ? (
          <div className="gd-leaders">
            {leaders.map(
              (leader, index) => (
                <div
                  className="gd-leader"
                  key={`${leader.name}-${index}`}
                >
                  <div className="gd-leader-top">
                    {leader.headshot ? (
                      <img
                        className="gd-headshot"
                        src={
                          leader.headshot
                        }
                        alt=""
                      />
                    ) : (
                      <div className="gd-headshot" />
                    )}

                    <div
                      style={{
                        minWidth: 0,
                      }}
                    >
                      <div className="gd-leader-name">
                        {leader.name}
                      </div>
                      <div className="gd-leader-label">
                        {leader.label}
                      </div>
                    </div>
                  </div>

                  <div className="gd-leader-value">
                    {leader.value}
                  </div>
                </div>
              ),
            )}
          </div>
        ) : (
          <div className="gd-empty">
            PLAYER LEADER DATA IS
            NOT AVAILABLE FOR THIS
            GAME YET.
          </div>
        )}
      </section>

      <ProbabilityGraph
        game={game}
      />

      <button
        type="button"
        className="espnButton"
        disabled={!game.link}
        onClick={openEspn}
      >
        OPEN FULL ESPN GAMECAST ↗
      </button>
    </section>
  )
}

function PlayerHeadshot({
  player,
}: {
  player?: MiniPlayer
}) {
  if (!player) {
    return (
      <div className="quickHeadshot quickHeadshotEmpty">
        ?
      </div>
    )
  }

  if (player.headshot) {
    return (
      <img
        className="quickHeadshot"
        src={player.headshot}
        alt=""
      />
    )
  }

  return (
    <div className="quickHeadshot quickHeadshotEmpty">
      {player.name
        .split(' ')
        .map((part) => part[0])
        .join('')
        .slice(0, 2)}
    </div>
  )
}

function GameQuickStats({
  game,
}: {
  game: Game
}) {
  const [summary, setSummary] =
    useState<any>(
      game.summaryData || null,
    )

  const [awayLeaders, setAwayLeaders] =
    useState<any>(null)
  const [homeLeaders, setHomeLeaders] =
    useState<any>(null)
  const [statsLoaded, setStatsLoaded] =
    useState(false)

  useEffect(() => {
    if (game.league === 'NFL') {
      return
    }

    let active = true
    setStatsLoaded(false)

    Promise.all([
      fetchGameSummary(game),
      fetchTeamLeaders(
        game.league,
        game.away.id,
      ),
      fetchTeamLeaders(
        game.league,
        game.home.id,
      ),
    ]).then(
      ([nextSummary, away, home]) => {
        if (!active) return
        setSummary(nextSummary)
        setAwayLeaders(away)
        setHomeLeaders(home)
        setStatsLoaded(true)
      },
    ).catch(() => {
      if (!active) return
      setStatsLoaded(true)
    })

    return () => {
      active = false
    }
  }, [
    game.id,
    game.league,
    game.away.id,
    game.home.id,
  ])

  if (game.league === 'NFL') {
    return null
  }

  if (game.league === 'NHL') {
    const awayPoints =
      teamPointLeaders(
        awayLeaders,
        3,
      )
    const homePoints =
      teamPointLeaders(
        homeLeaders,
        3,
      )
    const awayGoalie =
      findStarter(
        summary,
        game.away.id,
        'goalie',
      )
    const homeGoalie =
      findStarter(
        summary,
        game.home.id,
        'goalie',
      )

    return (
      <div className="gameQuickStats">
        <div className="quickStatTitle">
          SEASON LEADERS · PROJECTED STARTERS
        </div>
        <div className="quickTeamGrid">
          {[
            {
              code: game.away.code,
              leaders: awayPoints,
              goalie: awayGoalie,
            },
            {
              code: game.home.code,
              leaders: homePoints,
              goalie: homeGoalie,
            },
          ].map((side) => (
            <div
              className="quickTeamPanel"
              key={side.code}
            >
              <div className="quickTeamCode">
                {side.code} · POINTS
              </div>
              <div className="quickLeaderList">
                {side.leaders.length ? (
                  side.leaders.map(
                    (player, index) => (
                      <div
                        className="quickLeaderRow"
                        key={player.id}
                      >
                        <span>
                          {index + 1}. {player.name}
                        </span>
                        <strong>
                          {player.value || '—'}
                        </strong>
                      </div>
                    ),
                  )
                ) : (
                  <div className="quickUnavailable">
                    {statsLoaded
                      ? 'Season leaders unavailable'
                      : 'Loading season leaders…'}
                  </div>
                )}
              </div>
              <div className="quickStarter">
                <PlayerHeadshot
                  player={side.goalie}
                />
                <div>
                  <span>STARTING GOALIE</span>
                  <strong>
                    {side.goalie?.name ||
                      'TBD'}
                  </strong>
                  <em>
                    {side.goalie
                      ? `${side.goalie.value || 'Record —'} · SV% ${side.goalie.sub || '—'}`
                      : 'Starter not posted yet'}
                  </em>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (game.league === 'NBA') {
    const away =
      topNBAPlayer(awayLeaders)
    const home =
      topNBAPlayer(homeLeaders)

    return (
      <div className="gameQuickStats">
        <div className="quickStatTitle">
          LEADING SCORERS
        </div>
        <div className="quickFeatureGrid">
          {[
            [game.away.code, away],
            [game.home.code, home],
          ].map(([code, player]: any) => (
            <div
              className="quickFeaturePlayer"
              key={code}
            >
              <PlayerHeadshot
                player={player}
              />
              <div>
                <span>{code}</span>
                <strong>
                  {player?.name ||
                    (statsLoaded
                      ? 'Stats unavailable'
                      : 'Loading…')}
                </strong>
                <em>
                  {player?.value
                    ? `${player.value} PPG`
                    : 'PPG —'}
                </em>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  const awayPitcher =
    findStarter(
      summary,
      game.away.id,
      'pitcher',
    )
  const homePitcher =
    findStarter(
      summary,
      game.home.id,
      'pitcher',
    )
  const awayTop =
    topMLBPlayer(awayLeaders)
  const homeTop =
    topMLBPlayer(homeLeaders)

  return (
    <div className="gameQuickStats">
      <div className="quickStatTitle">
        STARTERS · TEAM SPOTLIGHT
      </div>
      <div className="quickTeamGrid">
        {[
          {
            code: game.away.code,
            starter: awayPitcher,
            top: awayTop,
          },
          {
            code: game.home.code,
            starter: homePitcher,
            top: homeTop,
          },
        ].map((side) => (
          <div
            className="quickTeamPanel"
            key={side.code}
          >
            <div className="quickStarter">
              <PlayerHeadshot
                player={side.starter}
              />
              <div>
                <span>{side.code} STARTER</span>
                <strong>
                  {side.starter?.name ||
                    'TBD'}
                </strong>
                <em>
                  {side.starter
                    ? `${side.starter.value || 'Record —'}${side.starter.sub ? ` · ${side.starter.sub} ERA` : ''}`
                    : 'Starter not posted yet'}
                </em>
              </div>
            </div>
            <div className="quickTopPlayer">
              <span>TOP PLAYER</span>
              <strong>
                {side.top?.name ||
                  (statsLoaded
                    ? 'Stats unavailable'
                    : 'Loading…')}
              </strong>
              <em>
                {side.top?.value || '—'}
              </em>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

async function fetchFantasyLeague(
  leagueId: string,
  week: number,
): Promise<FantasyLeagueResponse> {
  const response = await fetch(
    `${FANTASY_PROXY}?leagueId=${encodeURIComponent(
      leagueId,
    )}&week=${week}`,
  )

  const data = await response.json()

  if (!response.ok) {
    throw new Error(
      data?.error ||
        'Fantasy matchup data unavailable',
    )
  }

  return data as FantasyLeagueResponse
}

function fantasyGameMeta(
  player: FantasyPlayer,
) {
  const opponent =
    player.opponent
      ? `${
          player.homeAway === 'home'
            ? 'vs'
            : '@'
        } ${player.opponent}`
      : ''

  let timing =
    player.gameStatus || ''

  if (
    player.gameState === 'pre' &&
    player.kickoff
  ) {
    timing = new Date(
      player.kickoff,
    ).toLocaleTimeString(
      [],
      {
        hour: 'numeric',
        minute: '2-digit',
      },
    )
  }

  return [
    player.proTeam,
    opponent,
    timing,
  ]
    .filter(Boolean)
    .join(' · ')
}

function FantasyPlayerCard({
  player,
  side,
}: {
  player?: FantasyPlayer
  side: 'left' | 'right'
}) {
  if (!player) {
    return (
      <div
        className={`fantasyPlayerSide ${side} empty`}
      />
    )
  }

  const injury =
    player.injuryStatus &&
    ![
      'ACTIVE',
      'NORMAL',
    ].includes(
      player.injuryStatus.toUpperCase(),
    )
      ? player.injuryStatus
      : null

  return (
    <div
      className={`fantasyPlayerSide ${side}`}
    >
      <div className="fantasyPlayerIdentity">
        {player.headshot ? (
          <img
            src={player.headshot}
            alt=""
            className="fantasyPlayerPhoto"
            onError={(event) => {
              event.currentTarget.style.display =
                'none'
            }}
          />
        ) : (
          <div className="fantasyPlayerPhoto placeholder" />
        )}

        <div className="fantasyPlayerText">
          <div className="fantasyPlayerNameLine">
            <strong>{player.name}</strong>

            {injury && (
              <span className="fantasyInjuryTag">
                {injury}
              </span>
            )}
          </div>

          <span className="fantasyPlayerMeta">
            {player.position}
            {player.proTeam
              ? ` · ${player.proTeam}`
              : ''}
          </span>

          <span className="fantasyPlayerGame">
            {fantasyGameMeta(player) ||
              'Game info unavailable'}
          </span>
        </div>
      </div>

      <div className="fantasyPlayerScoreBlock">
        <span className="fantasyPlayerProj">
          {player.projected !== undefined
            ? player.projected.toFixed(1)
            : '—'}
        </span>
        <strong>
          {player.points.toFixed(1)}
        </strong>
      </div>
    </div>
  )
}

function FantasyLineupComparison({
  away,
  home,
  starters,
}: {
  away: FantasyMatchupSide
  home: FantasyMatchupSide
  starters: boolean
}) {
  const awayPlayers =
    away.players.filter(
      (player) =>
        player.started === starters,
    )
  const homePlayers =
    home.players.filter(
      (player) =>
        player.started === starters,
    )

  const length = Math.max(
    awayPlayers.length,
    homePlayers.length,
  )

  return (
    <section
      className={`fantasyComparisonSection ${
        starters ? '' : 'bench'
      }`}
    >
      <div className="fantasyComparisonHeader">
        <span>
          {starters ? 'STARTERS' : 'BENCH'}
        </span>
        <div>
          <span>PROJ</span>
          <span>PTS</span>
        </div>
      </div>

      <div className="fantasyComparisonColumns">
        <span>{away.teamName}</span>
        <span>SLOT</span>
        <span>{home.teamName}</span>
      </div>

      {Array.from({
        length,
      }).map((_, index) => {
        const left = awayPlayers[index]
        const right = homePlayers[index]
        const slot =
          left?.lineupSlot ||
          right?.lineupSlot ||
          (starters ? 'FLEX' : 'BN')

        return (
          <div
            className="fantasyVersusRow"
            key={`${
              left?.id || 'empty-left'
            }-${
              right?.id || 'empty-right'
            }-${index}`}
          >
            <FantasyPlayerCard
              player={left}
              side="left"
            />

            <div className="fantasySlotCenter">
              {starters ? slot : 'BN'}
            </div>

            <FantasyPlayerCard
              player={right}
              side="right"
            />
          </div>
        )
      })}
    </section>
  )
}

function NFLFantasyView({
  week,
}: {
  week: number
}) {
  const [
    selectedLeagueIndex,
    setSelectedLeagueIndex,
  ] = useState(0)

  const [
    selectedMatchupIndex,
    setSelectedMatchupIndex,
  ] = useState(0)

  const [
    leagueData,
    setLeagueData,
  ] =
    useState<FantasyLeagueResponse | null>(
      null,
    )

  const [loading, setLoading] =
    useState(true)

  const [error, setError] =
    useState<string | null>(null)

  const league =
    FANTASY_LEAGUES[
      selectedLeagueIndex
    ]

  useEffect(() => {
    let active = true

    async function load() {
      setLoading(true)
      setError(null)

      try {
        const data =
          await fetchFantasyLeague(
            league.id,
            week,
          )

        if (!active) return

        setLeagueData(data)

        const myMatchupIndex =
          data.matchups.findIndex(
            (matchup) =>
              matchup.home.teamId ===
                league.teamId ||
              matchup.away.teamId ===
                league.teamId,
          )

        setSelectedMatchupIndex(
          myMatchupIndex >= 0
            ? myMatchupIndex
            : 0,
        )
      } catch (err) {
        if (!active) return

        setLeagueData(null)
        setError(
          err instanceof Error
            ? err.message
            : 'Fantasy matchup data unavailable',
        )
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    load()

    const timer =
      window.setInterval(
        load,
        15000,
      )

    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [
    league.id,
    league.teamId,
    week,
  ])

  const matchups =
    leagueData?.matchups || []

  const safeMatchupIndex =
    Math.min(
      selectedMatchupIndex,
      Math.max(
        0,
        matchups.length - 1,
      ),
    )

  const matchup =
    matchups[safeMatchupIndex]

  function changeMatchup(
    amount: number,
  ) {
    if (!matchups.length) return

    setSelectedMatchupIndex(
      (current) =>
        (current +
          amount +
          matchups.length) %
        matchups.length,
    )
  }

  const awayIsMine =
    matchup?.away.teamId ===
    league.teamId
  const homeIsMine =
    matchup?.home.teamId ===
    league.teamId

  const awayLeading =
    Boolean(matchup) &&
    matchup!.away.score >
      matchup!.home.score
  const homeLeading =
    Boolean(matchup) &&
    matchup!.home.score >
      matchup!.away.score

  const projectedWinPercentages =
    matchup?.away.projected !==
      undefined &&
    matchup?.home.projected !==
      undefined
      ? (() => {
          const difference =
            matchup.away.projected -
            matchup.home.projected
          const awayRaw =
            1 /
            (1 +
              Math.exp(
                -difference / 12,
              ))
          const away = Math.round(
            Math.max(
              0.05,
              Math.min(
                0.95,
                awayRaw,
              ),
            ) * 100,
          )

          return {
            away,
            home: 100 - away,
          }
        })()
      : null

  return (
    <section className="nflFantasyView espnStyleFantasy">
      <div className="fantasyViewHeader">
        <div>
          <span>ESPN FANTASY</span>
          <strong>MATCHUP</strong>
        </div>
        <em>WEEK {week}</em>
      </div>

      <div className="fantasyLeagueSwitcher">
        {FANTASY_LEAGUES.map(
          (item, index) => (
            <button
              type="button"
              key={item.id}
              className={
                index ===
                selectedLeagueIndex
                  ? 'active'
                  : ''
              }
              onClick={() =>
                setSelectedLeagueIndex(
                  index,
                )
              }
            >
              {item.name}
            </button>
          ),
        )}
      </div>

      {loading ? (
        <div className="fantasyLoading">
          LOADING ESPN MATCHUPS…
        </div>
      ) : error ? (
        <div className="fantasyConnectCard">
          <strong>
            ESPN FANTASY CONNECTION REQUIRED
          </strong>
          <span>{error}</span>
          <small>
            Your private ESPN leagues need the
            secure Vercel fantasy endpoint
            connected once. No ESPN credentials
            belong in App.tsx.
          </small>
        </div>
      ) : matchup ? (
        <>
          <div className="fantasyMatchupNav espnMatchupNav">
            <button
              type="button"
              onClick={() =>
                changeMatchup(-1)
              }
              aria-label="Previous matchup"
            >
              ‹
            </button>

            <div className="fantasyMatchupNames sideBySideNames">
              <strong>
                {matchup.away.teamName}
              </strong>
              <span>VS</span>
              <strong>
                {matchup.home.teamName}
              </strong>
            </div>

            <button
              type="button"
              onClick={() =>
                changeMatchup(1)
              }
              aria-label="Next matchup"
            >
              ›
            </button>
          </div>

          <div className="fantasyMatchupScoreboard espnScoreboard">
            <div
              className={`${
                awayIsMine
                  ? 'isMine '
                  : ''
              }${
                awayLeading
                  ? 'isLeading'
                  : ''
              }`}
            >
              <small>AWAY</small>
              <span className="fantasyScoreTeamName">
                {matchup.away.teamName}
              </span>
              <strong>
                {matchup.away.score.toFixed(1)}
              </strong>
              <div className="fantasyScoreDetails">
                <span>
                  PROJ{' '}
                  {matchup.away.projected !== undefined
                    ? matchup.away.projected.toFixed(1)
                    : '—'}
                </span>
                <span>
                  WIN{' '}
                  {projectedWinPercentages
                    ? `${projectedWinPercentages.away}%`
                    : '—'}
                </span>
              </div>
            </div>

            <em>VS</em>

            <div
              className={`${
                homeIsMine
                  ? 'isMine '
                  : ''
              }${
                homeLeading
                  ? 'isLeading'
                  : ''
              }`}
            >
              <small>HOME</small>
              <span className="fantasyScoreTeamName">
                {matchup.home.teamName}
              </span>
              <strong>
                {matchup.home.score.toFixed(1)}
              </strong>
              <div className="fantasyScoreDetails">
                <span>
                  PROJ{' '}
                  {matchup.home.projected !== undefined
                    ? matchup.home.projected.toFixed(1)
                    : '—'}
                </span>
                <span>
                  WIN{' '}
                  {projectedWinPercentages
                    ? `${projectedWinPercentages.home}%`
                    : '—'}
                </span>
              </div>
            </div>
          </div>

          {leagueData?.espnUrl && (
            <a
              className="openEspnMatchup"
              href={`${leagueData.espnUrl}&teamId=${matchup.away.teamId}`}
              target="_blank"
              rel="noreferrer"
            >
              OPEN THIS MATCHUP IN ESPN ↗
            </a>
          )}

          <FantasyLineupComparison
            away={matchup.away}
            home={matchup.home}
            starters
          />

          <FantasyLineupComparison
            away={matchup.away}
            home={matchup.home}
            starters={false}
          />
        </>
      ) : (
        <div className="fantasyLoading">
          No matchup data for Week {week}.
        </div>
      )}
    </section>
  )
}

function GameRow({
  game,
  onSelect,
}: {
  game: Game
  onSelect: (
    game: Game,
  ) => void
}) {
  return (
    <button
      type="button"
      className={`gameRow ${
        game.statusState ===
        'in'
          ? 'liveGame'
          : ''
      }`}
      onClick={() =>
        onSelect(game)
      }
    >
      {game.statusState ===
        'in' && (
        <div className="liveBanner">
          <span />

          LIVE
        </div>
      )}

      <div className="gameMain">
        <div className="teamColumn away">
          <TeamLogo
            team={game.away}
          />

          <div>
            <strong>
              {game.away.code}
            </strong>

            <span>
              {game.away.record ||
                '—'}
            </span>
          </div>
        </div>

        <div className="centerColumn">
          {game.statusState ===
          'in' ? (
            <>
              <strong>
                {game.statusDetail}
              </strong>

              <div className="liveScore">
                <strong>
                  {game.away.score}
                </strong>

                <span>—</span>

                <strong>
                  {game.home.score}
                </strong>
              </div>
            </>
          ) : game.statusState ===
            'post' ? (
            <>
              <strong className="finalCenter">
                {game.away.score}{' '}
                —{' '}
                {game.home.score}
              </strong>

              <span>FINAL</span>
            </>
          ) : (
            <>
              <strong>
                {game.league ===
                'NFL'
                  ? formatNFLGameTime(
                      game.date,
                    )
                  : formatGameTime(
                      game.date,
                    )}
              </strong>

              <span>@</span>
            </>
          )}
        </div>

        <div className="teamColumn home">
          <div>
            <strong>
              {game.home.code}
            </strong>

            <span>
              {game.home.record ||
                '—'}
            </span>
          </div>

          <TeamLogo
            team={game.home}
          />
        </div>
      </div>

      <div className="detailLine">
        <span>
          {standingText(
            game.away,
            game.league,
          )}
        </span>

        <span>
          {standingText(
            game.home,
            game.league,
          )}
        </span>
      </div>

      <GameQuickStats
        game={game}
      />

      {(game.seriesSummary ||
        game.seriesBestOf) && (
        <div
          style={{
            marginTop: 5,
            padding: '5px 7px',
            borderRadius: 7,
            background:
              'rgba(255,255,255,.045)',
            border:
              '1px solid rgba(255,255,255,.06)',
            display: 'flex',
            justifyContent:
              'space-between',
            gap: 8,
            fontSize: 7,
            fontWeight: 900,
            letterSpacing: '.06em',
          }}
        >
          <span
            style={{
              opacity: .72,
              overflow: 'hidden',
              textOverflow:
                'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {game.seriesSummary ||
              'PLAYOFF SERIES'}
          </span>
          {game.seriesBestOf && (
            <span
              style={{
                opacity: .48,
                whiteSpace: 'nowrap',
              }}
            >
              BEST OF {game.seriesBestOf}
            </span>
          )}
        </div>
      )}

      {game.network && (
        <div className="networkLine">
          {game.network}
        </div>
      )}

    </button>
  )
}

function LeagueSection({
  league,
  games,
  label,
  onSelect,
}: {
  league: LeagueKey
  games: Game[]
  label?: string
  onSelect: (
    game: Game,
  ) => void
}) {
  if (!games.length) {
    return null
  }

  return (
    <section
      className={`leagueSection league-${league.toLowerCase()}`}
    >
      <div className="leagueHeader">
        <strong>
          {league}
        </strong>

        <span />

        <em>
          {label ||
            `${games.length} ${
              games.length === 1
                ? 'GAME'
                : 'GAMES'
            }`}
        </em>
      </div>

      {games.map(
        (game) => (
          <GameRow
            key={`${game.league}-${game.id}`}
            game={game}
            onSelect={
              onSelect
            }
          />
        ),
      )}
    </section>
  )
}

function PlayoffsHub({
  gamesByLeague,
  loading,
  selectedLeague,
  onSelectLeague,
  onSelectGame,
}: {
  gamesByLeague: Record<
    LeagueKey,
    Game[]
  >
  loading: boolean
  selectedLeague: LeagueKey | null
  onSelectLeague: (
    league: LeagueKey | null,
  ) => void
  onSelectGame: (
    game: Game,
  ) => void
}) {
  const leagueSeries =
    useMemo(() => {
      const result = {} as Record<
        LeagueKey,
        PlayoffSeries[]
      >

      for (const league of LEAGUE_ORDER) {
        result[league] =
          buildPlayoffSeries(
            league,
            gamesByLeague[league],
          )
      }

      return result
    }, [gamesByLeague])

  const availableLeagues =
    LEAGUE_ORDER.filter(
      (league) =>
        leagueSeries[league]
          .length > 0,
    )

  const [expanded, setExpanded] =
    useState<string | null>(null)

  // If only one league is actually in the postseason right now,
  // skip the league-picker screen and open that bracket immediately.
  const effectiveSelectedLeague =
    selectedLeague ||
    (availableLeagues.length === 1
      ? availableLeagues[0]
      : null)

  const shell: any = {
    padding: '12px 10px 24px',
  }

  const card: any = {
    border: '1px solid rgba(255,255,255,.09)',
    borderRadius: 14,
    background:
      'linear-gradient(180deg, rgba(255,255,255,.055), rgba(255,255,255,.018))',
  }

  if (loading) {
    return (
      <div style={shell}>
        <div
          style={{
            ...card,
            padding: 20,
            textAlign: 'center',
            fontWeight: 900,
            letterSpacing: '.14em',
          }}
        >
          BUILDING LIVE BRACKETS…
        </div>
      </div>
    )
  }

  if (!effectiveSelectedLeague) {
    return (
      <div style={shell}>
        <div
          style={{
            marginBottom: 14,
          }}
        >
          <div
            style={{
              fontSize: 10,
              letterSpacing: '.18em',
              color: 'rgba(255,255,255,.45)',
              fontWeight: 900,
            }}
          >
            LIVE POSTSEASON HUB
          </div>
          <div
            style={{
              fontSize: 24,
              fontWeight: 1000,
              letterSpacing: '-.04em',
            }}
          >
            PLAYOFFS
          </div>
        </div>

        {availableLeagues.length === 0 ? (
          <div
            style={{
              ...card,
              padding: 18,
              color: 'rgba(255,255,255,.64)',
              lineHeight: 1.5,
            }}
          >
            No active postseason brackets are available right now. This tab will populate automatically when ESPN has playoff games for NHL, NFL, NBA, or MLB.
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gap: 10,
            }}
          >
            {availableLeagues.map(
              (league) => {
                const series =
                  leagueSeries[league]

                const liveGames =
                  series.flatMap(
                    (item) =>
                      item.games,
                  ).filter(
                    (game) =>
                      game.statusState ===
                      'in',
                  ).length

                return (
                  <button
                    type="button"
                    key={league}
                    onClick={() =>
                      onSelectLeague(
                        league,
                      )
                    }
                    style={{
                      ...card,
                      border: '1px solid rgba(255,255,255,.1)',
                      padding: 14,
                      color: 'white',
                      textAlign: 'left',
                      cursor: 'pointer',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent:
                          'space-between',
                        gap: 10,
                        alignItems: 'center',
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontSize: 10,
                            opacity: .52,
                            letterSpacing: '.14em',
                            fontWeight: 900,
                          }}
                        >
                          {league} POSTSEASON
                        </div>
                        <div
                          style={{
                            fontSize: 20,
                            fontWeight: 1000,
                          }}
                        >
                          OPEN {league} BRACKET
                        </div>
                      </div>

                      <div
                        style={{
                          fontSize: 22,
                          opacity: .8,
                        }}
                      >
                        →
                      </div>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        gap: 8,
                        marginTop: 10,
                        fontSize: 9,
                        fontWeight: 900,
                        letterSpacing: '.09em',
                        opacity: .64,
                      }}
                    >
                      <span>
                        {series.length} SERIES
                      </span>
                      {liveGames > 0 && (
                        <span>
                          • {liveGames} LIVE
                        </span>
                      )}
                    </div>
                  </button>
                )
              },
            )}
          </div>
        )}
      </div>
    )
  }

  const series =
    leagueSeries[effectiveSelectedLeague]

  const grouped =
    series.reduce(
      (map, item) => {
        const label =
          item.roundLabel

        if (!map.has(label)) {
          map.set(label, [])
        }

        map.get(label)!.push(item)
        return map
      },
      new Map<
        string,
        PlayoffSeries[]
      >(),
    )

  return (
    <div style={shell}>
      <button
        type="button"
        onClick={() =>
          onSelectLeague(null)
        }
        style={{
          border: 0,
          background: 'transparent',
          color: 'rgba(255,255,255,.65)',
          fontWeight: 900,
          fontSize: 10,
          letterSpacing: '.12em',
          padding: '4px 0 12px',
          cursor: 'pointer',
        }}
      >
        ← PLAYOFFS
      </button>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'end',
          marginBottom: 14,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 10,
              opacity: .48,
              letterSpacing: '.16em',
              fontWeight: 900,
            }}
          >
            LIVE BRACKET
          </div>
          <div
            style={{
              fontSize: 26,
              fontWeight: 1000,
              letterSpacing: '-.04em',
            }}
          >
            {effectiveSelectedLeague}
          </div>
        </div>
        <div
          style={{
            fontSize: 9,
            opacity: .48,
            fontWeight: 900,
            letterSpacing: '.1em',
          }}
        >
          {series.length} SERIES
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gap: 14,
        }}
      >
        {[...grouped.entries()].map(
          ([round, items]) => (
            <section key={round}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 7,
                }}
              >
                <strong
                  style={{
                    fontSize: 10,
                    letterSpacing: '.15em',
                  }}
                >
                  {round}
                </strong>
                <span
                  style={{
                    height: 1,
                    flex: 1,
                    background:
                      'rgba(255,255,255,.1)',
                  }}
                />
              </div>

              <div
                style={{
                  display: 'grid',
                  gap: 8,
                }}
              >
                {items.map((item) => {
                  const [left, right] =
                    item.teams
                  const leftWins =
                    item.wins[left.id] || 0
                  const rightWins =
                    item.wins[right.id] || 0
                  const isOpen =
                    expanded === item.key
                  const targetWins =
                    Math.floor(
                      item.bestOf / 2,
                    ) + 1
                  const clinchPossible =
                    leftWins === targetWins - 1 ||
                    rightWins === targetWins - 1

                  return (
                    <div
                      key={item.key}
                      style={card}
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setExpanded(
                            isOpen
                              ? null
                              : item.key,
                          )
                        }
                        style={{
                          width: '100%',
                          border: 0,
                          background:
                            'transparent',
                          color: 'white',
                          textAlign: 'left',
                          padding: 11,
                          cursor: 'pointer',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent:
                              'space-between',
                            fontSize: 8,
                            fontWeight: 900,
                            letterSpacing: '.12em',
                            opacity: .55,
                            marginBottom: 8,
                          }}
                        >
                          <span>
                            BEST OF {item.bestOf}
                          </span>
                          {clinchPossible &&
                            item.bestOf > 1 && (
                            <span>
                              CLINCH POSSIBLE
                            </span>
                          )}
                        </div>

                        {[left, right].map(
                          (team) => (
                            <div
                              key={team.id}
                              style={{
                                display: 'grid',
                                gridTemplateColumns:
                                  '28px 1fr auto',
                                gap: 8,
                                alignItems: 'center',
                                padding: '4px 0',
                              }}
                            >
                              <TeamLogo
                                team={team}
                              />
                              <div>
                                <strong
                                  style={{
                                    fontSize: 14,
                                  }}
                                >
                                  {team.code}
                                </strong>
                                <div
                                  style={{
                                    fontSize: 8,
                                    opacity: .5,
                                  }}
                                >
                                  {team.record || '—'}
                                </div>
                              </div>
                              <strong
                                style={{
                                  fontSize: 21,
                                  fontVariantNumeric:
                                    'tabular-nums',
                                }}
                              >
                                {item.wins[team.id] || 0}
                              </strong>
                            </div>
                          ),
                        )}

                        <div
                          style={{
                            marginTop: 8,
                            paddingTop: 8,
                            borderTop:
                              '1px solid rgba(255,255,255,.07)',
                            display: 'flex',
                            justifyContent:
                              'space-between',
                            gap: 8,
                            fontSize: 8,
                            fontWeight: 900,
                            letterSpacing: '.08em',
                          }}
                        >
                          <span
                            style={{
                              opacity: .72,
                            }}
                          >
                            {item.summary}
                          </span>
                          <span
                            style={{
                              opacity: .42,
                            }}
                          >
                            {isOpen ? '▲' : '▼'}
                          </span>
                        </div>
                      </button>

                      {isOpen && (
                        <div
                          style={{
                            borderTop:
                              '1px solid rgba(255,255,255,.07)',
                            padding: 9,
                            display: 'grid',
                            gap: 6,
                          }}
                        >
                          {item.games.map(
                            (game, index) => (
                              <button
                                type="button"
                                key={game.id}
                                onClick={() =>
                                  onSelectGame(
                                    game,
                                  )
                                }
                                style={{
                                  border:
                                    '1px solid rgba(255,255,255,.07)',
                                  borderRadius: 9,
                                  background:
                                    'rgba(0,0,0,.18)',
                                  color: 'white',
                                  padding:
                                    '8px 9px',
                                  display: 'grid',
                                  gridTemplateColumns:
                                    '44px 1fr auto',
                                  gap: 8,
                                  alignItems: 'center',
                                  cursor: 'pointer',
                                  textAlign: 'left',
                                }}
                              >
                                <span
                                  style={{
                                    fontSize: 8,
                                    opacity: .48,
                                    fontWeight: 900,
                                  }}
                                >
                                  GAME {index + 1}
                                </span>
                                <span
                                  style={{
                                    fontSize: 9,
                                    fontWeight: 900,
                                  }}
                                >
                                  {game.away.code}{' '}
                                  {game.away.score || '—'}
                                  {'  ·  '}
                                  {game.home.code}{' '}
                                  {game.home.score || '—'}
                                </span>
                                <span
                                  style={{
                                    fontSize: 8,
                                    opacity: .58,
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {game.statusState === 'post'
                                    ? 'FINAL'
                                    : game.statusState === 'in'
                                      ? game.statusDetail || 'LIVE'
                                      : formatGameTime(game.date)}
                                </span>
                              </button>
                            ),
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </section>
          ),
        )}
      </div>
    </div>
  )
}

function loadSavedFavorites(): FavoriteRef[] {
  try {
    const stored =
      localStorage.getItem(
        'sportsTickerFavorites',
      )

    if (!stored) {
      return DEFAULT_FAVORITES
    }

    const parsed =
      JSON.parse(stored)

    return Array.isArray(parsed)
      ? parsed
      : DEFAULT_FAVORITES
  } catch {
    return DEFAULT_FAVORITES
  }
}

function App() {
  const params =
    new URLSearchParams(
      window.location.search,
    )

  const popupMode =
    params.get('popup') ===
    '1'

  const popupData =
    params.get('data')

  const [
    popupGame,
    setPopupGame,
  ] =
    useState<Game | null>(
      () => {
        if (
          !popupMode ||
          !popupData
        ) {
          return null
        }

        try {
          return JSON.parse(
            popupData,
          ) as Game
        } catch {
          return null
        }
      },
    )

  const [now, setNow] =
    useState(new Date())

  const [
    selectedDate,
    setSelectedDate,
  ] = useState(new Date())

  const [view, setView] =
    useState<ViewKey>('ALL')

  const [
    gamesByLeague,
    setGamesByLeague,
  ] = useState<
    Record<
      LeagueKey,
      Game[]
    >
  >({
    NHL: [],
    NFL: [],
    NBA: [],
    MLB: [],
  })

  const [
    playoffGamesByLeague,
    setPlayoffGamesByLeague,
  ] = useState<
    Record<LeagueKey, Game[]>
  >({
    NHL: [],
    NFL: [],
    NBA: [],
    MLB: [],
  })

  const [
    playoffLoading,
    setPlayoffLoading,
  ] = useState(false)

  const [
    selectedPlayoffLeague,
    setSelectedPlayoffLeague,
  ] = useState<LeagueKey | null>(null)

  const [
    nflWeekGames,
    setNflWeekGames,
  ] = useState<Game[]>([])

  const [
    nflWeekNumber,
    setNflWeekNumber,
  ] = useState<
    number | undefined
  >()

  const [
    selectedNFLWeek,
    setSelectedNFLWeek,
  ] = useState<
    number | undefined
  >()

  const [
    nflFantasyMode,
    setNflFantasyMode,
  ] = useState(false)

  const [
    favorites,
    setFavorites,
  ] = useState<
    FavoriteRef[]
  >(loadSavedFavorites)

  const [
    favoriteGames,
    setFavoriteGames,
  ] = useState<Game[]>([])

  const [
    teamDirectory,
    setTeamDirectory,
  ] = useState<SearchTeam[]>(
    [],
  )

  const [
    teamSearch,
    setTeamSearch,
  ] = useState('')

  const [loading, setLoading] =
    useState(true)

  const [error, setError] =
    useState<string | null>(
      null,
    )

  const feedRef =
    useRef<HTMLDivElement | null>(
      null,
    )

  const pausedRef =
    useRef(false)

  const resumeTimerRef =
    useRef<number | null>(
      null,
    )

  useEffect(() => {
    if (
      !popupMode ||
      !popupGame
    ) {
      return
    }

    let cancelled = false

    const seedGame =
      popupGame

    async function refreshPopupGame() {
      try {
        const freshGame =
          await fetchLiveGame(
            seedGame,
          )

        if (!cancelled) {
          setPopupGame(
            freshGame,
          )
        }
      } catch (error) {
        console.error(
          'Popup refresh failed',
          error,
        )
      }
    }

    refreshPopupGame()

    const refreshTimer =
      window.setInterval(
        refreshPopupGame,
        3000,
      )

    return () => {
      cancelled = true

      window.clearInterval(
        refreshTimer,
      )
    }
  }, [
    popupMode,
    popupGame?.id,
    popupGame?.league,
  ])

  useEffect(() => {
    if (popupMode) return

    localStorage.setItem(
      'sportsTickerFavorites',
      JSON.stringify(
        favorites,
      ),
    )
  }, [
    favorites,
    popupMode,
  ])

  useEffect(() => {
    if (popupMode) return

    const timer =
      window.setInterval(
        () =>
          setNow(
            new Date(),
          ),
        1000,
      )

    return () =>
      window.clearInterval(
        timer,
      )
  }, [popupMode])

  useEffect(() => {
    if (popupMode) return

    let active = true

    async function loadDirectory() {
      const results =
        await Promise.all(
          LEAGUE_ORDER.map(
            fetchLeagueTeams,
          ),
        )

      if (!active) return

      const unique =
        [
          ...new Map(
            results
              .flat()
              .map(
                (team) => [
                  `${team.league}-${team.code}`,
                  team,
                ],
              ),
          ).values(),
        ]

      unique.sort(
        (a, b) =>
          a.name.localeCompare(
            b.name,
          ),
      )

      setTeamDirectory(
        unique,
      )
    }

    loadDirectory()

    return () => {
      active = false
    }
  }, [popupMode])

  useEffect(() => {
    if (
      popupMode ||
      view !== 'PLAYOFFS'
    ) {
      return
    }

    let active = true

    async function loadPlayoffs() {
      try {
        setPlayoffLoading(true)

        const year =
          new Date().getFullYear()

        const results =
          await Promise.allSettled(
            LEAGUE_ORDER.map(
              async (league) => ({
                league,
                games:
                  await fetchPostseasonGames(
                    league,
                    year,
                  ),
              }),
            ),
          )

        if (!active) return

        const next: Record<
          LeagueKey,
          Game[]
        > = {
          NHL: [],
          NFL: [],
          NBA: [],
          MLB: [],
        }

        for (const result of results) {
          if (
            result.status ===
            'fulfilled'
          ) {
            const postseasonGames =
              result.value.games

            next[result.value.league] =
              postseasonIsActiveNow(
                postseasonGames,
                new Date(),
              )
                ? postseasonGames
                : []
          }
        }

        setPlayoffGamesByLeague(next)
      } catch (err) {
        console.error(
          'Playoff bracket load failed',
          err,
        )
      } finally {
        if (active) {
          setPlayoffLoading(false)
        }
      }
    }

    loadPlayoffs()

    const timer =
      window.setInterval(
        loadPlayoffs,
        60000,
      )

    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [view, popupMode])

  useEffect(() => {
    if (popupMode) return

    let active = true

    async function loadSports() {
      try {
        setLoading(true)
        setError(null)

        const displayDate =
          new Date(selectedDate)

        const dailyLeagues: LeagueKey[] = [
          'NHL',
          'NBA',
          'MLB',
        ]

        const results =
          await Promise.allSettled(
            dailyLeagues.map(
              async (
                league,
              ) => ({
                league,
                games:
                  await fetchGames(
                    league,
                    displayDate,
                  ),
              }),
            ),
          )

        // NFL is intentionally independent of the date selector above.
        // It always loads the full selected NFL week. If no week has
        // been selected yet, ESPN resolves the current real-world week.
        const nflWeek =
          await fetchNFLWeekGames(
            selectedNFLWeek,
          ).catch(
            (): NflWeekData => ({
              games: [],
            }),
          )

        if (!active) return

        const next: Record<
          LeagueKey,
          Game[]
        > = {
          NHL: [],
          NFL: [],
          NBA: [],
          MLB: [],
        }

        for (const result of results) {
          if (
            result.status ===
            'fulfilled'
          ) {
            next[
              result.value
                .league
            ] =
              result.value.games
          }
        }

        next.NFL = nflWeek.games

        setGamesByLeague(next)

        setNflWeekGames(
          nflWeek.games,
        )

        setNflWeekNumber(
          nflWeek.week,
        )

        if (
          selectedNFLWeek === undefined &&
          nflWeek.week
        ) {
          setSelectedNFLWeek(
            nflWeek.week,
          )
        }

        setLoading(false)
      } catch (err) {
        console.error(err)

        if (!active) return

        setError(
          'Live sports data could not be loaded.',
        )

        setLoading(false)
      }
    }

    loadSports()

    const refresh =
      window.setInterval(
        loadSports,
        60000,
      )

    return () => {
      active = false
      window.clearInterval(
        refresh,
      )
    }
  }, [
    popupMode,
    selectedDate,
    selectedNFLWeek,
  ])

  useEffect(() => {
    if (popupMode) return

    const fallback: SearchTeam[] =
      LEAGUE_ORDER.flatMap(
        (league) =>
          gamesByLeague[
            league
          ].flatMap(
            (game) => [
              {
                id:
                  game.away.id,
                league,
                code:
                  game.away.code,
                name:
                  game.away
                    .displayName,
                logo:
                  game.away.logo,
              },

              {
                id:
                  game.home.id,
                league,
                code:
                  game.home.code,
                name:
                  game.home
                    .displayName,
                logo:
                  game.home.logo,
              },
            ],
          ),
      )

    setTeamDirectory(
      (current) => {
        const map =
          new Map<
            string,
            SearchTeam
          >()

        for (const team of [
          ...current,
          ...fallback,
        ]) {
          map.set(
            `${team.league}-${team.code}`,
            team,
          )
        }

        return [
          ...map.values(),
        ].sort(
          (a, b) =>
            a.name.localeCompare(
              b.name,
            ),
        )
      },
    )
  }, [
    gamesByLeague,
    popupMode,
  ])

  useEffect(() => {
    if (popupMode) return

    let cancelled = false

    async function findFavoriteGames() {
      const found =
        new Map<
          string,
          Game
        >()

      for (const league of LEAGUE_ORDER) {
        for (const favorite of favorites) {
          if (
            favorite.league !==
            league
          ) {
            continue
          }

          const game =
            gamesByLeague[
              league
            ].find(
              (candidate) =>
                candidate.away
                  .code ===
                  favorite.code ||
                candidate.home
                  .code ===
                  favorite.code,
            )

          if (game) {
            found.set(
              `${favorite.league}-${favorite.code}`,
              game,
            )
          }
        }
      }

      for (
        let offset = 1;
        offset <= 7;
        offset++
      ) {
        const missing =
          favorites.filter(
            (favorite) =>
              !found.has(
                `${favorite.league}-${favorite.code}`,
              ),
          )

        if (!missing.length) {
          break
        }

        const needed: LeagueKey[] =
          [
            ...new Set(
              missing.map(
                (favorite) =>
                  favorite.league,
              ),
            ),
          ] as LeagueKey[]

        const date =
          addDays(
            new Date(),
            offset,
          )

        const results =
          await Promise.allSettled(
            needed.map(
              async (
                league,
              ) => ({
                league,
                games:
                  await fetchGames(
                    league,
                    date,
                  ),
              }),
            ),
          )

        for (const result of results) {
          if (
            result.status !==
            'fulfilled'
          ) {
            continue
          }

          for (const favorite of missing) {
            if (
              favorite.league !==
              result.value
                .league
            ) {
              continue
            }

            const game =
              result.value.games.find(
                (candidate) =>
                  candidate.away
                    .code ===
                    favorite.code ||
                  candidate.home
                    .code ===
                    favorite.code,
              )

            if (game) {
              found.set(
                `${favorite.league}-${favorite.code}`,
                game,
              )
            }
          }
        }
      }

      if (cancelled) return

      const unique =
        [
          ...new Map(
            [
              ...found.values(),
            ].map(
              (game) => [
                `${game.league}-${game.id}`,
                game,
              ],
            ),
          ).values(),
        ]

      unique.sort(
        (a, b) =>
          new Date(
            a.date,
          ).getTime() -
          new Date(
            b.date,
          ).getTime(),
      )

      setFavoriteGames(
        unique,
      )
    }

    findFavoriteGames()

    return () => {
      cancelled = true
    }
  }, [
    gamesByLeague,
    favorites,
    popupMode,
  ])

  function pauseAutoScroll(
    duration = 10000,
  ) {
    pausedRef.current =
      true

    if (
      resumeTimerRef.current
    ) {
      window.clearTimeout(
        resumeTimerRef.current,
      )
    }

    resumeTimerRef.current =
      window.setTimeout(
        () => {
          pausedRef.current =
            false
        },
        duration,
      )
  }

  useEffect(() => {
    if (popupMode) return

    let frame = 0
    let lastTime = 0
    let bottomReachedAt = 0
    const pixelsPerSecond = 7

    const tick = (time: number) => {
      const feed =
        feedRef.current

      if (
        feed &&
        !pausedRef.current &&
        view !== 'FAVORITES' &&
        view !== 'PLAYOFFS' &&
        feed.scrollHeight >
          feed.clientHeight + 2
      ) {
        if (!lastTime) {
          lastTime = time
        }

        const elapsed =
          Math.min(
            time - lastTime,
            100,
          )

        const atBottom =
          feed.scrollTop +
            feed.clientHeight >=
          feed.scrollHeight - 2

        if (atBottom) {
          if (!bottomReachedAt) {
            bottomReachedAt = time
          }

          if (
            time -
              bottomReachedAt >=
            900
          ) {
            feed.scrollTop = 0
            bottomReachedAt = 0
          }
        } else {
          bottomReachedAt = 0
          feed.scrollTop +=
            (pixelsPerSecond *
              elapsed) /
            1000
        }

        lastTime = time
      } else {
        lastTime = time
        bottomReachedAt = 0
      }

      frame =
        window.requestAnimationFrame(
          tick,
        )
    }

    frame =
      window.requestAnimationFrame(
        tick,
      )

    return () =>
      window.cancelAnimationFrame(
        frame,
      )
  }, [
    view,
    popupMode,
    selectedDate,
  ])

  const sortedGames =
    useMemo(() => {
      const result: Record<
        LeagueKey,
        Game[]
      > = {
        NHL: [],
        NFL: [],
        NBA: [],
        MLB: [],
      }

      for (const league of LEAGUE_ORDER) {
        result[league] =
          [
            ...gamesByLeague[
              league
            ],
          ].sort(
            (a, b) =>
              new Date(
                a.date,
              ).getTime() -
              new Date(
                b.date,
              ).getTime(),
          )
      }

      return result
    }, [gamesByLeague])

  const nflDisplayGames =
    useMemo(
      () =>
        [
          ...nflWeekGames,
        ].sort(
          (a, b) =>
            new Date(
              a.date,
            ).getTime() -
            new Date(
              b.date,
            ).getTime(),
        ),
      [nflWeekGames],
    )

  const todaysFinals =
    useMemo(
      () =>
        LEAGUE_ORDER.flatMap(
          (league) =>
            gamesByLeague[
              league
            ].filter(
              (game) =>
                game.statusState ===
                'post',
            ),
        ),
      [gamesByLeague],
    )

  const activeGames =
    useMemo(() => {
      const result: Record<
        LeagueKey,
        Game[]
      > = {
        NHL: [],
        NFL: [],
        NBA: [],
        MLB: [],
      }

      for (const league of LEAGUE_ORDER) {
        result[league] =
          sortedGames[
            league
          ].filter(
            (game) =>
              game.statusState !==
              'post',
          )
      }

      return result
    }, [sortedGames])

  const favoriteTeamDetails =
    useMemo(() => {
      return favorites.map(
        (favorite) => {
          const team =
            teamDirectory.find(
              (candidate) =>
                candidate.league ===
                  favorite.league &&
                candidate.code ===
                  favorite.code,
            )

          return {
            ...favorite,
            name:
              team?.name ||
              favorite.code,
            logo:
              team?.logo,
          }
        },
      )
    }, [
      favorites,
      teamDirectory,
    ])

  const teamSearchResults =
    useMemo(() => {
      const query =
        teamSearch
          .trim()
          .toLowerCase()

      if (!query) {
        return []
      }

      return teamDirectory
        .filter(
          (team) => {
            const saved =
              favorites.some(
                (favorite) =>
                  favorite.league ===
                    team.league &&
                  favorite.code ===
                    team.code,
              )

            if (saved) {
              return false
            }

            return (
              team.name
                .toLowerCase()
                .includes(query) ||
              team.code
                .toLowerCase()
                .includes(query) ||
              team.league
                .toLowerCase()
                .includes(query)
            )
          },
        )
        .slice(0, 12)
    }, [
      teamSearch,
      teamDirectory,
      favorites,
    ])

  function openGamePopup(
    game: Game,
  ) {
    const popupWidth =
      500

    const popupHeight =
      Math.max(
        700,
        window.outerHeight,
      )

    const left =
      window.screenX -
      popupWidth -
      12

    const top =
      window.screenY

    const serializedGame =
      encodeURIComponent(
        JSON.stringify(game),
      )

    const url =
      `${window.location.origin}${window.location.pathname}` +
      `?popup=1&data=${serializedGame}`

    const popup =
      window.open(
        url,
        '_blank',
        [
          'popup=yes',
          `width=${popupWidth}`,
          `height=${popupHeight}`,
          `left=${left}`,
          `top=${top}`,
          'resizable=yes',
          'scrollbars=yes',
        ].join(','),
      )

    if (popup) {
      try {
        popup.moveTo(
          left,
          top,
        )
        popup.resizeTo(
          popupWidth,
          popupHeight,
        )
      } catch {
        // Browser may ignore explicit positioning.
      }

      popup.focus()
    }

    pauseAutoScroll()
  }

  function changeNFLWeek(
    amount: number,
  ) {
    const baseWeek =
      selectedNFLWeek ??
      nflWeekNumber ??
      1

    const nextWeek =
      Math.max(
        1,
        Math.min(
          22,
          baseWeek + amount,
        ),
      )

    setSelectedNFLWeek(
      nextWeek,
    )

    if (feedRef.current) {
      feedRef.current.scrollTop = 0
    }

    pauseAutoScroll(1500)
  }

  function changeView(
    nextView: ViewKey,
  ) {
    setView(nextView)

    if (feedRef.current) {
      feedRef.current.scrollTop =
        0
    }

    pauseAutoScroll(
      1500,
    )
  }

  function addFavorite(
    team: SearchTeam,
  ) {
    setFavorites(
      (current) => [
        ...current,
        {
          league:
            team.league,
          code:
            team.code,
        },
      ],
    )

    setTeamSearch('')
  }

  function removeFavorite(
    favorite: FavoriteRef,
  ) {
    setFavorites(
      (current) =>
        current.filter(
          (item) =>
            !(
              item.league ===
                favorite.league &&
              item.code ===
                favorite.code
            ),
        ),
    )
  }

  function moveDate(
    amount: number,
  ) {
    setSelectedDate(
      (current) =>
        addDays(
          current,
          amount,
        ),
    )

    if (feedRef.current) {
      feedRef.current.scrollTop = 0
    }

    pauseAutoScroll(1500)
  }

  function returnToToday() {
    setSelectedDate(
      new Date(),
    )

    if (feedRef.current) {
      feedRef.current.scrollTop = 0
    }

    pauseAutoScroll(1500)
  }

  const isToday =
    selectedDate.toDateString() ===
    new Date().toDateString()

  if (popupMode) {
    return (
      <main className="popupScreen">
        {popupGame ? (
          <GameDetail
            game={popupGame}
            popup
          />
        ) : (
          <div className="popupMissing">
            Game data unavailable.
          </div>
        )}
      </main>
    )
  }

  const dateDisplay =
    selectedDate
      .toLocaleDateString(
        [],
        {
          month: 'long',
          day: 'numeric',
        },
      )
      .toUpperCase()

  const weekday =
    selectedDate
      .toLocaleDateString(
        [],
        {
          weekday: 'long',
        },
      )
      .toUpperCase()

  const timeText =
    now.toLocaleTimeString(
      [],
      {
        hour: 'numeric',
        minute: '2-digit',
      },
    )

  const timeDigits =
    timeText.replace(
      /\s?(AM|PM)$/i,
      '',
    )

  const meridiem =
    timeText.match(
      /(AM|PM)/i,
    )?.[0]
      ?.toUpperCase() ||
    ''

  const seconds =
    String(
      now.getSeconds(),
    ).padStart(2, '0')

  return (
    <main className="screen">
      <aside className="ticker">
        <header className="clockStage">
          <div className="clockDate">
            <span>
              {getTimePeriod(
                now,
              )}
            </span>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns:
                  '34px 1fr 34px',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <button
                type="button"
                aria-label="Previous day"
                onClick={() =>
                  moveDate(-1)
                }
                style={{
                  border: 0,
                  background: 'transparent',
                  color: 'rgba(255,255,255,.55)',
                  fontSize: 24,
                  lineHeight: 1,
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                ‹
              </button>

              <strong>
                {weekday}
                <i> · </i>
                {dateDisplay}
              </strong>

              <button
                type="button"
                aria-label="Next day"
                onClick={() =>
                  moveDate(1)
                }
                style={{
                  border: 0,
                  background: 'transparent',
                  color: 'rgba(255,255,255,.55)',
                  fontSize: 24,
                  lineHeight: 1,
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                ›
              </button>
            </div>

            {!isToday && (
              <button
                type="button"
                onClick={returnToToday}
                style={{
                  marginTop: 5,
                  border: 0,
                  background: 'transparent',
                  color: 'rgba(255,255,255,.28)',
                  fontSize: 7,
                  fontWeight: 900,
                  letterSpacing: '.15em',
                  cursor: 'pointer',
                }}
              >
                RETURN TO TODAY
              </button>
            )}
          </div>

          <div className="clockMain">
            <div className="clockDigits">
              {timeDigits}
            </div>

            <div className="clockSide">
              <strong>
                {meridiem}
              </strong>

              <span>
                {seconds}
              </span>
            </div>
          </div>

          <div className="clockFooter">
            <div className="liveStatus">
              <span
                className={
                  error
                    ? 'livePulse error'
                    : 'livePulse'
                }
              />

              {loading
                ? 'SYNCING'
                : error
                  ? 'OFFLINE'
                  : 'LIVE SPORTS'}
            </div>

            <span>
              AUTO TICKER
            </span>
          </div>
        </header>

        <nav className="tickerTabs">
          {(
            [
              'ALL',
              'NHL',
              'NFL',
              'NBA',
              'MLB',
            ] as ViewKey[]
          ).map(
            (tab) => (
              <button
                type="button"
                key={tab}
                className={`tab tab-${tab.toLowerCase()} ${
                  view === tab
                    ? 'active'
                    : ''
                }`}
                onClick={() =>
                  changeView(
                    tab,
                  )
                }
              >
                {tab}
              </button>
            ),
          )}

          <button
            type="button"
            className={`tab teamsTab ${
              view ===
              'FAVORITES'
                ? 'active'
                : ''
            }`}
            onClick={() =>
              changeView(
                'FAVORITES',
              )
            }
            aria-label="Favorites"
            title="Favorites"
          >
            ★
          </button>

          <button
            type="button"
            className={`tab playoffsTab ${
              view === 'PLAYOFFS'
                ? 'active'
                : ''
            }`}
            onClick={() => {
              setSelectedPlayoffLeague(null)
              changeView('PLAYOFFS')
            }}
            aria-label="Playoff brackets"
            title="Playoff brackets"
          >
            <svg
              className="bracketIcon"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path d="M3 3h4v6H3M3 15h4v6H3M7 6h4v6M7 18h4v-6M11 12h5M16 9v6h5" />
            </svg>
          </button>
        </nav>

        {view === 'NFL' && (
          <div className="nflWeekHero">
            <button
              type="button"
              className="nflWeekArrow nflWeekArrowLeft"
              aria-label="Previous NFL week"
              onClick={() =>
                changeNFLWeek(-1)
              }
            >
              ‹
            </button>

            <div className="nflWeekTitle">
              <span>NFL</span>

              <strong>
                {`WEEK ${
                  selectedNFLWeek ??
                  nflWeekNumber ??
                  nflDisplayGames[0]?.week ??
                  '—'
                }`}
              </strong>

              <em>
                {nflDisplayGames.length}{' '}
                {nflDisplayGames.length === 1
                  ? 'GAME'
                  : 'GAMES'}
              </em>

              <button
                type="button"
                className={`nflFantasyToggle ${
                  nflFantasyMode
                    ? 'active'
                    : ''
                }`}
                onClick={() =>
                  setNflFantasyMode(
                    (current) => !current,
                  )
                }
              >
                {nflFantasyMode
                  ? '← GAMES'
                  : 'FANTASY'}
              </button>
            </div>

            <button
              type="button"
              className="nflWeekArrow nflWeekArrowRight"
              aria-label="Next NFL week"
              onClick={() =>
                changeNFLWeek(1)
              }
            >
              ›
            </button>
          </div>
        )}

        <section
          className="feed"
          ref={feedRef}
          onWheel={() =>
            pauseAutoScroll()
          }
          onPointerDown={() =>
            pauseAutoScroll()
          }
          onTouchStart={() =>
            pauseAutoScroll()
          }
        >
          {error && (
            <div className="dataError">
              {error}
            </div>
          )}

          {view === 'ALL' && (
            <>
              <LeagueSection
                league="NHL"
                games={
                  activeGames.NHL
                }
                onSelect={
                  openGamePopup
                }
              />

              <LeagueSection
                league="NFL"
                games={
                  activeGames.NFL
                }
                label={`${activeGames.NFL.length} ${
                  activeGames.NFL.length === 1
                    ? 'GAME'
                    : 'GAMES'
                }`}
                onSelect={
                  openGamePopup
                }
              />

              <LeagueSection
                league="NBA"
                games={
                  activeGames.NBA
                }
                onSelect={
                  openGamePopup
                }
              />

              <LeagueSection
                league="MLB"
                games={
                  activeGames.MLB
                }
                onSelect={
                  openGamePopup
                }
              />

              {todaysFinals.length >
                0 && (
                <section className="finalsBlock">
                  <div className="finalsHeader">
                    FINAL SCORES
                  </div>

                  {todaysFinals.map(
                    (game) => (
                      <GameRow
                        key={`final-${game.league}-${game.id}`}
                        game={game}
                        onSelect={
                          openGamePopup
                        }
                      />
                    ),
                  )}
                </section>
              )}

            </>
          )}

          {view === 'NHL' && (
            <LeagueSection
              league="NHL"
              games={
                sortedGames.NHL
              }
              onSelect={
                openGamePopup
              }
            />
          )}

          {view === 'NFL' && (
            nflFantasyMode ? (
              <NFLFantasyView
                week={
                  selectedNFLWeek ??
                  nflWeekNumber ??
                  1
                }
              />
            ) : (
              <LeagueSection
                league="NFL"
                games={
                  nflDisplayGames
                }
                label={`${nflDisplayGames.length} ${
                  nflDisplayGames.length === 1
                    ? 'GAME'
                    : 'GAMES'
                }`}
                onSelect={
                  openGamePopup
                }
              />
            )
          )}

          {view === 'NBA' && (
            <LeagueSection
              league="NBA"
              games={
                sortedGames.NBA
              }
              onSelect={
                openGamePopup
              }
            />
          )}

          {view === 'MLB' && (
            <LeagueSection
              league="MLB"
              games={
                sortedGames.MLB
              }
              onSelect={
                openGamePopup
              }
            />
          )}

          {view === 'PLAYOFFS' && (
            <PlayoffsHub
              gamesByLeague={
                playoffGamesByLeague
              }
              loading={
                playoffLoading
              }
              selectedLeague={
                selectedPlayoffLeague
              }
              onSelectLeague={
                setSelectedPlayoffLeague
              }
              onSelectGame={
                openGamePopup
              }
            />
          )}

          {view ===
            'FAVORITES' && (
            <section className="favoritesView">
              <div className="favoritesTitle">
                <div>
                  <span>
                    MY TEAMS
                  </span>

                  <strong>
                    PERSONAL TICKER
                  </strong>
                </div>

                <em>
                  {
                    favorites.length
                  }{' '}
                  SAVED
                </em>
              </div>

              <div className="favoriteManager">
                <div className="favoriteChips">
                  {favoriteTeamDetails.map(
                    (team) => (
                      <div
                        key={`${team.league}-${team.code}`}
                        className={`favoriteChip favoriteChip-${team.league.toLowerCase()}`}
                      >
                        <TeamLogo
                          team={{
                            code:
                              team.code,
                            name:
                              team.name,
                            logo:
                              team.logo,
                          }}
                        />

                        <div>
                          <strong>
                            {
                              team.code
                            }
                          </strong>

                          <span>
                            {
                              team.league
                            }
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            removeFavorite(
                              team,
                            )
                          }
                        >
                          ×
                        </button>
                      </div>
                    ),
                  )}
                </div>

                <div className="teamSearchBox">
                  <span>+</span>

                  <input
                    value={
                      teamSearch
                    }
                    onChange={(
                      event,
                    ) =>
                      setTeamSearch(
                        event
                          .target
                          .value,
                      )
                    }
                    placeholder="Search any team..."
                  />
                </div>

                {teamSearchResults.length >
                  0 && (
                  <div className="teamSearchResults">
                    {teamSearchResults.map(
                      (team) => (
                        <button
                          type="button"
                          key={`${team.league}-${team.code}`}
                          onClick={() =>
                            addFavorite(
                              team,
                            )
                          }
                        >
                          <TeamLogo
                            team={team}
                          />

                          <div>
                            <strong>
                              {
                                team.name
                              }
                            </strong>

                            <span>
                              {
                                team.league
                              }{' '}
                              ·{' '}
                              {
                                team.code
                              }
                            </span>
                          </div>

                          <em>
                            ADD
                          </em>
                        </button>
                      ),
                    )}
                  </div>
                )}
              </div>

              <div className="favoriteNextLabel">
                NEXT GAMES
              </div>

              {favoriteGames.map(
                (game) => (
                  <button
                    type="button"
                    key={`${game.league}-${game.id}`}
                    className={`favoriteGameRow favorite-${game.league.toLowerCase()}`}
                    onClick={() =>
                      openGamePopup(
                        game,
                      )
                    }
                  >
                    <div className="favoriteLeague">
                      {
                        game.league
                      }
                    </div>

                    <div className="favoriteMatchup">
                      <div>
                        <TeamLogo
                          team={
                            game.away
                          }
                        />

                        <strong>
                          {
                            game.away
                              .code
                          }
                        </strong>
                      </div>

                      <span>
                        {formatFavoriteDate(
                          game.date,
                        )}
                      </span>

                      <div>
                        <strong>
                          {
                            game.home
                              .code
                          }
                        </strong>

                        <TeamLogo
                          team={
                            game.home
                          }
                        />
                      </div>
                    </div>

                  </button>
                ),
              )}
            </section>
          )}
        </section>
      </aside>
    </main>
  )
}

export default App
