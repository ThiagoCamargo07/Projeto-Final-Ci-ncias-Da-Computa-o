# Barbearia Pente Fino – site de agendamento

Projeto acadêmico de Ciência da Computação (Uninove, 2026) – **Thiago Ferreira Camargo, RA 323100646**.
Aplicação prática do guia *Do Requisito ao Deploy: guia prático do ciclo completo de desenvolvimento de um sistema*.

> A Barbearia Pente Fino é **fictícia**. Nomes, preços, telefone e endereço são ilustrativos.

## O que o site faz

- Mostra a tabela de preços, os barbeiros e o horário de funcionamento.
- Calcula e exibe o **próximo horário livre**.
- Agenda em 4 passos: serviço → barbeiro (ou "qualquer um") → dia e horário → dados do cliente.
- Mostra **só horários realmente livres**, respeitando expediente, folgas, antecedência e conflitos.
- Confirma com código `PF-XXXX`, arquivo de calendário (.ics) e compartilhamento no WhatsApp.
- Permite consultar e **cancelar** agendamentos pelo celular (até 2 horas antes).

## Como rodar

Não precisa instalar nada: abra `site/index.html` no navegador.
Para servir localmente: `npm start` (ou `python3 -m http.server 8000 --directory site`) e acesse http://localhost:8000.

## Testes

| Tipo | Comando | O que verifica |
|------|---------|----------------|
| Unitários | `npm test` (Node 18+) | 19 casos (CT01–CT19) das regras de negócio em `site/js/agenda.js` |
| Ponta a ponta | `python3 tests/e2e_fluxo.py capturas` (Playwright) | 33 verificações do fluxo real no navegador, desktop e celular |

## Estrutura

```
site/
  index.html            página única
  css/estilo.css        estilos (responsivo, foco visível, movimento reduzido)
  js/dados.js           serviços, barbeiros, funcionamento e regras (configuração)
  js/agenda.js          regras de negócio puras (testadas)
  js/armazenamento.js   repositório: localStorage (troca futura por API)
  js/app.js             camada de apresentação (DOM e eventos)
  fontes/               fonte Lora (OFL 1.1) hospedada junto, sem chamadas externas
tests/                  testes unitários (node:test) e de ponta a ponta (Playwright)
docs/diagramas/         fontes dos diagramas (Mermaid e Graphviz)
.github/workflows/      CI (testes) e deploy no GitHub Pages
```

## Deploy (GitHub Pages)

1. Crie um repositório no GitHub e envie este projeto para a branch `main`.
2. Em **Settings → Pages → Build and deployment**, selecione **GitHub Actions**.
3. A cada push na `main`, o workflow `deploy.yml` roda os testes e, se passarem, publica a pasta `site/`.
4. O endereço fica em `https://<seu-usuario>.github.io/<repositorio>/`.

Rollback: `git revert <commit>` seguido de push na `main` publica novamente a versão anterior.

## Limitações conhecidas (versão 1.0)

- Os agendamentos ficam no navegador de quem agenda (localStorage): a barbearia não vê a agenda de outros clientes.
  Por isso, esta versão é uma **demonstração**. A evolução prevista é um back-end com banco de dados
  (ver capítulo 13 da Documentação do Sistema), trocando apenas `armazenamento.js`.
- Sem login nem painel do barbeiro nesta versão.

## Licença

Código sob licença MIT. Fonte Lora sob SIL Open Font License 1.1 (ver `site/fontes/LEIA-ME.txt`).
