/*
 * armazenamento.js — Camada de persistência (padrão Repositório).
 *
 * Nesta versão estática, os agendamentos ficam no localStorage do navegador.
 * Como a tela só conversa com este módulo, trocar o localStorage por uma API
 * com banco de dados no futuro exige mudar apenas este arquivo.
 * Se o navegador bloquear o armazenamento (modo privado, por exemplo), os dados
 * ficam em memória enquanto a página estiver aberta.
 */
(function (raiz) {
  "use strict";

  var CHAVE = "pentefino.agendamentos.v1";
  var memoria = [];

  function carregar() {
    try {
      var bruto = raiz.localStorage.getItem(CHAVE);
      return bruto ? JSON.parse(bruto) : [];
    } catch (e) {
      return memoria.slice();
    }
  }

  function salvarTodos(lista) {
    memoria = lista.slice();
    try {
      raiz.localStorage.setItem(CHAVE, JSON.stringify(lista));
      return true;
    } catch (e) {
      return false;
    }
  }

  function adicionar(agendamento) {
    var lista = carregar();
    lista.push(agendamento);
    salvarTodos(lista);
    return agendamento;
  }

  function cancelar(codigo, quando) {
    var lista = carregar();
    var achou = null;
    lista.forEach(function (a) {
      if (a.codigo === codigo && a.status === "confirmado") {
        a.status = "cancelado";
        a.canceladoEm = quando.toISOString();
        achou = a;
      }
    });
    salvarTodos(lista);
    return achou;
  }

  raiz.Armazenamento = { carregar: carregar, adicionar: adicionar, cancelar: cancelar, CHAVE: CHAVE };
})(window);
