from playwright.sync_api import sync_playwright
import json

def get_sofascore_data(jornada, browser):
    url = f"https://www.sofascore.com/api/v1/unique-tournament/54/season/77558/events/round/{jornada}"
    page = browser.new_page()
    page.goto(url)
    response = page.content()

    # recupera los valores del <pre></pre> y los parsea como JSON
    response = json.loads(response.split("<pre>")[1].split("</pre>")[0])
    return response

def save_data_to_file(data, jornada):
    with open(f"../public/jornadas/{jornada}.json", "w") as file:
        json.dump(data, file)


with sync_playwright() as playwright:
    browser = playwright.chromium.launch()
    for jornada in range(1, 34):
        print(f"Jornada {jornada}")
        data = get_sofascore_data(jornada, browser)
        save_data_to_file(data, jornada)

browser.close()
