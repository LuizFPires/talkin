/**
 * Interpretador da busca livre (SPEC 16). Separa o texto em tema + filtros
 * (obra, participante, plataforma, período, tipo) usando o cadastro real da
 * empresa, e devolve os chips "Entendi assim". Puro e determinístico.
 */

export type Cadastro = {
  obras: { id: string; name: string }[];
  participantes: { id: string; name: string }[];
  tipos: { key: string; name: string }[];
};

export type Periodo = { label: string; from?: string; to?: string };

export type FiltrosBusca = {
  obra?: { id: string; name: string };
  participante?: { id: string; name: string };
  plataforma?: string;
  tipo?: { key: string; name: string };
  periodo?: Periodo;
};

export type ChipBusca = {
  tipo: 'tema' | 'obra' | 'participante' | 'plataforma' | 'periodo' | 'tipo';
  label: string;
};

export type BuscaInterpretada = {
  tema: string;
  filtros: FiltrosBusca;
  chips: ChipBusca[];
};

const PLATAFORMAS = ['presencial', 'meet', 'teams', 'zoom', 'whatsapp'] as const;

const MESES: Record<string, number> = {
  janeiro: 0,
  fevereiro: 1,
  março: 2,
  marco: 2,
  abril: 3,
  maio: 4,
  junho: 5,
  julho: 6,
  agosto: 7,
  setembro: 8,
  outubro: 9,
  novembro: 10,
  dezembro: 11,
};

const STOPWORDS = new Set([
  'a',
  'o',
  'as',
  'os',
  'de',
  'do',
  'da',
  'dos',
  'das',
  'e',
  'em',
  'no',
  'na',
  'nos',
  'nas',
  'com',
  'para',
  'por',
  'que',
  'sobre',
  'um',
  'uma',
  'ao',
  'reunião',
  'reuniao',
  'reunioes',
  'reuniões',
]);

function norm(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Reconhece o período em linguagem natural, relativo a `agora`. */
function acharPeriodo(textoNorm: string, agora: Date): Periodo | undefined {
  if (/\bhoje\b/.test(textoNorm)) {
    const d = iso(agora);
    return { label: 'hoje', from: d, to: d };
  }
  if (/\bontem\b/.test(textoNorm)) {
    const o = new Date(agora);
    o.setDate(o.getDate() - 1);
    const d = iso(o);
    return { label: 'ontem', from: d, to: d };
  }
  if (/\b(esta|essa)\s+semana\b/.test(textoNorm) || /\bsemana\b/.test(textoNorm)) {
    const ini = new Date(agora);
    ini.setDate(ini.getDate() - ((ini.getDay() + 6) % 7)); // segunda
    return { label: 'esta semana', from: iso(ini), to: iso(agora) };
  }
  if (/\b(este|esse)\s+m[eê]s\b/.test(textoNorm)) {
    const ini = new Date(agora.getFullYear(), agora.getMonth(), 1);
    return { label: 'este mês', from: iso(ini), to: iso(agora) };
  }
  for (const [nome, mes] of Object.entries(MESES)) {
    if (new RegExp(`\\b${nome}\\b`).test(textoNorm)) {
      const ano = mes > agora.getMonth() ? agora.getFullYear() - 1 : agora.getFullYear();
      const ini = new Date(ano, mes, 1);
      const fim = new Date(ano, mes + 1, 0);
      return { label: nome, from: iso(ini), to: iso(fim) };
    }
  }
  return undefined;
}

export function interpretarBusca(
  texto: string,
  cadastro: Cadastro,
  agora: Date = new Date(),
): BuscaInterpretada {
  const textoNorm = norm(texto);
  const consumido = new Set<string>(); // termos já atribuídos a um filtro
  const filtros: FiltrosBusca = {};
  const chips: ChipBusca[] = [];

  function marcarConsumido(nome: string) {
    for (const w of norm(nome).split(/\s+/)) consumido.add(w);
  }

  // Plataforma
  for (const p of PLATAFORMAS) {
    if (new RegExp(`\\b${p}\\b`).test(textoNorm)) {
      filtros.plataforma = p;
      consumido.add(p);
      chips.push({ tipo: 'plataforma', label: p });
      break;
    }
  }

  // Obra (projeto cadastrado)
  for (const o of cadastro.obras) {
    if (textoNorm.includes(norm(o.name))) {
      filtros.obra = o;
      marcarConsumido(o.name);
      chips.push({ tipo: 'obra', label: o.name });
      break;
    }
  }

  // Participante (pessoa cadastrada)
  for (const p of cadastro.participantes) {
    if (textoNorm.includes(norm(p.name))) {
      filtros.participante = p;
      marcarConsumido(p.name);
      chips.push({ tipo: 'participante', label: p.name });
      break;
    }
  }

  // Tipo de reunião (modelo)
  for (const t of cadastro.tipos) {
    if (textoNorm.includes(norm(t.name)) || new RegExp(`\\b${norm(t.key)}\\b`).test(textoNorm)) {
      filtros.tipo = t;
      marcarConsumido(t.name);
      consumido.add(norm(t.key));
      chips.push({ tipo: 'tipo', label: t.name });
      break;
    }
  }

  // Período
  const periodo = acharPeriodo(textoNorm, agora);
  if (periodo) {
    filtros.periodo = periodo;
    for (const w of norm(periodo.label).split(/\s+/)) consumido.add(w);
    chips.push({ tipo: 'periodo', label: periodo.label });
  }

  // Tema: o que sobra, sem stopwords nem termos consumidos
  const tema = textoNorm
    .split(/\s+/)
    .filter((w) => w && !STOPWORDS.has(w) && !consumido.has(w))
    .join(' ')
    .trim();
  if (tema) chips.unshift({ tipo: 'tema', label: tema });

  return { tema, filtros, chips };
}
