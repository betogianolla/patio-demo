// Pure business rules, ported 1:1 from app/domain.py and app/contract_rules.py (same known-result tests).
export const STAGES = ['NOVO', 'CONTATO', 'VISITA', 'PROPOSTA', 'VENDIDO', 'PERDIDO'];
export const OPEN_STAGES = ['NOVO', 'CONTATO', 'VISITA', 'PROPOSTA'];
export const STAGE_LABELS = { NOVO: 'Novo', CONTATO: 'Em contato', VISITA: 'Visita', PROPOSTA: 'Proposta', VENDIDO: 'Vendido', PERDIDO: 'Perdido' };
export const SOURCES = ['WHATSAPP', 'WEBMOTORS', 'OLX', 'ICARROS', 'SITE', 'LOJA', 'INDICACAO'];
export const SOURCE_LABELS = { WHATSAPP: 'WhatsApp', WEBMOTORS: 'Webmotors', OLX: 'OLX', ICARROS: 'iCarros', SITE: 'Site', LOJA: 'Balcão', INDICACAO: 'Indicação' };
export const STALE_DAYS = 3;
export const MAX_TEMPLATES = 10;

// --- phone -------------------------------------------------------------------------------------
export function normalizePhone(raw) {
  let d = String(raw || '').replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('55') && (d.length === 12 || d.length === 13)) d = d.slice(2);
  if ((d.length === 11 || d.length === 12) && d.startsWith('0')) d = d.replace(/^0+/, '');
  if (d.length !== 10 && d.length !== 11) return null;
  const ddd = d.slice(0, 2), num = d.slice(2);
  if (!(ddd >= '11' && ddd <= '99') || ddd.endsWith('0')) return null;
  if (num.length === 9 && num[0] !== '9') return null;
  if (num.length === 8 && '01'.includes(num[0])) return null;
  return '55' + d;
}
export function formatPhone(n) {
  const d = n.startsWith('55') ? n.slice(2) : n;
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return n;
}

// --- money -------------------------------------------------------------------------------------
export function parseBrl(text) {
  const c = String(text || '').replace(/R\$|\s/gi, '');
  if (!c) return null;
  if (c.includes(',')) {
    const i = c.lastIndexOf(',');
    const whole = c.slice(0, i).replace(/\./g, ''), frac = c.slice(i + 1);
    if (!(/^\d+$/.test(whole) && /^\d+$/.test(frac) && frac.length <= 2)) return null;
    return parseInt(whole, 10) * 100 + parseInt(frac.padEnd(2, '0'), 10);
  }
  const cc = /^\d{1,3}(\.\d{3})+$/.test(c) ? c.replace(/\./g, '') : c;
  return /^\d+$/.test(cc) ? parseInt(cc, 10) * 100 : null;
}
const thousands = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
export function formatBrl(cents) {
  if (cents === null || cents === undefined) return '—';
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  return `${sign}R$ ${thousands(Math.floor(abs / 100))},${String(abs % 100).padStart(2, '0')}`;
}
export const formatNumber = (cents) => formatBrl(cents).replace('R$ ', '');
export function margin(price, cost) {
  const abs = price - cost;
  return [abs, price ? Math.round((abs * 1000) / price) / 10 : null];
}
export function fipeGapPct(price, fipe) {
  return fipe ? Math.round(((price - fipe) * 1000) / fipe) / 10 : null;
}

// --- negotiation -------------------------------------------------------------------------------
export const DEFAULT_AUTHORITY_BPS = 300;
export function discountPct(asking, offered) {
  return asking ? Math.round(((asking - offered) * 1000) / asking) / 10 : 0;
}
// Integer math: exactly at the limit needs no approval; one cent below does.
export const needsApproval = (asking, offered, bps) => offered * 10000 < asking * (10000 - bps);
export const lowestPriceWithoutApproval = (asking, bps) => Math.ceil((asking * (10000 - bps)) / 10000);
export function validateProposal(offered, down, trade) {
  if (!offered || offered <= 0) return 'Informe o valor oferecido.';
  if (down < 0 || trade < 0) return 'Entrada e valor da troca não podem ser negativos.';
  if (down + trade > offered) return 'Entrada somada à troca não pode passar do valor oferecido.';
  return null;
}

// --- time / urgency ----------------------------------------------------------------------------
export const minutesBetween = (a, b) => Math.floor((b - a) / 60000);
export function slaBreached(created, firstResponse, now, slaMinutes) {
  return ((firstResponse ?? now) - created) > slaMinutes * 60000;
}
export const isStale = (last, now, days = STALE_DAYS) => now - last >= days * 86400000;
export function urgency(next, now, dayEnd) {
  if (!next) return 'ok';
  if (next <= now) return 'late';
  return next < dayEnd ? 'today' : 'ok';
}
export function validateTransition(current, target, { hasVehicle, priceCents, lostReason }) {
  if (!STAGES.includes(target)) return 'Etapa inválida.';
  if (current === 'VENDIDO' || current === 'PERDIDO') return 'Lead encerrado não pode mudar de etapa.';
  if (target === current) return 'O lead já está nesta etapa.';
  if (target === 'PERDIDO' && !String(lostReason || '').trim()) return 'Informe o motivo da perda.';
  if (target === 'VENDIDO') {
    if (!hasVehicle) return 'Vincule o veículo vendido antes de marcar como vendido.';
    if (!priceCents || priceCents <= 0) return 'Informe o preço final da venda.';
  }
  return null;
}
export const TEMPLATES = {
  primeiro: 'Olá, {nome}! Aqui é da loja. Vi seu interesse no {veiculo}. Posso te ajudar? Quer agendar uma visita?',
  visita: 'Oi, {nome}! Tudo certo para sua visita para ver o {veiculo}. Qual horário fica melhor para você?',
  retorno: 'Oi, {nome}! Passando para saber se ficou alguma dúvida sobre o {veiculo}. Posso fazer uma condição para você.',
};
export const TEMPLATE_LABELS = { primeiro: 'Primeiro contato', visita: 'Agendar visita', retorno: 'Retorno de proposta' };
export function renderMessageTemplate(key, name, vehicleTitle) {
  const first = String(name || '').split(' ')[0] || 'tudo bem';
  return TEMPLATES[key].replace('{nome}', first).replace('{veiculo}', vehicleTitle || 'carro');
}

// --- documents ---------------------------------------------------------------------------------
const digits = (v) => String(v || '').replace(/\D/g, '');
export function validCpf(value) {
  const d = digits(value);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  for (const size of [9, 10]) {
    let total = 0;
    for (let i = 0; i < size; i++) total += Number(d[i]) * (size + 1 - i);
    if (Number(d[size]) !== ((total * 10) % 11) % 10) return false;
  }
  return true;
}
function cnpjDigit(ds, weights) {
  const r = ds.split('').reduce((s, ch, i) => s + Number(ch) * weights[i], 0) % 11;
  return r < 2 ? 0 : 11 - r;
}
export function validCnpj(value) {
  const d = digits(value);
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  const first = cnpjDigit(d.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const second = cnpjDigit(d.slice(0, 13), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return d.slice(12) === `${first}${second}`;
}
export function formatCpf(v) { const d = digits(v); return d.length === 11 ? `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}` : String(v || '').trim(); }
export function formatCnpj(v) { const d = digits(v); return d.length === 14 ? `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}` : String(v || '').trim(); }

// --- amount in words ---------------------------------------------------------------------------
const UNITS = ['zero', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
const TENS = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
const HUNDREDS = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];
function belowThousand(n) {
  if (n === 100) return 'cem';
  const parts = [];
  if (n >= 100) { parts.push(HUNDREDS[Math.floor(n / 100)]); n %= 100; }
  if (n) parts.push(n < 20 ? UNITS[n] : TENS[Math.floor(n / 10)] + (n % 10 ? ` e ${UNITS[n % 10]}` : ''));
  return parts.join(' e ');
}
export function integerInWords(n) {
  if (!(n >= 0 && n < 1e12)) throw new RangeError('out of range');
  if (n === 0) return 'zero';
  const groups = [];
  let lastValue = 0;
  for (const [size, one, many] of [[1e9, 'bilhão', 'bilhões'], [1e6, 'milhão', 'milhões'], [1000, 'mil', 'mil']]) {
    const count = Math.floor(n / size);
    n %= size;
    if (count) {
      groups.push(size === 1000 && count === 1 ? 'mil' : `${belowThousand(count)} ${count === 1 ? one : many}`);
      lastValue = count;
    }
  }
  if (n) { groups.push(belowThousand(n)); lastValue = n; }
  if (groups.length === 1) return groups[0];
  const joiner = lastValue < 100 || lastValue % 100 === 0 ? ' e ' : ' ';
  return groups.slice(0, -1).join(' ') + joiner + groups[groups.length - 1];
}
export function brlInWords(cents) {
  const abs = Math.abs(cents), reais = Math.floor(abs / 100), centavos = abs % 100;
  const parts = [];
  if (reais || !centavos) parts.push(`${integerInWords(reais)}${reais && reais % 1e6 === 0 ? ' de' : ''} ${reais === 1 ? 'real' : 'reais'}`);
  if (centavos) parts.push(`${integerInWords(centavos)} ${centavos === 1 ? 'centavo' : 'centavos'}`);
  return parts.join(' e ');
}

// --- contract templates ------------------------------------------------------------------------
export const CONTRACT_FIELDS = {
  comprador_nome: 'Nome do comprador', comprador_cpf: 'CPF do comprador', comprador_rg: 'RG do comprador',
  comprador_endereco: 'Endereço do comprador', comprador_telefone: 'Telefone do comprador', comprador_email: 'E-mail do comprador',
  loja_nome: 'Razão social/nome da loja', loja_cnpj: 'CNPJ da loja', loja_endereco: 'Endereço da loja', cidade: 'Cidade/UF', foro: 'Foro (comarca)',
  veiculo: 'Marca, modelo, versão e ano', placa: 'Placa', km: 'Quilometragem', valor: 'Valor total (número)', valor_extenso: 'Valor total por extenso',
  entrada: 'Entrada (número)', troca: 'Valor do veículo na troca (número)', troca_descricao: 'Descrição do veículo na troca',
  saldo: 'Saldo a pagar (número)', forma_pagamento: 'Forma de pagamento do saldo', data: 'Data da venda', vendedor_nome: 'Nome do vendedor',
};
export const RECOMMENDED = ['comprador_nome', 'veiculo', 'valor'];
export const BLANK = '____________________';
export const unknownPlaceholders = (body) => [...new Set([...body.matchAll(/\{([A-Za-z_]+)\}/g)].map((m) => m[1]).filter((n) => !(n in CONTRACT_FIELDS)))].sort();
export const missingRecommended = (body) => RECOMMENDED.filter((n) => !body.includes(`{${n}}`));
export function templateWarnings(body) {
  const w = [];
  const unknown = unknownPlaceholders(body), missing = missingRecommended(body);
  if (unknown.length) w.push('Campos desconhecidos (ficarão como digitados): ' + unknown.map((n) => `{${n}}`).join(', '));
  if (missing.length) w.push('Campos usuais ausentes: ' + missing.map((n) => `{${n}}`).join(', '));
  return w;
}
export const fillContract = (body, values) =>
  body.replace(/\{([A-Za-z_]+)\}/g, (m, name) => (name in CONTRACT_FIELDS ? (values[name] || BLANK) : m));

export const SAMPLE_TEMPLATE = `CONTRATO PARTICULAR DE COMPRA E VENDA DE VEÍCULO USADO

VENDEDORA: {loja_nome}, CNPJ {loja_cnpj}, com sede em {loja_endereco}, neste ato representada por {vendedor_nome}.

COMPRADOR(A): {comprador_nome}, CPF {comprador_cpf}, RG {comprador_rg}, residente em {comprador_endereco}, telefone {comprador_telefone}, e-mail {comprador_email}.

CLÁUSULA 1ª — OBJETO. A VENDEDORA vende ao(à) COMPRADOR(A) o veículo {veiculo}, placa {placa}, com {km} km, no estado em que se encontra, conforme vistoria realizada e aceita pelo(a) COMPRADOR(A).

CLÁUSULA 2ª — PREÇO E PAGAMENTO. O preço total é de R$ {valor} ({valor_extenso}), a ser pago da seguinte forma: entrada de R$ {entrada}; veículo recebido na troca ({troca_descricao}) avaliado em R$ {troca}; saldo de R$ {saldo}, {forma_pagamento}.

CLÁUSULA 3ª — DOCUMENTAÇÃO E TRANSFERÊNCIA. A VENDEDORA entrega o veículo com a documentação necessária à transferência. O(A) COMPRADOR(A) providenciará a transferência de propriedade no prazo legal, responsabilizando-se por multas e infrações a partir da data da entrega.

CLÁUSULA 4ª — GARANTIA. A garantia observa a legislação vigente e os termos eventualmente informados por escrito pela VENDEDORA.

CLÁUSULA 5ª — FORO. Fica eleito o foro da comarca de {foro} para dirimir quaisquer questões decorrentes deste contrato.

{cidade}, {data}.


______________________________
VENDEDORA: {loja_nome}

______________________________
COMPRADOR(A): {comprador_nome}

TESTEMUNHAS:
1) ______________________________ CPF ______________
2) ______________________________ CPF ______________
`;
