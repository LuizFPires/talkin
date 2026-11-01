import { describe, expect, it } from 'vitest';
import {
  custoRealBotCents,
  estimarCustoBotCents,
  extrairMidiaRecall,
  plataformaPorUrl,
  statusPorEventoRecall,
  urlDeMidiaPermitida,
  verificarAssinaturaSvix,
} from './bot';

describe('bot de reunião', () => {
  it('estima custo por hora proporcional', () => {
    expect(estimarCustoBotCents(60, 300)).toBe(300);
    expect(estimarCustoBotCents(30, 300)).toBe(150);
    expect(estimarCustoBotCents(0, 300)).toBe(0);
  });

  it('custo real pelo tempo em chamada, arredondado ao minuto', () => {
    expect(custoRealBotCents('2026-11-01T12:00:00Z', '2026-11-01T12:30:00Z', 150)).toBe(75);
    expect(custoRealBotCents('2026-11-01T12:00:00Z', '2026-11-01T12:00:10Z', 150)).toBe(3); // 1 min
    expect(custoRealBotCents(null, '2026-11-01T12:00:00Z', 150)).toBeNull();
    expect(custoRealBotCents('2026-11-01T12:30:00Z', '2026-11-01T12:00:00Z', 150)).toBeNull();
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

  it('mapeia eventos do Recall para o status do Talkin', () => {
    expect(statusPorEventoRecall('bot.joining_call')).toBe('entrando');
    expect(statusPorEventoRecall('bot.in_waiting_room')).toBe('entrando');
    expect(statusPorEventoRecall('bot.in_call_recording')).toBe('gravando');
    expect(statusPorEventoRecall('bot.call_ended')).toBe('saiu');
    expect(statusPorEventoRecall('bot.done')).toBe('saiu');
    expect(statusPorEventoRecall('bot.fatal')).toBe('erro');
    expect(statusPorEventoRecall('bot.breakout_room_entered')).toBeNull();
    expect(statusPorEventoRecall('qualquer.coisa')).toBeNull();
  });

  it('só baixa mídia de hosts do Recall/S3 em https', () => {
    expect(urlDeMidiaPermitida('https://recallai-prod.s3.amazonaws.com/x.mp3?X-Amz=1')).toBe(true);
    expect(urlDeMidiaPermitida('https://us-east-1.recall.ai/media/x')).toBe(true);
    expect(urlDeMidiaPermitida('http://recallai-prod.s3.amazonaws.com/x.mp3')).toBe(false);
    expect(urlDeMidiaPermitida('https://evil.com/amazonaws.com/x')).toBe(false);
    expect(urlDeMidiaPermitida('https://169.254.169.254/latest')).toBe(false);
  });

  it('extrai o áudio misturado do JSON do bot (prefere mp3, cai para mp4)', () => {
    const url = 'https://recallai-prod.s3.amazonaws.com/a.mp3';
    const bot = {
      recordings: [
        {
          started_at: '2026-11-01T12:00:00Z',
          completed_at: '2026-11-01T12:20:00Z',
          media_shortcuts: {
            video_mixed: { data: { download_url: 'https://recallai-prod.s3.amazonaws.com/v.mp4' } },
            audio_mixed: { data: { download_url: url } },
          },
        },
      ],
    };
    expect(extrairMidiaRecall(bot)).toEqual({
      downloadUrl: url,
      formato: 'mp3',
      startedAt: '2026-11-01T12:00:00Z',
      completedAt: '2026-11-01T12:20:00Z',
    });
    const soVideo = {
      recordings: [
        {
          media_shortcuts: {
            video_mixed: { data: { download_url: 'https://recallai-prod.s3.amazonaws.com/v.mp4' } },
          },
        },
      ],
    };
    expect(extrairMidiaRecall(soVideo)?.formato).toBe('mp4');
    expect(extrairMidiaRecall({ recordings: [] })).toBeNull();
    // URL fora dos hosts permitidos é descartada.
    expect(
      extrairMidiaRecall({
        recordings: [
          { media_shortcuts: { audio_mixed: { data: { download_url: 'https://evil.com/a' } } } },
        ],
      }),
    ).toBeNull();
  });

  it('verifica a assinatura Svix do webhook', async () => {
    // Segredo de teste (não é real): bytes conhecidos em base64.
    const secret = 'whsec_' + btoa('segredo-de-teste-32-bytes-xxxxxx');
    const id = 'msg_123';
    const timestamp = '1761998400';
    const corpo = '{"event":"bot.done","data":{"bot":{"id":"b1"}}}';
    // Calcula a assinatura esperada com o mesmo algoritmo (WebCrypto).
    const k = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode('segredo-de-teste-32-bytes-xxxxxx'),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const sig = await crypto.subtle.sign(
      'HMAC',
      k,
      new TextEncoder().encode(`${id}.${timestamp}.${corpo}`),
    );
    const b64 = btoa(String.fromCharCode(...new Uint8Array(sig)));
    const agoraS = Number(timestamp) + 10;

    await expect(
      verificarAssinaturaSvix({ id, timestamp, signature: `v1,${b64}`, corpo, secret, agoraS }),
    ).resolves.toBe(true);
    // várias assinaturas no cabeçalho (rotação de segredo)
    await expect(
      verificarAssinaturaSvix({
        id,
        timestamp,
        signature: `v1,abc v1,${b64}`,
        corpo,
        secret,
        agoraS,
      }),
    ).resolves.toBe(true);
    // corpo alterado, segredo errado, carimbo velho, sem cabeçalho → recusa
    await expect(
      verificarAssinaturaSvix({
        id,
        timestamp,
        signature: `v1,${b64}`,
        corpo: corpo + ' ',
        secret,
        agoraS,
      }),
    ).resolves.toBe(false);
    await expect(
      verificarAssinaturaSvix({
        id,
        timestamp,
        signature: `v1,${b64}`,
        corpo,
        secret: 'whsec_' + btoa('outro'),
        agoraS,
      }),
    ).resolves.toBe(false);
    await expect(
      verificarAssinaturaSvix({
        id,
        timestamp,
        signature: `v1,${b64}`,
        corpo,
        secret,
        agoraS: agoraS + 3600,
      }),
    ).resolves.toBe(false);
    await expect(
      verificarAssinaturaSvix({
        id: null,
        timestamp,
        signature: `v1,${b64}`,
        corpo,
        secret,
        agoraS,
      }),
    ).resolves.toBe(false);
  });
});
