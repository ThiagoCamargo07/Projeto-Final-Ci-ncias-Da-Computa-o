/*
 * app.js — Camada de apresentação: monta a página e liga os eventos.
 * Toda regra de negócio vem de Agenda (agenda.js); todo acesso a dados vem de
 * Armazenamento (armazenamento.js). Este arquivo só cuida da tela.
 */
(function () {
  "use strict";

  var D = window.DADOS, A = window.Agenda, Repo = window.Armazenamento;
  var QUALQUER = "qualquer";
  var DIAS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
  var $ = function (id) { return document.getElementById(id); };

  var estado = { servicoId: null, barbeiroId: null, data: null, hora: null, barbeiroDaHora: null };

  // ---------- formatação ----------
  function inicial(t) { return t.charAt(0).toUpperCase() + t.slice(1); }
  function real(v) { return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }
  function duracaoTexto(min) { return min < 60 ? min + " min" : (min / 60) + " h" + (min % 60 ? " " + (min % 60) + " min" : ""); }
  function horaTexto(h) { var p = h.split(":"); return Number(p[0]) + "h" + (p[1] === "00" ? "" : p[1]); }
  function servico(id) { return D.servicos.filter(function (s) { return s.id === id; })[0]; }
  function barbeiro(id) { return D.barbeiros.filter(function (b) { return b.id === id; })[0]; }

  function diaTexto(dataStr, agora) {
    var hoje = A.dataISO(agora);
    if (dataStr === hoje) return "hoje";
    if (dataStr === A.somarDias(hoje, 1)) return "amanhã";
    var d = A.paraData(dataStr);
    return DIAS[d.getDay()] + ", " + d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  }

  function telefoneTexto(t) {
    return t.length === 11 ? "(" + t.slice(0, 2) + ") " + t.slice(2, 7) + "-" + t.slice(7)
      : "(" + t.slice(0, 2) + ") " + t.slice(2, 6) + "-" + t.slice(6);
  }

  function el(tag, attrs, filhos) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === "texto") n.textContent = attrs[k];
      else if (k === "classe") n.className = attrs[k];
      else n.setAttribute(k, attrs[k]);
    });
    (filhos || []).forEach(function (f) { n.appendChild(f); });
    return n;
  }

  // ---------- conteúdo fixo ----------
  function montarPrecos() {
    var ul = $("lista-precos");
    D.servicos.forEach(function (s) {
      ul.appendChild(el("li", { classe: "item-preco" }, [
        el("span", { classe: "item-preco__nome", texto: s.nome }),
        el("span", { classe: "item-preco__pontos", "aria-hidden": "true" }),
        el("span", { classe: "item-preco__valor", texto: real(s.preco) }),
        el("span", { classe: "item-preco__desc", texto: s.descricao + " " + duracaoTexto(s.duracao) + "." })
      ]));
    });
  }

  function montarBarbeiros() {
    var ul = $("lista-barbeiros");
    D.barbeiros.forEach(function (b) {
      var folga = b.folgas.length ? "Folga às " + b.folgas.map(function (f) { return DIAS[f] + "s"; }).join(" e ") + "." : "Atende todos os dias de funcionamento.";
      ul.appendChild(el("li", { classe: "barbeiro" }, [
        el("span", { classe: "barbeiro__inicial", texto: b.nome[0], "aria-hidden": "true" }),
        el("div", {}, [
          el("p", { classe: "barbeiro__nome", texto: b.nome }),
          el("p", { texto: b.especialidade + ". " + folga })
        ])
      ]));
    });
  }

  function montarOnde() {
    $("endereco").textContent = D.barbearia.endereco;
    $("telefone").textContent = "Telefone " + D.barbearia.telefone;
    var tb = $("tabela-expediente");
    [2, 3, 4, 5, 6, 0, 1].forEach(function (dia) {
      var e = D.funcionamento[dia];
      tb.appendChild(el("tr", {}, [
        el("th", { scope: "row", texto: DIAS[dia][0].toUpperCase() + DIAS[dia].slice(1) }),
        el("td", { texto: e ? horaTexto(e.abre) + " às " + horaTexto(e.fecha) : "Fechado" })
      ]));
    });
  }

  // ---------- formulário ----------
  function radio(nome, valor, rotulo, detalhe, aoMudar) {
    var input = el("input", { type: "radio", name: nome, value: valor, id: nome + "-" + valor });
    input.addEventListener("change", aoMudar);
    var lab = el("label", { "for": nome + "-" + valor, classe: "opcao" }, [
      input,
      el("span", { classe: "opcao__nome", texto: rotulo }),
      el("span", { classe: "opcao__detalhe", texto: detalhe })
    ]);
    return lab;
  }

  function montarOpcoes() {
    var cs = $("opcoes-servico");
    D.servicos.forEach(function (s) {
      cs.appendChild(radio("servico", s.id, s.nome, real(s.preco) + " · " + duracaoTexto(s.duracao), function () {
        estado.servicoId = s.id; limparErro("servico"); atualizarHorarios();
      }));
    });
    var cb = $("opcoes-barbeiro");
    cb.appendChild(radio("barbeiro", QUALQUER, "Qualquer um", "Primeiro livre", function () {
      estado.barbeiroId = QUALQUER; limparErro("barbeiro"); atualizarHorarios();
    }));
    D.barbeiros.forEach(function (b) {
      cb.appendChild(radio("barbeiro", b.id, b.nome, b.especialidade, function () {
        estado.barbeiroId = b.id; limparErro("barbeiro"); atualizarHorarios();
      }));
    });

    var agora = new Date();
    var campoData = $("campo-data");
    campoData.min = A.dataISO(agora);
    campoData.max = A.somarDias(A.dataISO(agora), D.regras.janelaDias);
    campoData.addEventListener("change", function () {
      estado.data = campoData.value || null; limparErro("data"); atualizarHorarios();
    });
  }

  function listaDeHorarios(agora) {
    var s = servico(estado.servicoId);
    var ags = Repo.carregar();
    if (estado.barbeiroId === QUALQUER) {
      return A.horariosQualquerBarbeiro({ config: D, data: estado.data, duracao: s.duracao, agendamentos: ags, agora: agora });
    }
    return A.horariosDisponiveis({ config: D, barbeiro: barbeiro(estado.barbeiroId), data: estado.data,
      duracao: s.duracao, agendamentos: ags, agora: agora })
      .map(function (h) { return { hora: h, barbeiroId: estado.barbeiroId }; });
  }

  function atualizarHorarios() {
    var caixa = $("horarios");
    caixa.innerHTML = "";
    estado.hora = null; estado.barbeiroDaHora = null;
    if (!estado.servicoId || !estado.barbeiroId || !estado.data) {
      caixa.appendChild(el("p", { classe: "dica", texto: "Escolha serviço, barbeiro e dia para ver os horários livres." }));
      atualizarResumo(); return;
    }
    var agora = new Date();
    if (!A.expediente(estado.data, D)) {
      caixa.appendChild(el("p", { classe: "dica", texto: "Fechado neste dia. Escolha de terça a sábado." }));
      atualizarResumo(); return;
    }
    var lista = listaDeHorarios(agora);
    if (!lista.length) {
      var b = estado.barbeiroId !== QUALQUER ? barbeiro(estado.barbeiroId) : null;
      var motivo = b && !A.barbeiroTrabalha(b, estado.data) ? b.nome + " está de folga neste dia." : "Não há horários livres neste dia.";
      caixa.appendChild(el("p", { classe: "dica", texto: motivo + " Tente outro dia ou outro barbeiro." }));
      atualizarResumo(); return;
    }
    caixa.appendChild(el("p", { classe: "horarios__titulo", texto: lista.length + " horários livres em " + diaTexto(estado.data, agora) }));
    var grade = el("div", { classe: "horarios__grade", role: "group", "aria-label": "Horários livres" });
    lista.forEach(function (item) {
      var bt = el("button", { type: "button", classe: "hora", "aria-pressed": "false", texto: horaTexto(item.hora) });
      bt.addEventListener("click", function () {
        Array.prototype.forEach.call(grade.children, function (o) { o.setAttribute("aria-pressed", "false"); });
        bt.setAttribute("aria-pressed", "true");
        estado.hora = item.hora; estado.barbeiroDaHora = item.barbeiroId;
        limparErro("hora"); atualizarResumo();
      });
      grade.appendChild(bt);
    });
    caixa.appendChild(grade);
    atualizarResumo();
  }

  function atualizarResumo() {
    var r = $("resumo");
    if (!estado.servicoId || !estado.hora) { r.textContent = ""; return; }
    var s = servico(estado.servicoId), b = barbeiro(estado.barbeiroDaHora);
    r.textContent = s.nome + " com " + b.nome + ", " + diaTexto(estado.data, new Date()) + " às " + horaTexto(estado.hora) + " · " + real(s.preco);
  }

  function mostrarErros(erros) {
    ["servico", "barbeiro", "data", "hora", "nome", "telefone", "consentimento"].forEach(function (c) {
      $("erro-" + c).textContent = erros[c] || "";
    });
  }
  function limparErro(c) { $("erro-" + c).textContent = ""; }

  function enviar(ev) {
    ev.preventDefault();
    var agora = new Date();
    var ags = Repo.carregar();
    var pedido = {
      servicoId: estado.servicoId,
      barbeiroId: estado.barbeiroDaHora || (estado.barbeiroId !== QUALQUER ? estado.barbeiroId : null),
      data: estado.data, hora: estado.hora,
      nome: $("campo-nome").value, telefone: $("campo-telefone").value,
      consentimento: $("campo-consentimento").checked
    };
    var v = A.validarAgendamento(pedido, { config: D, agendamentos: ags, agora: agora });
    if (estado.barbeiroId === QUALQUER && !estado.hora) v.erros.barbeiro = undefined;
    mostrarErros(v.erros);
    if (!v.ok) {
      var primeiro = document.querySelector(".erro:not(:empty)");
      if (primeiro) primeiro.closest("fieldset").scrollIntoView({ behavior: "smooth", block: "start" });
      if (v.erros.hora && estado.hora) atualizarHorarios();
      return;
    }
    var novo = Repo.adicionar(A.criarAgendamento(pedido, { config: D, agendamentos: ags, agora: agora }));
    confirmar(novo);
    atualizarProximo();
  }

  function confirmar(ag) {
    var s = servico(ag.servicoId), b = barbeiro(ag.barbeiroId);
    var quando = diaTexto(ag.data, new Date()) + " às " + horaTexto(ag.hora);
    $("conf-codigo").textContent = ag.codigo;
    $("conf-texto").textContent = s.nome + " com " + b.nome + ", " + quando + ". Valor " + real(s.preco) +
      ", pago no balcão. Chegue 5 minutos antes. Para cancelar, use \"Meus horários\" até 2 horas antes.";
    var ics = A.gerarICS(ag, s.nome, b.nome, D.barbearia.nome);
    $("conf-ics").href = "data:text/calendar;charset=utf-8," + encodeURIComponent(ics);
    var msg = "Agendei na " + D.barbearia.nome + ": " + s.nome + " com " + b.nome + ", " + quando + ". Código " + ag.codigo + ".";
    $("conf-whats").href = "https://wa.me/?text=" + encodeURIComponent(msg);
    $("form-agendar").hidden = true;
    var c = $("confirmacao"); c.hidden = false; c.focus();
  }

  function novoAgendamento() {
    var f = $("form-agendar");
    f.reset();
    estado = { servicoId: null, barbeiroId: null, data: null, hora: null, barbeiroDaHora: null };
    mostrarErros({}); atualizarHorarios();
    $("confirmacao").hidden = true; f.hidden = false;
    $("titulo-agendar").scrollIntoView({ behavior: "smooth" });
  }

  // ---------- próximo horário livre (topo) ----------
  var sugestao = null;
  function atualizarProximo() {
    var agora = new Date();
    sugestao = A.proximoHorarioLivre({ config: D, duracao: 30, agendamentos: Repo.carregar(), agora: agora });
    var valor = $("proximo-valor"), bt = $("proximo-agendar");
    if (!sugestao) { valor.textContent = "Agenda cheia nos próximos 30 dias."; bt.hidden = true; return; }
    valor.textContent = inicial(diaTexto(sugestao.data, agora)) + ", " + horaTexto(sugestao.hora) + " com " + barbeiro(sugestao.barbeiroId).nome;
    bt.hidden = false;
  }

  function usarSugestao() {
    if (!sugestao) return;
    var marcar = function (nome, valor) {
      var r = document.getElementById(nome + "-" + valor); r.checked = true; r.dispatchEvent(new Event("change"));
    };
    if (!$("form-agendar").hidden) {
      marcar("servico", "corte");
      marcar("barbeiro", sugestao.barbeiroId);
      $("campo-data").value = sugestao.data; estado.data = sugestao.data; atualizarHorarios();
      var alvo = Array.prototype.filter.call(document.querySelectorAll(".hora"), function (b) { return b.textContent === horaTexto(sugestao.hora); })[0];
      if (alvo) alvo.click();
    }
    $("titulo-agendar").scrollIntoView({ behavior: "smooth" });
    $("campo-nome").focus({ preventScroll: true });
  }

  // ---------- meus horários ----------
  function consultar(ev) {
    if (ev) ev.preventDefault();
    var tel = $("consulta-telefone").value, ul = $("lista-meus");
    ul.innerHTML = "";
    if (!A.telefoneValido(tel)) { $("erro-consulta").textContent = "Informe o celular com DDD usado no agendamento."; return; }
    $("erro-consulta").textContent = "";
    var agora = new Date();
    var lista = A.agendamentosDoCliente(Repo.carregar(), tel);
    if (!lista.length) {
      ul.appendChild(el("li", { classe: "dica", texto: "Nenhum agendamento com esse celular neste navegador." }));
      return;
    }
    lista.forEach(function (ag) {
      var s = servico(ag.servicoId), b = barbeiro(ag.barbeiroId);
      var passado = A.paraData(ag.data, ag.hora) < agora;
      var situacao = ag.status === "cancelado" ? "Cancelado" : passado ? "Realizado" : "Confirmado";
      var li = el("li", { classe: "meu meu--" + situacao.toLowerCase() }, [
        el("p", { classe: "meu__linha", texto: inicial(diaTexto(ag.data, agora)) + ", " + horaTexto(ag.hora) + " – " + s.nome + " com " + b.nome }),
        el("p", { classe: "meu__meta", texto: situacao + " · código " + ag.codigo + " · " + telefoneTexto(ag.cliente.telefone) })
      ]);
      if (A.podeCancelar(ag, agora, D)) {
        var bt = el("button", { type: "button", classe: "botao botao--linha botao--pequeno", texto: "Cancelar agendamento" });
        bt.addEventListener("click", function () {
          Repo.cancelar(ag.codigo, new Date());
          consultar(); atualizarProximo();
          $("erro-consulta").textContent = "";
          $("lista-meus").insertBefore(el("li", { classe: "aviso", texto: "Agendamento " + ag.codigo + " cancelado. O horário foi liberado." }), $("lista-meus").firstChild);
        });
        li.appendChild(bt);
      } else if (situacao === "Confirmado") {
        li.appendChild(el("p", { classe: "dica", texto: "Faltam menos de 2 horas: para cancelar, ligue para a barbearia." }));
      }
      ul.appendChild(li);
    });
  }

  // ---------- início ----------
  montarPrecos(); montarBarbeiros(); montarOnde(); montarOpcoes(); atualizarHorarios(); atualizarProximo();
  $("form-agendar").addEventListener("submit", enviar);
  $("form-consulta").addEventListener("submit", consultar);
  $("proximo-agendar").addEventListener("click", usarSugestao);
  $("conf-novo").addEventListener("click", novoAgendamento);
})();
