from playwright.sync_api import sync_playwright
import json
from fractions import Fraction
import psycopg


def fraccion_a_decimal(frac_str):
    frac = Fraction(frac_str)
    return float(frac) + 1  # +1 para incluir stake

def cuotas_a_probabilidades(frac_cuotas):
    # Paso 1: convertir a decimales
    dec_cuotas = [fraccion_a_decimal(f) for f in frac_cuotas]
    
    # Paso 2: probabilidad implícita
    impl = [1 / d for d in dec_cuotas]
    
    # Paso 3: normalizar
    total = sum(impl)
    norm = [p / total * 100 for p in impl]
    
    return [round(p/100, 2) for p in norm]

def get_sofascore_data(jornada, browser):
    url = f"https://www.sofascore.com/api/v1/unique-tournament/54/season/77558/events/round/{jornada}"
    page = browser.new_page()
    page.goto(url)
    response = page.content()

    # recupera los valores del <pre></pre> y los parsea como JSON
    response = json.loads(response.split("<pre>")[1].split("</pre>")[0])
    return response

def get_sofascore_odds_data(match, browser):
    url = f"https://www.sofascore.com/api/v1/event/{match['id']}/odds/1/all"
    page = browser.new_page()
    page.goto(url)
    response = page.content()

    # recupera los valores del <pre></pre> y los parsea como JSON
    response = json.loads(response.split("<pre>")[1].split("</pre>")[0])
    return response

def save_match_odds_database(match, pg_conn):
    event_id = match["eventId"]
    # search for the match["market"] whose marketName is "Full Time"
    odds = next((m for m in match["markets"] if m["marketName"] == "Full time"), None)
    if odds is None:
        print(f"No se encontraron odds para el partido {event_id}")
        return

    # search for the choice whose name is "1", "X" and "2"
    choice_home = next((c for c in odds["choices"] if c["name"] == "1"), None)
    choice_draw = next((c for c in odds["choices"] if c["name"] == "X"), None)
    choice_away = next((c for c in odds["choices"] if c["name"] == "2"), None)
    if choice_home is None or choice_draw is None or choice_away is None:
        print(f"No se encontraron las opciones de apuesta para el partido {event_id}")
        return

    cuotas = [choice_home["fractionalValue"], choice_draw["fractionalValue"], choice_away["fractionalValue"]]
    probabilidades = cuotas_a_probabilidades(cuotas)    

    pg_conn.cursor().execute(
        """
        UPDATE matches
        SET prob_home = %s, prob_draw = %s, prob_away = %s
        WHERE id = %s;
        """,
        (
            probabilidades[0],
            probabilidades[1],
            probabilidades[2],
            event_id
        )
    )
    pg_conn.commit()


   
def get_jornadas(playwright, pg_conn, from_jornada=1, to_jornada=42):
    browser = playwright.chromium.launch(headless=True)
    for jornada in range(from_jornada, to_jornada + 1):
        print(f"Obteniendo datos de la jornada {jornada}...")
        data_jornada = get_sofascore_data(jornada, browser)
        for match in data_jornada["events"]:
            print(f"Obteniendo datos de las cuotas para el partido {match['slug']}...")
            data_match = get_sofascore_odds_data(match, browser)
            save_match_odds_database(data_match, pg_conn)
    browser.close()


def main():
    with sync_playwright() as playwright:
        with psycopg.connect(
            host="localhost",
            port=5432,
            dbname="simulador_db",
            user="simulador",
            password="simulador"
        ) as pg_conn:
            get_jornadas(playwright, pg_conn, from_jornada=31, to_jornada=42)

    

main()