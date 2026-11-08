/*
 * agenda.js — Regras de negócio do agendamento (funções puras).
 *
 * Nenhuma função aqui acessa a tela (DOM) nem o armazenamento: recebem dados,
 * devolvem resultados. Por isso podem ser testadas automaticamente com
 * `node --test` (tests/agenda.test.js), como manda a Etapa 8 do guia.
 *
 * Convenções: datas no formato "AAAA-MM-DD" e horas "HH:MM", sempre no
 * horário local de quem usa o site.
 */
(function (raiz) {
  "use strict";

  // ---------- conversões ----------
  function paraMinutos(hora) {
    var p = hora.split(":");
    return Number(p[0]) * 60 + Number(p[1]);
  }

  function paraHora(minutos) {
    var h = Math.floor(minutos / 60), m = minutos % 60;
    return (h < 10 ? "0" : "") + h + ":" + (m < 10 ? "0" : "") + m;
  }

  function paraData(dataISO, hora) {
    var d = dataISO.split("-").map(Number);
    var h = hora ? hora.split(":").map(Number) : [0, 0];
    return new Date(d[0], d[1] - 1, d[2], h[0], h[1], 0, 0);
  }

  function dataISO(data) {
    var m = data.getMonth() + 1, d = data.getDate();
    return data.getFullYear() + "-" + (m < 10 ? "0" : "") + m + "-" + (d < 10 ? "0" : "") + d;
  }

  function somarDias(dataStr, dias) {
    var d = paraData(dataStr);
    d.setDate(d.getDate() + dias);
    return dataISO(d);
  }

  // ---------- RN01: funcionamento ----------
  function expediente(dataStr, config) {
    return config.funcionamento[paraData(dataStr).getDay()] || null;
  }

  function barbeiroTrabalha(barbeiro, dataStr) {
    return barbeiro.folgas.indexOf(paraData(dataStr).getDay()) === -1;
  }

  // ---------- RN04: conflito de horário ----------
  function sobrepoe(inicioA, durA, inicioB, durB) {
    return inicioA < inicioB + durB && inicioB < inicioA + durA;
  }

  function ocupado(agendamentos, barbeiroId, dataStr, inicioMin, duracao) {
    return agendamentos.some(function (a) {
      return a.status === "confirmado" &&
        a.barbeiroId === barbeiroId &&
        a.data === dataStr &&
        sobrepoe(paraMinutos(a.hora), a.duracao, inicioMin, duracao);
    });
  }

  // ---------- RN02 + RN03 + RN04: horários livres de um barbeiro ----------
  function horariosDisponiveis(params) {
    var cfg = params.config, regras = cfg.regras;
    var barbeiro = params.barbeiro, dataStr = params.data, duracao = params.duracao;
    var agora = params.agora;
    var exp = expediente(dataStr, cfg);
    if (!exp || !barbeiroTrabalha(barbeiro, dataStr)) return [];

    var limite = paraData(dataISO(agora));
    limite.setDate(limite.getDate() + regras.janelaDias);
    if (paraData(dataStr) > limite) return [];

    var minimo = agora.getTime() + regras.antecedenciaMinMin * 60000;
    var livres = [];
    for (var t = paraMinutos(exp.abre); t + duracao <= paraMinutos(exp.fecha); t += regras.intervaloMin) {
      var hora = paraHora(t);
      if (paraData(dataStr, hora).getTime() < minimo) continue;
      if (ocupado(params.agendamentos, barbeiro.id, dataStr, t, duracao)) continue;
      livres.push(hora);
    }
    return livres;
  }

  // "Qualquer barbeiro": devolve [{hora, barbeiroId}] usando o primeiro barbeiro livre
  function horariosQualquerBarbeiro(params) {
    var porHora = {};
    params.config.barbeiros.forEach(function (b) {
      horariosDisponiveis({
        config: params.config, barbeiro: b, data: params.data,
        duracao: params.duracao, agendamentos: params.agendamentos, agora: params.agora
      }).forEach(function (h) {
        if (!porHora[h]) porHora[h] = b.id;
      });
    });
    return Object.keys(porHora).sort().map(function (h) { return { hora: h, barbeiroId: porHora[h] }; });
  }

  // Próximo horário livre (usado no topo da página)
  function proximoHorarioLivre(params) {
    var hoje = dataISO(params.agora);
    for (var i = 0; i <= params.config.regras.janelaDias; i++) {
      var dia = somarDias(hoje, i);
      var lista = horariosQualquerBarbeiro({
        config: params.config, data: dia, duracao: params.duracao,
        agendamentos: params.agendamentos, agora: params.agora
      });
      if (lista.length) return { data: dia, hora: lista[0].hora, barbeiroId: lista[0].barbeiroId };
    }
    return null;
  }

  // ---------- RN07: telefone ----------
  function normalizarTelefone(texto) {
    return String(texto || "").replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
  }

  function telefoneValido(texto) {
    var t = normalizarTelefone(texto);
    if (!/^\d{10,11}$/.test(t)) return false;
    if (Number(t.slice(0, 2)) < 11) return false;          // DDD válido: 11 a 99
    if (t.length === 11 && t[2] !== "9") return false;     // celular começa com 9
    return true;
  }

  // ---------- validação completa de um pedido ----------
  function validarAgendamento(pedido, ctx) {
    var erros = {};
    var servico = ctx.config.servicos.filter(function (s) { return s.id === pedido.servicoId; })[0];
    var barbeiro = ctx.config.barbeiros.filter(function (b) { return b.id === pedido.barbeiroId; })[0];

    if (!servico) erros.servico = "Escolha um serviço.";
    if (!barbeiro) erros.barbeiro = "Escolha um barbeiro.";
    if (!pedido.data) erros.data = "Escolha um dia.";
    if (!pedido.hora) erros.hora = "Escolha um horário.";
    if (!pedido.nome || pedido.nome.trim().length < 2) erros.nome = "Informe seu nome.";
    if (!telefoneValido(pedido.telefone)) erros.telefone = "Informe um telefone com DDD, por exemplo (11) 91234-5678.";
    if (!pedido.consentimento) erros.consentimento = "Autorize o uso dos dados para concluir o agendamento.";

    if (servico && barbeiro && pedido.data && pedido.hora) {
      var livres = horariosDisponiveis({
        config: ctx.config, barbeiro: barbeiro, data: pedido.data,
        duracao: servico.duracao, agendamentos: ctx.agendamentos, agora: ctx.agora
      });
      if (livres.indexOf(pedido.hora) === -1) erros.hora = "Esse horário não está mais disponível. Escolha outro.";
    }
    return { ok: Object.keys(erros).length === 0, erros: erros };
  }

  // ---------- RN06: código único ----------
  var ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sem 0/O e 1/I, que confundem

  function gerarCodigo(existentes, aleatorio) {
    aleatorio = aleatorio || Math.random;
    var usados = {};
    existentes.forEach(function (a) { usados[a.codigo] = true; });
    for (var tentativa = 0; tentativa < 1000; tentativa++) {
      var c = "PF-";
      for (var i = 0; i < 4; i++) c += ALFABETO[Math.floor(aleatorio() * ALFABETO.length)];
      if (!usados[c]) return c;
    }
    throw new Error("Não foi possível gerar um código único.");
  }

  function criarAgendamento(pedido, ctx, aleatorio) {
    var servico = ctx.config.servicos.filter(function (s) { return s.id === pedido.servicoId; })[0];
    return {
      codigo: gerarCodigo(ctx.agendamentos, aleatorio),
      servicoId: servico.id,
      barbeiroId: pedido.barbeiroId,
      data: pedido.data,
      hora: pedido.hora,
      duracao: servico.duracao,
      preco: servico.preco,
      cliente: { nome: pedido.nome.trim(), telefone: normalizarTelefone(pedido.telefone) },
      status: "confirmado",
      criadoEm: ctx.agora.toISOString()
    };
  }

  // ---------- RN05: cancelamento ----------
  function podeCancelar(ag, agora, config) {
    if (ag.status !== "confirmado") return false;
    var inicio = paraData(ag.data, ag.hora).getTime();
    return inicio - agora.getTime() >= config.regras.cancelamentoMinHoras * 3600000;
  }

  function agendamentosDoCliente(agendamentos, telefone) {
    var t = normalizarTelefone(telefone);
    return agendamentos
      .filter(function (a) { return a.cliente.telefone === t; })
      .sort(function (a, b) { return (a.data + a.hora).localeCompare(b.data + b.hora); });
  }

  // ---------- RF10: arquivo de calendário (.ics) ----------
  function gerarICS(ag, servicoNome, barbeiroNome, nomeBarbearia) {
    function fmt(d) {
      function z(n) { return (n < 10 ? "0" : "") + n; }
      return d.getFullYear() + z(d.getMonth() + 1) + z(d.getDate()) + "T" + z(d.getHours()) + z(d.getMinutes()) + "00";
    }
    var inicio = paraData(ag.data, ag.hora);
    var fim = new Date(inicio.getTime() + ag.duracao * 60000);
    return [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Pente Fino//Agendamento//PT-BR",
      "BEGIN:VEVENT",
      "UID:" + ag.codigo + "@pentefino.exemplo",
      "DTSTAMP:" + fmt(new Date()),
      "DTSTART:" + fmt(inicio),
      "DTEND:" + fmt(fim),
      "SUMMARY:" + servicoNome + " com " + barbeiroNome + " – " + nomeBarbearia,
      "DESCRIPTION:Código do agendamento: " + ag.codigo,
      "END:VEVENT", "END:VCALENDAR"
    ].join("\r\n");
  }

  var Agenda = {
    paraMinutos: paraMinutos, paraHora: paraHora, paraData: paraData, dataISO: dataISO, somarDias: somarDias,
    expediente: expediente, barbeiroTrabalha: barbeiroTrabalha, sobrepoe: sobrepoe,
    horariosDisponiveis: horariosDisponiveis, horariosQualquerBarbeiro: horariosQualquerBarbeiro,
    proximoHorarioLivre: proximoHorarioLivre,
    normalizarTelefone: normalizarTelefone, telefoneValido: telefoneValido,
    validarAgendamento: validarAgendamento, gerarCodigo: gerarCodigo, criarAgendamento: criarAgendamento,
    podeCancelar: podeCancelar, agendamentosDoCliente: agendamentosDoCliente, gerarICS: gerarICS
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = Agenda;
  } else {
    raiz.Agenda = Agenda;
  }
})(typeof window !== "undefined" ? window : this);
