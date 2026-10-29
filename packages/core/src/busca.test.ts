import { describe, expect, it } from 'vitest';
import { interpretarBusca, type Cadastro } from './busca';

const cadastro: Cadastro = {
  obras: [{ id: 'o1', name: 'Galpão A' }],
  participantes: [{ id: 'p1', name: 'Marcos' }],
  tipos: [
    { key: 'obra', name: 'Reunião de obra' },
    { key: 'visita', name: 'Visita técnica' },
  ],
};

const agora = new Date('2026-10-29T12:00:00-03:00');

describe('interpretarBusca', () => {
  it('separa tema + obra + participante + período (SPEC 16)', () => {
    const r = interpretarBusca('concreto Galpão A com Marcos em outubro', cadastro, agora);
    expect(r.filtros.obra?.name).toBe('Galpão A');
    expect(r.filtros.participante?.name).toBe('Marcos');
    expect(r.filtros.periodo?.label).toBe('outubro');
    expect(r.tema).toBe('concreto');
    // chip de tema vem primeiro
    expect(r.chips[0]).toEqual({ tipo: 'tema', label: 'concreto' });
  });

  it('reconhece plataforma e período relativo', () => {
    const r = interpretarBusca('ata no Teams esta semana', cadastro, agora);
    expect(r.filtros.plataforma).toBe('teams');
    expect(r.filtros.periodo?.label).toBe('esta semana');
    expect(r.tema).toBe('ata');
  });

  it('sem tema: só filtros (ex.: "Marcos ontem")', () => {
    const r = interpretarBusca('Marcos ontem', cadastro, agora);
    expect(r.tema).toBe('');
    expect(r.filtros.participante?.name).toBe('Marcos');
    expect(r.filtros.periodo?.label).toBe('ontem');
    expect(r.filtros.periodo?.from).toBe('2026-10-28');
  });

  it('calcula o intervalo do mês nomeado', () => {
    const r = interpretarBusca('outubro', cadastro, agora);
    expect(r.filtros.periodo?.from).toBe('2026-10-01');
    expect(r.filtros.periodo?.to).toBe('2026-10-31');
  });
});
