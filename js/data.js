// Fictional demo data (people, phones, cars and store are invented). Mirrors app/seed.py.
import { normalizePhone, SAMPLE_TEMPLATE } from './rules.js';

const CARS = [
  ['Fiat', 'Argo', 'Drive 1.3', 2020, 48000, 58900, 51200, 57800], ['Chevrolet', 'Onix', 'LT 1.0 Turbo', 2021, 36500, 67500, 59000, 66300],
  ['Volkswagen', 'Polo', 'Highline 200 TSI', 2020, 52000, 79900, 70100, 77500], ['Hyundai', 'HB20', 'Comfort 1.0', 2019, 61000, 52900, 46800, 51900],
  ['Toyota', 'Corolla', 'XEi 2.0', 2019, 70200, 104900, 93500, 101200], ['Honda', 'Civic', 'EXL 2.0', 2018, 82000, 92000, 84700, 90500],
  ['Jeep', 'Renegade', 'Longitude 1.8', 2019, 66000, 84900, 76000, 83100], ['Renault', 'Kwid', 'Zen 1.0', 2022, 24000, 45900, 40300, 45200],
  ['Ford', 'Ka', 'SE 1.0', 2018, 74000, 43500, 38900, 42100], ['Volkswagen', 'T-Cross', 'Sense 200 TSI', 2021, 31000, 99900, 89600, 97400],
  ['Fiat', 'Mobi', 'Like 1.0', 2021, 29500, 44900, 39100, 44000], ['Chevrolet', 'Tracker', 'Premier 1.2 Turbo', 2022, 22000, 119900, 108000, 116800],
];

const RECEIPT = `RECIBO DE VENDA

Recebi de {comprador_nome} (CPF {comprador_cpf}) a quantia de R$ {valor} ({valor_extenso}), referente à venda do veículo {veiculo}, placa {placa}.

{cidade}, {data}.

______________________________
{loja_nome}
`;

export function seedState(t) {
  const min = 60000, hour = 3600000, day = 86400000;
  const state = {
    version: 1, currentUserId: 1,
    store: { name: 'Auto Horizonte (demo)', slaMinutes: 5, authorityBps: 300,
      legal: { name: 'Auto Horizonte Veículos LTDA (fictícia)', cnpj: '11.222.333/0001-81', address: 'Av. Exemplo, 1000, Centro', city: 'São Paulo/SP', forum: 'São Paulo' } },
    users: [{ id: 1, name: 'Carla Mendes', role: 'OWNER', active: true }, { id: 2, name: 'Rafael Lima', role: 'SELLER', active: true }, { id: 3, name: 'Bianca Rocha', role: 'SELLER', active: true }],
    vehicles: CARS.map(([make, model, version, year, km, price, cost, fipe], i) => ({ id: i + 1, make, model, version, year, km, plate: `DEM${year % 10}${String(i).padStart(2, '0')}`,
      price: price * 100, cost: cost * 100, fipe: fipe * 100, status: 'DISPONIVEL' })),
    leads: [], messages: [], proposals: [], sales: [], contracts: [],
    templates: [{ id: 1, name: 'Venda (modelo de exemplo)', body: SAMPLE_TEMPLATE, active: true, updatedAt: t }, { id: 2, name: 'Recibo simples de venda', body: RECEIPT, active: true, updatedAt: t }],
    seq: { lead: 0, message: 0, proposal: 0, sale: 0, contract: 0, template: 2 },
  };
  const car = (n) => state.vehicles[n];
  const addLead = (name, phone, source, stage, ownerId, vehicleN, createdMinAgo, firstReplyAfter = null, nextInHours = null, note = '', lastActivityMinAgo = null, inbound = '') => {
    const created = t - createdMinAgo * min;
    const l = { id: ++state.seq.lead, name, phone: normalizePhone(phone), source, stage, ownerId, vehicleId: vehicleN === null ? null : car(vehicleN).id, nextActionAt: nextInHours === null ? null : t + nextInHours * hour,
      nextActionNote: note, firstResponseAt: firstReplyAfter === null ? null : created + firstReplyAfter * min, lastActivityAt: t - (lastActivityMinAgo ?? createdMinAgo) * min, lostReason: '', createdAt: created };
    state.leads.push(l);
    if (inbound) state.messages.push({ id: ++state.seq.message, leadId: l.id, direction: 'IN', channel: source, body: inbound, status: '', userId: null, at: created });
    if (firstReplyAfter !== null) state.messages.push({ id: ++state.seq.message, leadId: l.id, direction: 'OUT', channel: 'WHATSAPP', body: `Olá, ${name.split(' ')[0]}! Aqui é da loja. Posso te ajudar?`, status: 'SIMULADO', userId: ownerId, at: created + firstReplyAfter * min });
    return l;
  };
  addLead('Marcos Andrade', '(11) 99876-1100', 'WEBMOTORS', 'NOVO', 2, 1, 3, null, null, '', null, 'Olá, ainda está disponível? Aceita troca?');
  addLead('Juliana Prado', '(11) 98123-4400', 'OLX', 'NOVO', 3, 0, 22, null, null, '', null, 'Qual a menor condição à vista?');
  addLead('Eduardo Ferraz', '(21) 99777-0123', 'WHATSAPP', 'NOVO', 2, 4, 95, null, null, '', null, 'Boa tarde, vi a Corolla no site.');
  addLead('Patrícia Gomes', '(11) 97654-3210', 'ICARROS', 'VISITA', 3, 6, 60 * 26, 2, 2, 'Confirmar visita das 17h', 60);
  const roberto = addLead('Roberto Nunes', '(19) 99111-2233', 'SITE', 'PROPOSTA', 2, 9, 60 * 50, 4, -3, 'Retornar com a condição de troca', 60 * 5);
  const camila = addLead('Camila Duarte', '(11) 96655-4433', 'LOJA', 'CONTATO', 3, 2, 60 * 30, 1, 20, 'Ligar amanhã cedo', 60 * 20);
  const gustavo = addLead('Gustavo Pires', '(11) 95544-3322', 'OLX', 'CONTATO', 2, 3, 60 * 24 * 6, 3, null, '', 60 * 24 * 4);
  addLead('Larissa Cunha', '(31) 98877-6655', 'WEBMOTORS', 'CONTATO', 3, 7, 60 * 24 * 5, 6, null, '', 60 * 24 * 3 + 30);
  const henrique = addLead('Henrique Alves', '(11) 94433-2211', 'WHATSAPP', 'VENDIDO', 2, 8, 60 * 24 * 9, 2, null, '', 60 * 24 * 2);
  car(8).status = 'VENDIDO';
  state.sales.push({ id: ++state.seq.sale, leadId: henrique.id, vehicleId: car(8).id, price: 42000 * 100, cost: car(8).cost, sellerId: 2, soldAt: t - 2 * day });
  const lost = addLead('Vinícius Teles', '(11) 93322-1100', 'OLX', 'PERDIDO', 3, 5, 60 * 24 * 8, 5, null, '', 60 * 24 * 6);
  lost.lostReason = 'Comprou em outra loja';
  car(10).status = 'RESERVADO';
  const prop = (l, n, sellerId, offered, status, o) => state.proposals.push({ id: ++state.seq.proposal, leadId: l.id, vehicleId: car(n).id, version: 1, asking: car(n).price, offered: offered * 100,
    down: 0, trade: 0, tradeNote: '', note: status === 'PENDENTE' ? 'Cliente tem proposta de outra loja' : '', status, approvalRequired: o.approval, approvedPrice: status === 'APROVADA' ? offered * 100 : null,
    requestedBy: sellerId, decidedBy: o.decidedBy ?? null, decisionNote: o.note || '', at: t - o.minAgo * min });
  prop(roberto, 9, 2, 94000, 'PENDENTE', { approval: true, minAgo: 35 });
  prop(camila, 2, 3, 78000, 'APROVADA', { approval: false, decidedBy: 3, minAgo: 300 });
  prop(gustavo, 3, 2, 44000, 'RECUSADA', { approval: true, decidedBy: 1, note: 'Abaixo do custo', minAgo: 60 * 24 * 4 });
  return state;
}
