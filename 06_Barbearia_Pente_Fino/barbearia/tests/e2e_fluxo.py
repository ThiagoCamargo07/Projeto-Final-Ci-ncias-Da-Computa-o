"""Teste de ponta a ponta (sistema) com Playwright: agenda, consulta e cancela.
Uso: python3 tests/e2e_fluxo.py <pasta-de-saida-das-capturas>
Relógio fixado em terça, 10/11/2026, 08:00 (America/Sao_Paulo)."""
import sys, threading, http.server, functools, os, datetime
from playwright.sync_api import sync_playwright, expect

SITE = os.path.join(os.path.dirname(__file__), "..", "site")
OUT = sys.argv[1] if len(sys.argv) > 1 else "."
os.makedirs(OUT, exist_ok=True)

handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=SITE)
srv = http.server.ThreadingHTTPServer(("127.0.0.1", 8765), handler)
threading.Thread(target=srv.serve_forever, daemon=True).start()
URL = "http://127.0.0.1:8765/index.html"
AGORA = datetime.datetime(2026, 11, 10, 8, 0, tzinfo=datetime.timezone(datetime.timedelta(hours=-3)))
resultados = []

def ok(nome, cond):
    resultados.append((nome, bool(cond)))
    print(("PASSOU " if cond else "FALHOU ") + nome)

with sync_playwright() as p:
    nav = p.chromium.launch()
    for nome_disp, vp in [("desktop", {"width": 1280, "height": 900}), ("celular", {"width": 390, "height": 844})]:
        ctx = nav.new_context(viewport=vp, timezone_id="America/Sao_Paulo", locale="pt-BR")
        pg = ctx.new_page()
        erros = []
        pg.on("pageerror", lambda e: erros.append(str(e)))
        pg.on("console", lambda m: erros.append(m.text) if m.type == "error" else None)
        pg.clock.set_fixed_time(AGORA)
        pg.goto(URL)
        pg.wait_for_load_state("networkidle")

        ok(f"[{nome_disp}] página carrega sem erros de JavaScript", not erros)
        ok(f"[{nome_disp}] tabela de preços lista 8 serviços", pg.locator(".item-preco").count() == 8)
        ok(f"[{nome_disp}] próximo horário livre = Hoje, 9h com Rafael",
           "Hoje, 9h com Rafael" in pg.locator("#proximo-valor").inner_text())
        larg = pg.evaluate("document.documentElement.scrollWidth")
        ok(f"[{nome_disp}] sem rolagem horizontal ({larg}px)", larg <= vp["width"])
        pg.screenshot(path=f"{OUT}/{nome_disp}_inicio.png", full_page=False)
        pg.screenshot(path=f"{OUT}/{nome_disp}_pagina_inteira.png", full_page=True)

        # envio vazio mostra erros
        pg.click("text=Confirmar agendamento")
        ok(f"[{nome_disp}] envio vazio mostra mensagens de erro", pg.locator(".erro:not(:empty)").count() >= 5)

        # fluxo de agendamento: corte e barba, Rafael, terça 10/11 às 10h
        pg.check("#servico-corte-barba")
        pg.check("#barbeiro-rafael")
        pg.fill("#campo-data", "2026-11-10")
        pg.dispatch_event("#campo-data", "change")
        horas = pg.locator(".hora")
        ok(f"[{nome_disp}] serviço de 60 min mostra 19 horários (9h a 18h)", horas.count() == 19)
        pg.click(".hora >> text=10h")
        pg.fill("#campo-nome", "Bruno Teste")
        pg.fill("#campo-telefone", "(11) 91234-5678")
        pg.check("#campo-consentimento")
        ok(f"[{nome_disp}] resumo antes de confirmar",
           "Corte e barba com Rafael, hoje às 10h" in pg.locator("#resumo").inner_text())
        pg.screenshot(path=f"{OUT}/{nome_disp}_formulario.png", full_page=False)
        pg.click("text=Confirmar agendamento")
        conf = pg.locator("#confirmacao")
        expect(conf).to_be_visible()
        codigo = pg.locator("#conf-codigo").inner_text()
        ok(f"[{nome_disp}] confirmação com código PF-XXXX ({codigo})", codigo.startswith("PF-") and len(codigo) == 7)
        ok(f"[{nome_disp}] link do calendário .ics", pg.get_attribute("#conf-ics", "href").startswith("data:text/calendar"))
        ok(f"[{nome_disp}] link de compartilhar no WhatsApp", pg.get_attribute("#conf-whats", "href").startswith("https://wa.me/?text="))
        conf.scroll_into_view_if_needed()
        pg.screenshot(path=f"{OUT}/{nome_disp}_confirmacao.png", full_page=False)

        # horário ocupado não aparece de novo
        pg.click("#conf-novo")
        pg.check("#servico-corte"); pg.check("#barbeiro-rafael")
        pg.fill("#campo-data", "2026-11-10"); pg.dispatch_event("#campo-data", "change")
        textos = pg.locator(".hora").all_inner_texts()
        ok(f"[{nome_disp}] RN04: 10h e 10h30 somem da agenda do Rafael", "10h" not in textos and "10h30" not in textos)

        # consulta e cancelamento
        pg.fill("#consulta-telefone", "11912345678")
        pg.click("text=Ver meus horários")
        ok(f"[{nome_disp}] consulta encontra o agendamento", pg.locator(".meu").count() == 1)
        pg.locator(".meu").scroll_into_view_if_needed()
        pg.screenshot(path=f"{OUT}/{nome_disp}_meus_horarios.png", full_page=False)
        pg.click("text=Cancelar agendamento")
        ok(f"[{nome_disp}] cancelamento muda situação para Cancelado", "Cancelado" in pg.locator(".meu").inner_text())
        pg.check("#servico-corte"); pg.fill("#campo-data", "2026-11-10"); pg.dispatch_event("#campo-data", "change")
        ok(f"[{nome_disp}] horário volta a ficar livre após cancelar", "10h" in pg.locator(".hora").all_inner_texts())

        # dia fechado
        pg.fill("#campo-data", "2026-11-16"); pg.dispatch_event("#campo-data", "change")
        ok(f"[{nome_disp}] segunda-feira aparece como fechado", "Fechado neste dia" in pg.locator("#horarios").inner_text())
        ok(f"[{nome_disp}] nenhum erro de JavaScript no fluxo", not erros)
        ctx.close()

    # abrir direto do arquivo (duplo clique), sem servidor
    ctx = nav.new_context(timezone_id="America/Sao_Paulo")
    pg = ctx.new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto("file://" + os.path.abspath(os.path.join(SITE, "index.html")))
    ok("[arquivo local] funciona aberto direto do disco (file://)", pg.locator(".item-preco").count() == 8 and not errs)
    nav.close()
srv.shutdown()

falhas = [n for n, r in resultados if not r]
print(f"\n{len(resultados) - len(falhas)}/{len(resultados)} verificações passaram")
sys.exit(1 if falhas else 0)
