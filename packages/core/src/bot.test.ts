import { describe, expect, it } from 'vitest';
import { estimarCustoBotCents, plataformaPorUrl } from './bot';

describe('bot de reunião', () => {
  it('estima custo por hora proporcional', () => {
    expect(estimarCustoBotCents(60, 300)).toBe(300);
    expect(estimarCustoBotCents(30, 300)).toBe(150);
    expect(estimarCustoBotCents(0, 300)).toBe(0);
  });

  it('detecta a plataforma pela URL', () => {
    expect(plataformaPorUrl('https://meet.google.com/abc-defg-hij')).toBe('meet');
    expect(plataformaPorUrl('https://teams.microsoft.com/l/meetup-join/x')).toBe('teams');
    expect(plataformaPorUrl('https://us02web.zoom.us/j/123')).toBe('zoom');
    expect(plataformaPorUrl('https://exemplo.com/x')).toBeNull();
    // Não cai em spoof por substring nem em http.
    expect(plataformaPorUrl('https://meet.google.com.evil.com/x')).toBeNull();
    expect(plataformaPorUrl('http://meet.google.com/x')).toBeNull();
  });
});
