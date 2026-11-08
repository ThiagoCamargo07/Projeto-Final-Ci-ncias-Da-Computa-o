/*
 * dados.js — Dados de configuração da Barbearia Pente Fino (fictícia).
 * Tudo que o dono da barbearia mudaria sem mexer na lógica fica aqui:
 * serviços, preços, barbeiros, horários de funcionamento e regras de prazo.
 * Preços e dados são ILUSTRATIVOS (projeto acadêmico).
 */
(function (raiz) {
  "use strict";

  var DADOS = {
    barbearia: {
      nome: "Barbearia Pente Fino",
      endereco: "Rua Exemplo, 100 – São Paulo/SP (endereço fictício)",
      telefone: "(11) 0000-0000 (fictício)"
    },

    // RF01 — serviços com preço (R$) e duração (minutos)
    servicos: [
      { id: "corte", nome: "Corte", duracao: 30, preco: 45, descricao: "Tesoura ou máquina, com acabamento." },
      { id: "barba", nome: "Barba", duracao: 30, preco: 35, descricao: "Toalha quente, navalha e balm." },
      { id: "corte-barba", nome: "Corte e barba", duracao: 60, preco: 70, descricao: "Os dois serviços na mesma cadeira." },
      { id: "degrade", nome: "Degradê", duracao: 45, preco: 50, descricao: "Transição baixa, média ou alta." },
      { id: "infantil", nome: "Corte infantil", duracao: 30, preco: 40, descricao: "Até 12 anos." },
      { id: "pezinho", nome: "Pezinho", duracao: 15, preco: 15, descricao: "Contorno da nuca e das costeletas." },
      { id: "sobrancelha", nome: "Sobrancelha", duracao: 15, preco: 20, descricao: "Na navalha ou na pinça." },
      { id: "pigmentacao", nome: "Pigmentação de barba", duracao: 45, preco: 50, descricao: "Preenche falhas e uniformiza a cor." }
    ],

    // RF02 — barbeiros; "folgas" usa getDay(): 0 = domingo ... 6 = sábado
    barbeiros: [
      { id: "rafael", nome: "Rafael", especialidade: "Degradê e cortes clássicos", folgas: [3] },
      { id: "diego", nome: "Diego", especialidade: "Barba e navalha", folgas: [4] },
      { id: "marcos", nome: "Marcos", especialidade: "Cortes infantis e tesoura", folgas: [] }
    ],

    // RN01 — funcionamento por dia da semana (dias ausentes = fechado)
    funcionamento: {
      2: { abre: "09:00", fecha: "19:00" },
      3: { abre: "09:00", fecha: "19:00" },
      4: { abre: "09:00", fecha: "19:00" },
      5: { abre: "09:00", fecha: "19:00" },
      6: { abre: "09:00", fecha: "17:00" }
    },

    regras: {
      intervaloMin: 30,          // RN02 — grade de horários de 30 em 30 minutos
      antecedenciaMinMin: 60,    // RN03 — no mínimo 1 hora de antecedência
      janelaDias: 30,            // RN03 — no máximo 30 dias à frente
      cancelamentoMinHoras: 2    // RN05 — cancelar até 2 horas antes
    }
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = DADOS;
  } else {
    raiz.DADOS = DADOS;
  }
})(typeof window !== "undefined" ? window : this);
