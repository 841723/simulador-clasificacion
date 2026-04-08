"""
sofascore.py - Incremental SofaScore scraper

Fetches match data and betting odds, then upserts into the PostgreSQL database.

Usage:
    python sofascore.py [--from-jornada N] [--to-jornada N] [--season N] [--league N] [--init-teams]

Environment variables (with defaults):
    DB_HOST     localhost
    DB_PORT     5432
    DB_NAME     simulador_db
    DB_USER     simulador
    DB_PASSWORD simulador
"""

import argparse
import json
import os
from fractions import Fraction

import psycopg
from playwright.sync_api import sync_playwright

# ── Constants ──────────────────────────────────────────────────────────────────
# DEFAULT_LEAGUE_EXT_ID = 54
# DEFAULT_SEASON_EXT_ID = 77558
# TOTAL_JORNADAS = 42
# DEFAULT_SEASON_YEAR = '25/26'
# DEFAULT_LEAGUE_NAME = 'LaLiga 2'
# DEFAULT_LEAGUE_SLUG = 'laliga2'
# DEFAULT_LEAGUE_COUNTRY = 'Spain'

DEFAULT_LEAGUE_EXT_ID = 8
DEFAULT_SEASON_EXT_ID = 77559
TOTAL_JORNADAS = 38
DEFAULT_SEASON_YEAR = '25/26'
DEFAULT_LEAGUE_NAME = 'LaLiga'
DEFAULT_LEAGUE_SLUG = 'laliga'
DEFAULT_LEAGUE_COUNTRY = 'Spain'

# ── DB connection helper ───────────────────────────────────────────────────────

def get_db_conn():
    return psycopg.connect(
        host=os.environ.get("DB_HOST", "localhost"),
        port=int(os.environ.get("DB_PORT", 5432)),
        dbname=os.environ.get("DB_NAME", "simulador_db"),
        user=os.environ.get("DB_USER", "simulador"),
        password=os.environ.get("DB_PASSWORD", "simulador"),
    )

# ── Probability helpers ────────────────────────────────────────────────────────

def fractional_to_decimal(frac_str):
    return float(Fraction(frac_str)) + 1


def odds_to_probabilities(fractional_odds):
    """Convert a list of fractional odds strings to normalized probabilities."""
    decimals = [fractional_to_decimal(f) for f in fractional_odds]
    implied = [1 / d for d in decimals]
    total = sum(implied)
    return [round(p / total, 4) for p in implied]

# ── SofaScore API fetchers ─────────────────────────────────────────────────────

def fetch_jornada(jornada, league_id, season_id, browser):
    url = f"https://www.sofascore.com/api/v1/unique-tournament/{league_id}/season/{season_id}/events/round/{jornada}"
    print(f"  Fetching jornada {jornada} from {url}...")
    page = browser.new_page()
    try:
        page.goto(url)
        content = page.content()
        return _parse_pre(content)
    finally:
        page.close()


def fetch_match_odds(match_id, browser):
    url = f"https://www.sofascore.com/api/v1/event/{match_id}/odds/1/all"
    page = browser.new_page()
    try:
        page.goto(url)
        content = page.content()
        return _parse_pre(content)
    finally:
        page.close()


def fetch_standings(league_ext_id, season_ext_id, browser):
    """Fetch the total standings for a season from SofaScore."""
    url = f"https://www.sofascore.com/api/v1/unique-tournament/{league_ext_id}/season/{season_ext_id}/standings/total"
    page = browser.new_page()
    try:
        page.goto(url)
        content = page.content()
        return _parse_pre(content)
    finally:
        page.close()


def _parse_pre(html_content):
    """Extract JSON from the <pre> tag in a SofaScore API page."""
    try:
        return json.loads(
            html_content.split("<pre>")[1].split("</pre>")[0]
        )
    except (IndexError, ValueError) as exc:
        raise ValueError(f"Could not parse JSON from page: {exc}") from exc

# ── Incremental jornada calculation ───────────────────────────────────────────

def compute_first_incomplete_jornada(conn, season_id):
    """
    Returns the first jornada where not all matches are finished.
    Adds a buffer of 1 jornada behind for safety.
    Defaults to 1 if no matches are found.
    """
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT jornada, COUNT(*) AS total,
                   SUM(CASE WHEN status = 'finished' THEN 1 ELSE 0 END) AS finished
            FROM matches
            WHERE season_id = %s
            GROUP BY jornada
            ORDER BY jornada
            """,
            (season_id,),
        )
        rows = cur.fetchall()

    if not rows:
        return 1

    for jornada, total, finished in rows:
        if finished < total:
            return max(1, jornada - 1)

    # All jornadas complete → return last jornada
    return rows[-1][0]


def has_teams_for_season(conn, season_id):
    """Returns True if any teams are registered for this season."""
    with conn.cursor() as cur:
        cur.execute(
            "SELECT 1 FROM season_teams WHERE season_id = %s LIMIT 1",
            (season_id,),
        )
        return cur.fetchone() is not None

# ── DB upsert helpers ──────────────────────────────────────────────────────────

def ensure_league(conn, ext_id, name, slug, country):
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO leagues (name, slug, country, external_id)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (slug) DO UPDATE
              SET name        = EXCLUDED.name,
                  external_id = EXCLUDED.external_id
            RETURNING id
            """,
            (name, slug, country, ext_id),
        )
        return cur.fetchone()[0]


def ensure_season(conn, league_id, ext_id, year=DEFAULT_SEASON_YEAR, name=None):
    if name is None:
        name = f'{DEFAULT_LEAGUE_NAME} {year}'
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO seasons (league_id, year, name, external_id)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (league_id, year) DO UPDATE
              SET name        = EXCLUDED.name,
                  external_id = EXCLUDED.external_id
            RETURNING id
            """,
            (league_id, year, name, ext_id),
        )
        return cur.fetchone()[0]


def ensure_odds_source(conn):
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO probability_sources (slug, name, description)
            VALUES ('odds', 'Cuotas de casas de apuestas',
                'Probabilidades calculadas a partir de las cuotas ofrecidas por las casas de apuestas, normalizadas para eliminar el margen del bookmaker.')
            ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description
            RETURNING id
            """,
        )
        return cur.fetchone()[0]


def upsert_team(conn, season_id, team_data):
    """Upsert a team and link to season. Returns internal team id."""
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO teams (name, slug, image_url, external_id)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (slug) DO UPDATE
              SET name        = EXCLUDED.name,
                  image_url   = EXCLUDED.image_url,
                  external_id = EXCLUDED.external_id
            RETURNING id
            """,
            (
                team_data.get("name"),
                team_data.get("slug"),
                team_data.get("imageUrl"),
                team_data.get("id"),
            ),
        )
        team_id = cur.fetchone()[0]
        cur.execute(
            "INSERT INTO season_teams (season_id, team_id) VALUES (%s, %s) ON CONFLICT DO NOTHING",
            (season_id, team_id),
        )
    return team_id


def upsert_base_standings(conn, season_id, team_id):
    """Insert a zero-row for this team in base_standings (no-op if already exists).
    position=0 means 'not yet assigned'; the front-end calculates from scratch.
    """
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO base_standings
              (season_id, team_id, position, played, wins, draws, losses, goals_for, goals_against, points)
            VALUES (%s, %s, 0, 0, 0, 0, 0, 0, 0, 0)
            ON CONFLICT (season_id, team_id) DO NOTHING
            """,
            (season_id, team_id),
        )


def seed_teams_from_standings(conn, season_id, standings_data, league_ext_id):
    """Seed teams from the SofaScore standings API response."""
    standings_list = standings_data.get("standings", [])
    if not standings_list:
        print("  No standings data found.")
        return

    rows = standings_list[0].get("rows", [])
    print(f"  Seeding {len(rows)} teams from standings...")
    for row in rows:
        team = row.get("team", {})
        image_url = f"https://img.sofascore.com/api/v1/team/{team.get('id')}/image"
        team_id = upsert_team(conn, season_id, {
            "name": team.get("name"),
            "slug": team.get("slug"),
            "imageUrl": image_url,
            "id": team.get("id"),
        })
        print(f"    ✓ {team.get('name')}  image {image_url}")
        upsert_base_standings(conn, season_id, team_id)
        print(f"    ✓ {team.get('name')} (slug: {team.get('slug')})")
    conn.commit()
    print(f"  Teams seeded successfully.")


def upsert_match(conn, season_id, event, home_team_id, away_team_id, jornada):
    """Upsert a match from a SofaScore event object."""
    status_type = event.get("status", {}).get("type", "")
    status_desc = event.get("status", {}).get("description")
    is_finished = status_type == "finished"

    home_score = None
    away_score = None
    locked_result = None
    is_locked = False
    winner_code = event.get("winnerCode")

    if is_finished:
        h = (event.get("homeScore") or {}).get("current")
        a = (event.get("awayScore") or {}).get("current")
        if h is not None and a is not None:
            home_score = int(h)
            away_score = int(a)
            locked_result = f"{home_score}-{away_score}"
            is_locked = True

    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO matches
              (id, season_id, home_team_id, away_team_id, jornada, start_timestamp,
               home_score, away_score, status, winner_code, is_locked, locked_result)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
            ON CONFLICT (id) DO UPDATE SET
              is_locked      = EXCLUDED.is_locked,
              locked_result  = EXCLUDED.locked_result,
              home_score     = EXCLUDED.home_score,
              away_score     = EXCLUDED.away_score,
              status         = EXCLUDED.status,
              winner_code    = EXCLUDED.winner_code,
              start_timestamp = EXCLUDED.start_timestamp
            """,
            (
                event["id"],
                season_id,
                home_team_id,
                away_team_id,
                jornada,
                event.get("startTimestamp"),
                home_score,
                away_score,
                status_desc,
                winner_code,
                is_locked,
                locked_result,
            ),
        )


def upsert_odds(conn, match_id, odds_source_id, prob_home, prob_draw, prob_away):
    """Upsert probabilities in both matches table and match_probabilities table."""
    with conn.cursor() as cur:
        # Update columns on matches table (prob_is_final=true → real odds)
        cur.execute(
            """
            UPDATE matches
            SET prob_home = %s, prob_draw = %s, prob_away = %s, prob_is_final = TRUE
            WHERE id = %s
            """,
            (prob_home, prob_draw, prob_away, match_id),
        )
        # Upsert into match_probabilities
        cur.execute(
            """
            INSERT INTO match_probabilities (match_id, source_id, prob_home, prob_draw, prob_away)
            VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT (match_id, source_id) DO UPDATE
              SET prob_home  = EXCLUDED.prob_home,
                  prob_draw  = EXCLUDED.prob_draw,
                  prob_away  = EXCLUDED.prob_away,
                  updated_at = CURRENT_TIMESTAMP
            """,
            (match_id, odds_source_id, prob_home, prob_draw, prob_away),
        )

# ── Main scraping logic ────────────────────────────────────────────────────────

def scrape_jornada(jornada, season_id, odds_source_id, league_ext_id, season_ext_id, conn, browser):
    """Scrape a single jornada: upsert teams, matches, and odds."""
    print(f"\n  Jornada {jornada}:")

    data = fetch_jornada(jornada, league_ext_id, season_ext_id, browser)
    events = data.get("events", [])
    print(f"    {len(events)} partidos encontrados")

    for event in events:
        home_id = upsert_team(conn, season_id, event.get("homeTeam", {}))
        away_id = upsert_team(conn, season_id, event.get("awayTeam", {}))
        upsert_base_standings(conn, season_id, home_id)
        upsert_base_standings(conn, season_id, away_id)
        upsert_match(conn, season_id, event, home_id, away_id, jornada)

        match_id = event["id"]
        slug = event.get("slug", str(match_id))
        print(f"    [{slug}] Obteniendo cuotas...", end=" ", flush=True)

        try:
            odds_data = fetch_match_odds(match_id, browser)
            markets = odds_data.get("markets", [])
            ft_market = next(
                (m for m in markets if m.get("marketName") == "Full time"), None
            )
            if not ft_market:
                print("sin mercado 'Full time'")
                continue

            choices = ft_market.get("choices", [])
            c1 = next((c for c in choices if c.get("name") == "1"), None)
            cx = next((c for c in choices if c.get("name") == "X"), None)
            c2 = next((c for c in choices if c.get("name") == "2"), None)

            if not (c1 and cx and c2):
                print("sin opciones 1/X/2")
                continue

            probs = odds_to_probabilities([
                c1["fractionalValue"],
                cx["fractionalValue"],
                c2["fractionalValue"],
            ])
            upsert_odds(conn, match_id, odds_source_id, probs[0], probs[1], probs[2])
            print(f"✓ ({probs[0]:.2f}/{probs[1]:.2f}/{probs[2]:.2f})")

        except Exception as exc:  # noqa: BLE001
            print(f"ERROR: {exc}")

    conn.commit()
    print(f"  Jornada {jornada} guardada.")


def main():
    parser = argparse.ArgumentParser(description="SofaScore scraper")
    parser.add_argument("--from-jornada", type=int, default=None,
                        help="First jornada to scrape (default: auto-detect first incomplete)")
    parser.add_argument("--to-jornada", type=int, default=TOTAL_JORNADAS,
                        help=f"Last jornada to scrape (default: {TOTAL_JORNADAS})")
    parser.add_argument("--season-sf", type=int, default=DEFAULT_SEASON_EXT_ID,
                        help=f"SofaScore season id (default: {DEFAULT_SEASON_EXT_ID})")
    parser.add_argument("--league-sf", type=int, default=DEFAULT_LEAGUE_EXT_ID,
                        help=f"SofaScore league id (default: {DEFAULT_LEAGUE_EXT_ID})")
    parser.add_argument("--season-year", type=str, default=DEFAULT_SEASON_YEAR,
                        help=f"Season year string for naming (default: '{DEFAULT_SEASON_YEAR}')")
    parser.add_argument("--league-name", type=str, default=DEFAULT_LEAGUE_NAME,
                        help=f"Full league name for naming (default: '{DEFAULT_LEAGUE_NAME}')")
    parser.add_argument("--league-slug", type=str, default=DEFAULT_LEAGUE_SLUG,
                        help=f"League slug for naming (default: '{DEFAULT_LEAGUE_SLUG}')")
    parser.add_argument("--league-country", type=str, default=DEFAULT_LEAGUE_COUNTRY,
                        help=f"League country for naming (default: '{DEFAULT_LEAGUE_COUNTRY}')")
    parser.add_argument("--jornadas-total", type=int, default=TOTAL_JORNADAS,
                        help=f"Total number of jornadas in the season (default: {TOTAL_JORNADAS})")
    parser.add_argument("--init-teams", action="store_true",
                        help="Seed teams from the standings API before scraping matches")
    args = parser.parse_args()

    print("Connecting to database...")
    conn = get_db_conn()

    try:
        league_id = ensure_league(conn, args.league_sf, args.league_name, args.league_slug, args.league_country)
        season_id = ensure_season(conn, league_id, args.season_sf, args.season_year, f"{args.league_name} {args.season_year}")
        odds_source_id = ensure_odds_source(conn)
        conn.commit()

        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True)
            try:
                # Seed teams from standings if requested or if no teams exist yet (first run)
                if args.init_teams or not has_teams_for_season(conn, season_id):
                    print("Fetching teams from standings API...")
                    standings_data = fetch_standings(args.league_sf, args.season_sf, browser)
                    seed_teams_from_standings(conn, season_id, standings_data, args.league_sf)
                return
                from_jornada = args.from_jornada
                if from_jornada is None:
                    from_jornada = compute_first_incomplete_jornada(conn, season_id)
                    print(f"Auto-detected first incomplete jornada: {from_jornada}")

                to_jornada = args.to_jornada
                print(f"Scraping jornadas {from_jornada} – {to_jornada}...")

                for jornada in range(from_jornada, to_jornada + 1):
                    try:
                        scrape_jornada(jornada, season_id, odds_source_id, args.league_sf, args.season_sf, conn, browser)
                    except Exception as exc:  # noqa: BLE001
                        print(f"  ERROR en jornada {jornada}: {exc}")
                        conn.rollback()
            finally:
                browser.close()

        print("\nScraping completado.")
    finally:
        conn.close()


if __name__ == "__main__":
    main()