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
  record?: string
  score?: string
  standing?: StandingInfo
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

const LEAGUES: Record<
  LeagueKey,
  {
    sport: string
    slug: string
  }
> = {
  NHL: {
    sport: 'hockey',
    slug: 'nhl',
  },

  NFL: {
    sport: 'football',
    slug: 'nfl',
  },

  NBA: {
    sport: 'basketball',
    slug: 'nba',
  },

  MLB: {
    sport: 'baseball',
    slug: 'mlb',
  },
}

const LEAGUE_ORDER: LeagueKey[] = [
  'NHL',
  'NFL',
  'NBA',
  'MLB',
]

const DEFAULT_FAVORITES: FavoriteRef[] = [
  {
    league: 'NHL',
    code: 'STL',
  },
  {
    league: 'NHL',
    code: 'MIN',
  },
  {
    league: 'NFL',
    code: 'MIN',
  },
  {
    league: 'NBA',
    code: 'MIN',
  },
  {
    league: 'MLB',
    code: 'STL',
  },
]

const standingsCache = new Map<
  LeagueKey,
  Promise<Map<string, StandingInfo>>
>()

const oddsCache = new Map<
  string,
  {
    updated: number
    odds?: OddsInfo
  }
>()

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

function formatFavoriteDate(
  iso: string,
) {
  const date = new Date(iso)

  const today = new Date()

  const tomorrow = addDays(
    today,
    1,
  )

  if (
    date.toDateString() ===
    today.toDateString()
  ) {
    return `TONIGHT · ${formatGameTime(
      iso,
    )}`
  }

  if (
    date.toDateString() ===
    tomorrow.toDateString()
  ) {
    return `TOMORROW · ${formatGameTime(
      iso,
    )}`
  }

  const weekday = date
    .toLocaleDateString([], {
      weekday: 'short',
    })
    .toUpperCase()

  return `${weekday} · ${formatGameTime(
    iso,
  )}`
}

function getTimePeriod(
  date: Date,
) {
  const hour = date.getHours()

  if (hour < 5) {
    return 'LATE NIGHT'
  }

  if (hour < 12) {
    return 'MORNING'
  }

  if (hour < 17) {
    return 'AFTERNOON'
  }

  if (hour < 21) {
    return 'EVENING'
  }

  return 'NIGHT'
}

function formatPrice(
  value: unknown,
): string | undefined {
  if (
    value === undefined ||
    value === null ||
    value === ''
  ) {
    return undefined
  }

  const numberValue = Number(
    value,
  )

  if (
    !Number.isNaN(numberValue)
  ) {
    if (numberValue > 0) {
      return `+${numberValue}`
    }

    return `${numberValue}`
  }

  return String(value)
}

function formatSpread(
  value: number,
) {
  if (value > 0) {
    return `+${value}`
  }

  return `${value}`
}

async function fetchJson(
  url: string,
) {
  const response = await fetch(
    url,
  )

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
        item.abbreviation ===
          name,
    )

    if (
      stat?.value !== undefined
    ) {
      return Number(
        stat.value,
      )
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
): Promise<
  Map<string, StandingInfo>
> {
  if (
    standingsCache.has(
      league,
    )
  ) {
    return standingsCache.get(
      league,
    )!
  }

  const promise =
    (async () => {
      const config =
        LEAGUES[league]

      const url =
        `https://site.api.espn.com/apis/v2/sports/` +
        `${config.sport}/${config.slug}/standings`

      try {
        const data =
          await fetchJson(url)

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
                [
                  'points',
                  'PTS',
                ],
              ) ?? 0
            )
          }

          return (
            getStatValue(
              item.entry,
              [
                'winPercent',
                'PCT',
              ],
            ) ?? 0
          )
        }

        const globallySorted =
          [...entries].sort(
            (a, b) =>
              scoreForEntry(
                b,
              ) -
              scoreForEntry(
                a,
              ),
          )

        const map =
          new Map<
            string,
            StandingInfo
          >()

        for (const item of entries) {
          const leagueRank =
            globallySorted.findIndex(
              (
                candidate,
              ) =>
                candidate.code ===
                item.code,
            ) + 1

          const sameDivision =
            entries
              .filter(
                (
                  candidate,
                ) =>
                  candidate.group ===
                  item.group,
              )
              .sort(
                (
                  a,
                  b,
                ) =>
                  scoreForEntry(
                    b,
                  ) -
                  scoreForEntry(
                    a,
                  ),
              )

          const divisionRank =
            sameDivision.findIndex(
              (
                candidate,
              ) =>
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
      standingMap.get(
        code,
      ),
  }
}

function normalizeOdds(
  item: any,
  awayCode: string,
  homeCode: string,
): OddsInfo | undefined {
  if (!item) {
    return undefined
  }

  const awayOdds =
    item?.awayTeamOdds || {}

  const homeOdds =
    item?.homeTeamOdds || {}

  let awaySpread:
    | string
    | undefined

  let homeSpread:
    | string
    | undefined

  if (
    awayOdds?.spread !==
      undefined &&
    awayOdds?.spread !==
      null
  ) {
    const value = Number(
      awayOdds.spread,
    )

    if (
      !Number.isNaN(value)
    ) {
      awaySpread =
        formatSpread(value)
    }
  }

  if (
    homeOdds?.spread !==
      undefined &&
    homeOdds?.spread !==
      null
  ) {
    const value = Number(
      homeOdds.spread,
    )

    if (
      !Number.isNaN(value)
    ) {
      homeSpread =
        formatSpread(value)
    }
  }

  if (
    (!awaySpread ||
      !homeSpread) &&
    item?.details
  ) {
    const match = String(
      item.details,
    )
      .trim()
      .match(
        /^([A-Z0-9]+)\s+([+-]?\d+(?:\.\d+)?)/i,
      )

    if (match) {
      const favoriteCode =
        match[1].toUpperCase()

      const favoriteSpread =
        Number(match[2])

      if (
        !Number.isNaN(
          favoriteSpread,
        )
      ) {
        if (
          favoriteCode ===
          awayCode
        ) {
          awaySpread =
            formatSpread(
              favoriteSpread,
            )

          homeSpread =
            formatSpread(
              -favoriteSpread,
            )
        }

        if (
          favoriteCode ===
          homeCode
        ) {
          homeSpread =
            formatSpread(
              favoriteSpread,
            )

          awaySpread =
            formatSpread(
              -favoriteSpread,
            )
        }
      }
    }
  }

  if (
    (!awaySpread ||
      !homeSpread) &&
    item?.spread !==
      undefined
  ) {
    const spreadValue =
      Math.abs(
        Number(item.spread),
      )

    if (
      !Number.isNaN(
        spreadValue,
      )
    ) {
      if (
        awayOdds?.favorite ===
        true
      ) {
        awaySpread =
          formatSpread(
            -spreadValue,
          )

        homeSpread =
          formatSpread(
            spreadValue,
          )
      }

      if (
        homeOdds?.favorite ===
        true
      ) {
        homeSpread =
          formatSpread(
            -spreadValue,
          )

        awaySpread =
          formatSpread(
            spreadValue,
          )
      }
    }
  }

  return {
    provider:
      item?.provider?.name ||
      undefined,

    awaySpread,

    awaySpreadOdds:
      formatPrice(
        awayOdds?.spreadOdds ??
          awayOdds?.spreadPrice,
      ),

    homeSpread,

    homeSpreadOdds:
      formatPrice(
        homeOdds?.spreadOdds ??
          homeOdds?.spreadPrice,
      ),

    total:
      item?.overUnder !==
      undefined
        ? String(
            item.overUnder,
          )
        : undefined,

    overOdds:
      formatPrice(
        item?.overOdds ??
          item?.overPrice,
      ),

    underOdds:
      formatPrice(
        item?.underOdds ??
          item?.underPrice,
      ),

    awayMoneyline:
      formatPrice(
        awayOdds?.moneyLine,
      ),

    homeMoneyline:
      formatPrice(
        homeOdds?.moneyLine,
      ),
  }
}

function chooseOddsItem(
  items: any[],
) {
  if (!items.length) {
    return undefined
  }

  const preferredIds = [
    '68',
    '41',
    '37',
    '58',
    '38',
  ]

  for (
    const id of
    preferredIds
  ) {
    const result =
      items.find(
        (item) =>
          String(
            item?.provider?.id,
          ) === id,
      )

    if (result) {
      return result
    }
  }

  return items[0]
}

async function fetchGameOdds(
  league: LeagueKey,
  eventId: string,
  competitionId: string,
  awayCode: string,
  homeCode: string,
  fallback?: any,
): Promise<
  OddsInfo | undefined
> {
  const cacheKey =
    `${league}-${eventId}`

  const cached =
    oddsCache.get(
      cacheKey,
    )

  if (
    cached &&
    Date.now() -
      cached.updated <
      120000
  ) {
    return cached.odds
  }

  const config =
    LEAGUES[league]

  try {
    const url =
      `https://sports.core.api.espn.com/v2/sports/` +
      `${config.sport}/leagues/${config.slug}/events/` +
      `${eventId}/competitions/${competitionId}/odds?limit=20`

    const data =
      await fetchJson(url)

    const items =
      Array.isArray(
        data?.items,
      )
        ? data.items
        : []

    const picked =
      chooseOddsItem(
        items,
      )

    const odds =
      normalizeOdds(
        picked ||
          fallback,
        awayCode,
        homeCode,
      )

    oddsCache.set(
      cacheKey,
      {
        updated:
          Date.now(),
        odds,
      },
    )

    return odds
  } catch {
    const odds =
      normalizeOdds(
        fallback,
        awayCode,
        homeCode,
      )

    oddsCache.set(
      cacheKey,
      {
        updated:
          Date.now(),
        odds,
      },
    )

    return odds
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
            (
              item: any,
            ) =>
              item.homeAway ===
              'away',
          )

        const homeRaw =
          competitors.find(
            (
              item: any,
            ) =>
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
              (
                broadcast: any,
              ) =>
                broadcast
                  ?.names || [],
            )
            .filter(Boolean)
            .join(' · ')

        const state =
          event?.status?.type
            ?.state ||
          'pre'

        const link =
          event?.links?.find(
            (
              item: any,
            ) =>
              item?.rel?.includes(
                'summary',
              ),
          )?.href ||
          event?.links?.[0]
            ?.href ||
          undefined

        const fallbackOdds =
          competition
            ?.odds?.[0]

        const odds =
          await fetchGameOdds(
            league,
            String(event.id),
            competitionId,
            away.code,
            home.code,
            fallbackOdds,
          )

        return {
          id: String(
            event.id,
          ),

          competitionId,

          league,

          date: event.date,

          week:
            event?.week
              ?.number ??
            competition?.week
              ?.number ??
            data?.week
              ?.number ??
            undefined,

          statusState:
            state,

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

          odds,

          link,
        }
      },
    ),
  )
}

async function fetchGames(
  league: LeagueKey,
  date: Date,
): Promise<Game[]> {
  const config =
    LEAGUES[league]

  const standings =
    await fetchStandings(
      league,
    )

  const url =
    `https://site.api.espn.com/apis/site/v2/sports/` +
    `${config.sport}/${config.slug}/scoreboard` +
    `?dates=${dateKey(
      date,
    )}&limit=100`

  const data =
    await fetchJson(url)

  return parseEvents(
    data,
    league,
    standings,
  )
}

async function fetchNFLWeekGames(): Promise<NflWeekData> {
  const standings =
    await fetchStandings(
      'NFL',
    )

  const data =
    await fetchJson(
      'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?limit=100',
    )

  const games =
    await parseEvents(
      data,
      'NFL',
      standings,
    )

  return {
    games,

    week:
      data?.week?.number ||
      games.find(
        (game) =>
          game.week,
      )?.week,
  }
}

/*
  FIXED TEAM DIRECTORY PARSER

  Some league responses wrap a team like:
  { team: { ... } }

  Others can expose the actual team object directly.

  This handles BOTH.
*/

async function fetchLeagueTeams(
  league: LeagueKey,
): Promise<SearchTeam[]> {
  const config =
    LEAGUES[league]

  try {
    const data =
      await fetchJson(
        `https://site.api.espn.com/apis/site/v2/sports/${config.sport}/${config.slug}/teams?limit=1000`,
      )

    const rawTeams =
      data?.sports?.[0]
        ?.leagues?.[0]
        ?.teams || []

    const parsed: SearchTeam[] = []

    for (
      const entry of rawTeams
    ) {
      const team =
        entry?.team ||
        entry ||
        {}

      const code =
        team
          ?.abbreviation
          ?.toUpperCase()

      if (!code) {
        continue
      }

      parsed.push({
        id: String(
          team.id ||
            code,
        ),

        league,

        code,

        name:
          team.displayName ||
          team.shortDisplayName ||
          team.name ||
          code,

        logo:
          team.logos?.[0]
            ?.href ||
          team.logo ||
          undefined,
      })
    }

    return parsed
  } catch (
    error
  ) {
    console.error(
      `Could not load ${league} teams`,
      error,
    )

    return []
  }
}

function ordinal(
  value?: number,
) {
  if (!value) {
    return ''
  }

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
    return (
      team.record || ''
    )
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
        )} ${
          standing.division
        }`
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

function OddsPanel({
  game,
  compact = false,
}: {
  game: Game
  compact?: boolean
}) {
  const odds =
    game.odds

  if (!odds) {
    return (
      <div
        className={`oddsUnavailable ${
          compact
            ? 'compact'
            : ''
        }`}
      >
        ODDS UNAVAILABLE
      </div>
    )
  }

  return (
    <div
      className={`oddsBoard ${
        compact
          ? 'compact'
          : ''
      }`}
    >
      <div className="oddsLine">
        <span className="oddsLabel">
          SPREAD
        </span>

        <span>
          {game.away.code}{' '}
          {odds.awaySpread ||
            '—'}

          <em>
            {odds.awaySpreadOdds
              ? `(${odds.awaySpreadOdds})`
              : '(—)'}
          </em>
        </span>

        <span>
          {game.home.code}{' '}
          {odds.homeSpread ||
            '—'}

          <em>
            {odds.homeSpreadOdds
              ? `(${odds.homeSpreadOdds})`
              : '(—)'}
          </em>
        </span>
      </div>

      <div className="oddsLine">
        <span className="oddsLabel">
          TOTAL
        </span>

        <span>
          O {odds.total || '—'}

          <em>
            {odds.overOdds
              ? `(${odds.overOdds})`
              : '(—)'}
          </em>
        </span>

        <span>
          U {odds.total || '—'}

          <em>
            {odds.underOdds
              ? `(${odds.underOdds})`
              : '(—)'}
          </em>
        </span>
      </div>

      <div className="oddsLine">
        <span className="oddsLabel">
          ML
        </span>

        <span>
          {game.away.code}

          <em>
            {odds.awayMoneyline ||
              '—'}
          </em>
        </span>

        <span>
          {game.home.code}

          <em>
            {odds.homeMoneyline ||
              '—'}
          </em>
        </span>
      </div>

      {!compact &&
        odds.provider && (
          <div className="oddsProvider">
            ODDS ·{' '}
            {odds.provider}
          </div>
        )}
    </div>
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

          <strong>
            {game.statusDetail}
          </strong>
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
            <div className="liveScore">
              <strong>
                {game.away.score}
              </strong>

              <span>—</span>

              <strong>
                {game.home.score}
              </strong>
            </div>
          ) : game.statusState ===
            'post' ? (
            <>
              <strong className="finalCenter">
                {game.away.score}{' '}
                —{' '}
                {game.home.score}
              </strong>

              <span>
                FINAL
              </span>
            </>
          ) : (
            <>
              <strong>
                {formatGameTime(
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

      {game.network && (
        <div className="networkLine">
          {game.network}
        </div>
      )}

      <OddsPanel
        game={game}
        compact
      />
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

    if (
      Array.isArray(parsed)
    ) {
      return parsed
    }
  } catch {
    // use defaults
  }

  return DEFAULT_FAVORITES
}

function App() {
  const [now, setNow] =
    useState(
      new Date(),
    )

  const [view, setView] =
    useState<ViewKey>(
      'ALL',
    )

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
    favorites,
    setFavorites,
  ] = useState<
    FavoriteRef[]
  >(
    loadSavedFavorites,
  )

  const [
    favoriteGames,
    setFavoriteGames,
  ] = useState<Game[]>([])

  const [
    teamDirectory,
    setTeamDirectory,
  ] = useState<
    SearchTeam[]
  >([])

  const [
    teamSearch,
    setTeamSearch,
  ] = useState('')

  const [
    morningFinals,
    setMorningFinals,
  ] = useState<Game[]>([])

  const [
    selectedGame,
    setSelectedGame,
  ] = useState<
    Game | null
  >(null)

  const [
    loading,
    setLoading,
  ] = useState(true)

  const [
    error,
    setError,
  ] = useState<
    string | null
  >(null)

  const feedRef =
    useRef<HTMLDivElement | null>(
      null,
    )

  const pausedRef =
    useRef(false)

  const resumeTimerRef =
    useRef<
      number | null
    >(null)

  useEffect(() => {
    localStorage.setItem(
      'sportsTickerFavorites',
      JSON.stringify(
        favorites,
      ),
    )
  }, [favorites])

  useEffect(() => {
    const timer =
      window.setInterval(
        () => {
          setNow(
            new Date(),
          )
        },
        1000,
      )

    return () =>
      window.clearInterval(
        timer,
      )
  }, [])

  /*
    Load all searchable teams.
  */

  useEffect(() => {
    let active = true

    async function loadDirectory() {
      const results =
        await Promise.all(
          LEAGUE_ORDER.map(
            fetchLeagueTeams,
          ),
        )

      if (!active) {
        return
      }

      const all =
        results.flat()

      const unique =
        [
          ...new Map(
            all.map(
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
  }, [])

  useEffect(() => {
    let active = true

    async function loadSports() {
      try {
        setLoading(true)
        setError(null)

        const today =
          new Date()

        const results =
          await Promise.allSettled(
            LEAGUE_ORDER.map(
              async (
                league,
              ) => ({
                league,

                games:
                  await fetchGames(
                    league,
                    today,
                  ),
              }),
            ),
          )

        const nflWeek =
          await fetchNFLWeekGames().catch(
            (): NflWeekData => ({
              games: [],
            }),
          )

        if (!active) {
          return
        }

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

        setGamesByLeague(
          next,
        )

        setNflWeekGames(
          nflWeek.games,
        )

        setNflWeekNumber(
          nflWeek.week,
        )

        if (
          today.getHours() <
          10
        ) {
          const yesterday =
            addDays(
              today,
              -1,
            )

          const previous =
            await Promise.allSettled(
              LEAGUE_ORDER.map(
                (
                  league,
                ) =>
                  fetchGames(
                    league,
                    yesterday,
                  ),
              ),
            )

          if (!active) {
            return
          }

          const finals =
            previous.flatMap(
              (
                result,
              ) =>
                result.status ===
                'fulfilled'
                  ? result.value.filter(
                      (
                        game,
                      ) =>
                        game.statusState ===
                        'post',
                    )
                  : [],
            )

          setMorningFinals(
            finals,
          )
        } else {
          setMorningFinals(
            [],
          )
        }

        setLoading(false)
      } catch (
        err
      ) {
        console.error(
          err,
        )

        if (!active) {
          return
        }

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
  }, [])

  /*
    FALLBACK DIRECTORY

    Even if a full team-directory request
    fails, every team found in current game
    feeds becomes searchable.
  */

  useEffect(() => {
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

    if (!fallback.length) {
      return
    }

    setTeamDirectory(
      (current) => {
        const map =
          new Map<
            string,
            SearchTeam
          >()

        for (const team of current) {
          map.set(
            `${team.league}-${team.code}`,
            team,
          )
        }

        for (const team of fallback) {
          const key =
            `${team.league}-${team.code}`

          if (!map.has(key)) {
            map.set(
              key,
              team,
            )
          }
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
  ])

  useEffect(() => {
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
              (
                candidate,
              ) =>
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
            (
              favorite,
            ) =>
              !found.has(
                `${favorite.league}-${favorite.code}`,
              ),
          )

        if (!missing.length) {
          break
        }

        const neededLeagues =
          [
            ...new Set(
              missing.map(
                (
                  favorite,
                ) =>
                  favorite.league,
              ),
            ),
          ]

        const date =
          addDays(
            new Date(),
            offset,
          )

        const results =
          await Promise.allSettled(
            neededLeagues.map(
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
                (
                  candidate,
                ) =>
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

      if (cancelled) {
        return
      }

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
    const scrollTimer =
      window.setInterval(
        () => {
          const feed =
            feedRef.current

          if (
            !feed ||
            pausedRef.current ||
            view ===
              'FAVORITES'
          ) {
            return
          }

          if (
            feed.scrollHeight <=
            feed.clientHeight + 2
          ) {
            return
          }

          const atBottom =
            feed.scrollTop +
              feed.clientHeight >=
            feed.scrollHeight -
              2

          if (atBottom) {
            feed.scrollTop =
              0

            return
          }

          feed.scrollTop +=
            1
        },
        150,
      )

    return () =>
      window.clearInterval(
        scrollTimer,
      )
  }, [view])

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
    }, [
      gamesByLeague,
    ])

  const nflDisplayGames =
    useMemo(() => {
      const source =
        nflWeekGames.length
          ? nflWeekGames
          : gamesByLeague.NFL

      return [
        ...source,
      ].sort(
        (a, b) =>
          new Date(
            a.date,
          ).getTime() -
          new Date(
            b.date,
          ).getTime(),
      )
    }, [
      nflWeekGames,
      gamesByLeague,
    ])

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
          const directoryTeam =
            teamDirectory.find(
              (
                team,
              ) =>
                team.league ===
                  favorite.league &&
                team.code ===
                  favorite.code,
            )

          return {
            ...favorite,

            name:
              directoryTeam?.name ||
              favorite.code,

            logo:
              directoryTeam?.logo,
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
            const alreadyFavorite =
              favorites.some(
                (
                  favorite,
                ) =>
                  favorite.league ===
                    team.league &&
                  favorite.code ===
                    team.code,
              )

            if (
              alreadyFavorite
            ) {
              return false
            }

            return (
              team.name
                .toLowerCase()
                .includes(
                  query,
                ) ||
              team.code
                .toLowerCase()
                .includes(
                  query,
                ) ||
              team.league
                .toLowerCase()
                .includes(
                  query,
                )
            )
          },
        )
        .slice(0, 12)
    }, [
      teamSearch,
      teamDirectory,
      favorites,
    ])

  const dateDisplay =
    now
      .toLocaleDateString(
        [],
        {
          month: 'long',
          day: 'numeric',
        },
      )
      .toUpperCase()

  const weekday =
    now
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

  const timePeriod =
    getTimePeriod(now)

  function selectGame(
    game: Game,
  ) {
    setSelectedGame(
      game,
    )

    pauseAutoScroll()
  }

  function changeView(
    nextView: ViewKey,
  ) {
    setView(
      nextView,
    )

    setSelectedGame(
      null,
    )

    if (
      feedRef.current
    ) {
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

  function openEspn(
    game: Game,
  ) {
    if (!game.link) {
      return
    }

    window.open(
      game.link,
      '_blank',
      'noopener,noreferrer',
    )
  }

  return (
    <main className="screen">
      {selectedGame && (
        <section className="gameDrawer">
          <button
            type="button"
            className="drawerClose"
            onClick={() =>
              setSelectedGame(
                null,
              )
            }
          >
            ×
          </button>

          <div
            className={`drawerLeague drawer-${selectedGame.league.toLowerCase()}`}
          >
            {
              selectedGame.league
            }
          </div>

          <div className="drawerHero">
            <div className="drawerTeam">
              <TeamLogo
                team={
                  selectedGame.away
                }
                large
              />

              <strong>
                {
                  selectedGame.away
                    .code
                }
              </strong>

              <span>
                {selectedGame.away
                  .record || '—'}
              </span>
            </div>

            <div className="drawerCenter">
              {selectedGame.statusState ===
              'in' ? (
                <>
                  <div className="drawerLive">
                    ● LIVE
                  </div>

                  <div className="drawerScore">
                    <strong>
                      {
                        selectedGame.away
                          .score
                      }
                    </strong>

                    <span>
                      —
                    </span>

                    <strong>
                      {
                        selectedGame.home
                          .score
                      }
                    </strong>
                  </div>

                  <div className="drawerStatus">
                    {
                      selectedGame.statusDetail
                    }
                  </div>
                </>
              ) : selectedGame.statusState ===
                'post' ? (
                <>
                  <div className="drawerFinal">
                    FINAL
                  </div>

                  <div className="drawerScore">
                    <strong>
                      {
                        selectedGame.away
                          .score
                      }
                    </strong>

                    <span>
                      —
                    </span>

                    <strong>
                      {
                        selectedGame.home
                          .score
                      }
                    </strong>
                  </div>
                </>
              ) : (
                <>
                  <div className="drawerTime">
                    {formatGameTime(
                      selectedGame.date,
                    )}
                  </div>

                  <div className="drawerAt">
                    @
                  </div>

                  {selectedGame.network && (
                    <div className="drawerNetwork">
                      {
                        selectedGame.network
                      }
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="drawerTeam">
              <TeamLogo
                team={
                  selectedGame.home
                }
                large
              />

              <strong>
                {
                  selectedGame.home
                    .code
                }
              </strong>

              <span>
                {selectedGame.home
                  .record || '—'}
              </span>
            </div>
          </div>

          <div className="drawerStandings">
            <div>
              {standingText(
                selectedGame.away,
                selectedGame.league,
              )}
            </div>

            <div>
              {standingText(
                selectedGame.home,
                selectedGame.league,
              )}
            </div>
          </div>

          <section className="drawerSection">
            <div className="drawerLabel">
              FULL MARKET
            </div>

            <OddsPanel
              game={
                selectedGame
              }
            />
          </section>

          <section className="drawerSection">
            <div className="drawerLabel">
              MATCHUP
            </div>

            <div className="matchupNames">
              <span>
                {
                  selectedGame.away
                    .displayName
                }
              </span>

              <span>
                {
                  selectedGame.home
                    .displayName
                }
              </span>
            </div>
          </section>

          <button
            type="button"
            className="espnButton"
            disabled={
              !selectedGame.link
            }
            onClick={() =>
              openEspn(
                selectedGame,
              )
            }
          >
            ESPN ↗
          </button>
        </section>
      )}

      <aside className="ticker">
        <header className="clockStage">
          <div className="clockDate">
            <span>
              {timePeriod}
            </span>

            <strong>
              {weekday}
              <i> · </i>
              {dateDisplay}
            </strong>
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
          >
            ★
          </button>
        </nav>

        {view === 'NFL' && (
          <div className="nflWeekHero">
            <span>
              NFL
            </span>

            <strong>
              WEEK{' '}
              {nflWeekNumber ||
                '—'}
            </strong>

            <em>
              {
                nflDisplayGames.length
              }{' '}
              GAMES
            </em>
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

          {view ===
            'ALL' && (
            <>
              <LeagueSection
                league="NHL"
                games={
                  activeGames.NHL
                }
                onSelect={
                  selectGame
                }
              />

              <LeagueSection
                league="NFL"
                games={
                  activeGames.NFL
                }
                label={
                  nflWeekNumber
                    ? `WEEK ${nflWeekNumber}`
                    : undefined
                }
                onSelect={
                  selectGame
                }
              />

              <LeagueSection
                league="NBA"
                games={
                  activeGames.NBA
                }
                onSelect={
                  selectGame
                }
              />

              <LeagueSection
                league="MLB"
                games={
                  activeGames.MLB
                }
                onSelect={
                  selectGame
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
                        game={
                          game
                        }
                        onSelect={
                          selectGame
                        }
                      />
                    ),
                  )}
                </section>
              )}

              {morningFinals.length >
                0 && (
                <section className="finalsBlock">
                  <div className="finalsHeader">
                    LAST NIGHT
                  </div>

                  {morningFinals.map(
                    (game) => (
                      <GameRow
                        key={`last-${game.league}-${game.id}`}
                        game={
                          game
                        }
                        onSelect={
                          selectGame
                        }
                      />
                    ),
                  )}
                </section>
              )}
            </>
          )}

          {view ===
            'NHL' && (
            <LeagueSection
              league="NHL"
              games={
                sortedGames.NHL
              }
              onSelect={
                selectGame
              }
            />
          )}

          {view ===
            'NBA' && (
            <LeagueSection
              league="NBA"
              games={
                sortedGames.NBA
              }
              onSelect={
                selectGame
              }
            />
          )}

          {view ===
            'MLB' && (
            <LeagueSection
              league="MLB"
              games={
                sortedGames.MLB
              }
              onSelect={
                selectGame
              }
            />
          )}

          {view ===
            'NFL' && (
            <LeagueSection
              league="NFL"
              games={
                nflDisplayGames
              }
              label={
                nflWeekNumber
                  ? `WEEK ${nflWeekNumber} · ${nflDisplayGames.length} GAMES`
                  : `${nflDisplayGames.length} GAMES`
              }
              onSelect={
                selectGame
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
                  <span>
                    +
                  </span>

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
                            team={
                              team
                            }
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

                {teamSearch.trim() &&
                  teamSearchResults.length ===
                    0 && (
                  <div className="oddsUnavailable">
                    NO TEAMS FOUND FOR “
                    {teamSearch}”
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
                      selectGame(
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

                    <OddsPanel
                      game={game}
                      compact
                    />
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