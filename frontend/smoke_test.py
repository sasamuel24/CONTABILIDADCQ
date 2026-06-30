"""Smoke test no destructivo de DocuFlow (frontend Vite+React).
Carga la pantalla inicial, captura consola/errores y screenshot."""
from playwright.sync_api import sync_playwright

BASE = "http://localhost:3001"
console_msgs = []
page_errors = []
failed_requests = []

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()

    page.on("console", lambda m: console_msgs.append(f"[{m.type}] {m.text}"))
    page.on("pageerror", lambda e: page_errors.append(str(e)))
    page.on("requestfailed", lambda r: failed_requests.append(f"{r.method} {r.url} -> {r.failure}"))

    page.goto(BASE, wait_until="networkidle", timeout=60000)
    page.wait_for_timeout(2000)

    print("=== TITLE ===")
    print(page.title())
    print("=== URL ===")
    print(page.url)

    print("=== INPUTS ===")
    for el in page.locator("input").all():
        t = el.get_attribute("type") or "text"
        name = el.get_attribute("name") or el.get_attribute("placeholder") or el.get_attribute("id") or ""
        print(f"  input[type={t}] name/placeholder={name!r}")

    print("=== BUTTONS ===")
    for el in page.locator("button").all():
        print(f"  button: {el.inner_text()!r}")

    print("=== VISIBLE TEXT (primeras 800 chars) ===")
    body = page.locator("body").inner_text()
    print(body[:800])

    page.screenshot(path="smoke_login.png", full_page=True)
    print("=== SCREENSHOT guardado: frontend/smoke_login.png ===")

    print("=== CONSOLE MSGS ===")
    for m in console_msgs[-30:]:
        print(" ", m)
    print("=== PAGE ERRORS ===")
    for e in page_errors:
        print(" ", e)
    print("=== FAILED REQUESTS ===")
    for r in failed_requests[-20:]:
        print(" ", r)

    browser.close()
