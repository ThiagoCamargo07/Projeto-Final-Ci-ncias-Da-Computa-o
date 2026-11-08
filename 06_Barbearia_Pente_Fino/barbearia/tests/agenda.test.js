// Testes automatizados das regras de negócio (Etapa 8 do guia).
// Executar com:  node --test tests/
const test = require("node:test");
const assert = require("node:assert/strict");
const A = require("../site/js/agenda.js");
const DADOS = require("../site/js/dados.js");

const rafael = DADOS.barbeiros.find((b) => b.id === "rafael");
const diego = DADOS.barbeiros.find((b) => b.id === "diego");
// Terça-feira, 10/11/2026, 08:00 (horário local)
const AGORA = new Date(2026, 10, 10, 8, 0);

function livres(extra) {
  return A.horariosDisponiveis(Object.assign({
    config: DADOS, barbeiro: rafael, data: "2026-11-10", duracao: 30, agendamentos: [], agora: AGORA
  }, extra));
}

function ag(campos) {
  return Object.assign({
    codigo: "PF-TEST", servicoId: "corte", barbeiroId: "rafael", data: "2026-11-10", hora: "10:00",
    duracao: 30, cliente: { nome: "Ana", telefone: "11912345678" }, status: "confirmado"
  }, campos);
}

test("CT01 – RN02: grade de 30 em 30 min dentro do expediente (terça 09h–19h)", () => {
  const h = livres();
  assert.equal(h[0], "09:00");
  assert.equal(h[h.length - 1], "18:30");
  assert.equal(h.length, 20);
});

test("CT02 – RN01: domingo e segunda não têm horários", () => {
  assert.deepEqual(livres({ data: "2026-11-15" }), []); // domingo
  assert.deepEqual(livres({ data: "2026-11-16" }), []); // segunda
});

test("CT03 – RN01: sábado fecha às 17h", () => {
  const h = livres({ data: "2026-11-14" });
  assert.equal(h[h.length - 1], "16:30");
});

test("CT04 – serviço de 60 min não começa depois de 18h", () => {
  const h = livres({ duracao: 60 });
  assert.equal(h[h.length - 1], "18:00");
});

test("CT05 – folga do barbeiro: Rafael não atende quarta", () => {
  assert.deepEqual(livres({ data: "2026-11-11" }), []);
  assert.ok(livres({ data: "2026-11-11", barbeiro: diego }).length > 0);
});

test("CT06 – RN03: exige 1 h de antecedência", () => {
  const h = livres({ agora: new Date(2026, 10, 10, 13, 10) });
  assert.equal(h[0], "14:30");
});

test("CT07 – RN03: não aceita datas passadas nem além de 30 dias", () => {
  assert.deepEqual(livres({ data: "2026-11-07" }), []);
  assert.deepEqual(livres({ data: "2026-12-11" }), []);
  assert.ok(livres({ data: "2026-12-10" }).length > 0);
});

test("CT08 – RN04: horário ocupado some da lista, inclusive sobreposição parcial", () => {
  const ocupados = [ag({ hora: "10:00", duracao: 60 })];
  const h = livres({ agendamentos: ocupados, duracao: 45 });
  assert.ok(!h.includes("10:00"));
  assert.ok(!h.includes("10:30"));
  assert.ok(!h.includes("09:30")); // 09:30 + 45 min invadiria 10:00
  assert.ok(h.includes("09:00"));
  assert.ok(h.includes("11:00"));
});

test("CT09 – agendamento cancelado libera o horário", () => {
  const h = livres({ agendamentos: [ag({ status: "cancelado" })] });
  assert.ok(h.includes("10:00"));
});

test("CT10 – 'qualquer barbeiro' usa o primeiro barbeiro livre", () => {
  const ocupados = [ag({ hora: "09:00" })];
  const lista = A.horariosQualquerBarbeiro({ config: DADOS, data: "2026-11-10", duracao: 30, agendamentos: ocupados, agora: AGORA });
  assert.deepEqual(lista[0], { hora: "09:00", barbeiroId: "diego" });
});

test("CT11 – próximo horário livre pula domingo e segunda", () => {
  const sabadoNoite = new Date(2026, 10, 14, 20, 0);
  const p = A.proximoHorarioLivre({ config: DADOS, duracao: 30, agendamentos: [], agora: sabadoNoite });
  assert.equal(p.data, "2026-11-17"); // terça
  assert.equal(p.hora, "09:00");
});

test("CT12 – RN07: validação de telefone", () => {
  assert.ok(A.telefoneValido("(11) 91234-5678"));
  assert.ok(A.telefoneValido("+55 11 91234-5678"));
  assert.ok(A.telefoneValido("1132345678"));
  assert.ok(!A.telefoneValido("91234-5678"));   // sem DDD
  assert.ok(!A.telefoneValido("11 81234-5678")); // celular sem 9
  assert.ok(!A.telefoneValido("abc"));
});

test("CT13 – validação aponta cada campo inválido", () => {
  const r = A.validarAgendamento({}, { config: DADOS, agendamentos: [], agora: AGORA });
  assert.equal(r.ok, false);
  for (const campo of ["servico", "barbeiro", "data", "hora", "nome", "telefone", "consentimento"]) {
    assert.ok(r.erros[campo], "faltou erro em " + campo);
  }
});

test("CT14 – pedido válido passa; o mesmo horário já ocupado é recusado", () => {
  const pedido = { servicoId: "corte", barbeiroId: "rafael", data: "2026-11-10", hora: "10:00",
    nome: "Bruno", telefone: "11 91234-5678", consentimento: true };
  assert.equal(A.validarAgendamento(pedido, { config: DADOS, agendamentos: [], agora: AGORA }).ok, true);
  const r = A.validarAgendamento(pedido, { config: DADOS, agendamentos: [ag({})], agora: AGORA });
  assert.equal(r.ok, false);
  assert.match(r.erros.hora, /não está mais disponível/);
});

test("CT15 – RN06: código no formato PF-XXXX e sem repetir", () => {
  let n = 0;
  const seq = () => [0, 0, 0, 0, 0.5, 0.5, 0.5, 0.5][n++ % 8];
  const c = A.gerarCodigo([{ codigo: "PF-AAAA" }], seq);
  assert.match(c, /^PF-[A-Z2-9]{4}$/);
  assert.notEqual(c, "PF-AAAA");
});

test("CT16 – criarAgendamento grava duração, preço e telefone normalizado", () => {
  const pedido = { servicoId: "corte-barba", barbeiroId: "diego", data: "2026-11-10", hora: "11:00",
    nome: "  Caio ", telefone: "(11) 98888-7777", consentimento: true };
  const a = A.criarAgendamento(pedido, { config: DADOS, agendamentos: [], agora: AGORA });
  assert.equal(a.duracao, 60);
  assert.equal(a.preco, 70);
  assert.equal(a.cliente.nome, "Caio");
  assert.equal(a.cliente.telefone, "11988887777");
  assert.equal(a.status, "confirmado");
});

test("CT17 – RN05: cancelamento só até 2 h antes", () => {
  const a = ag({ hora: "10:00" });
  assert.equal(A.podeCancelar(a, new Date(2026, 10, 10, 8, 0), DADOS), true);
  assert.equal(A.podeCancelar(a, new Date(2026, 10, 10, 8, 1), DADOS), false);
  assert.equal(A.podeCancelar(ag({ status: "cancelado" }), AGORA, DADOS), false);
});

test("CT18 – consulta por telefone ignora formatação e ordena por data", () => {
  const lista = [ag({ codigo: "B", data: "2026-11-12" }), ag({ codigo: "A", data: "2026-11-11" }),
    ag({ codigo: "X", cliente: { nome: "Outro", telefone: "11900000000" } })];
  const r = A.agendamentosDoCliente(lista, "(11) 91234-5678");
  assert.deepEqual(r.map((a) => a.codigo), ["A", "B"]);
});

test("CT19 – RF10: arquivo .ics com início e fim corretos", () => {
  const ics = A.gerarICS(ag({ hora: "10:00", duracao: 60 }), "Corte e barba", "Rafael", "Barbearia Pente Fino");
  assert.match(ics, /DTSTART:20261110T100000/);
  assert.match(ics, /DTEND:20261110T110000/);
  assert.match(ics, /SUMMARY:Corte e barba com Rafael/);
});
