import { describe, expect, it } from 'vitest';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { concatRaw, semFfmpeg } from './audio';

describe('concatRaw (fallback sem ffmpeg)', () => {
  it('junta os bytes dos blocos na ordem e mantém a extensão do primeiro', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'talkin-test-'));
    const a = join(dir, 'chunk-0000.webm');
    const b = join(dir, 'chunk-0001.webm');
    await writeFile(a, Buffer.from([1, 2, 3]));
    await writeFile(b, Buffer.from([4, 5]));
    const out = await concatRaw([a, b]);
    expect(out.endsWith('.webm')).toBe(true);
    expect([...(await readFile(out))]).toEqual([1, 2, 3, 4, 5]);
  });

  it('rejeita lista vazia', async () => {
    await expect(concatRaw([])).rejects.toThrow('sem blocos');
  });
});

describe('semFfmpeg', () => {
  it('reconhece o ENOENT do spawn', () => {
    expect(semFfmpeg(Object.assign(new Error('spawn ffmpeg ENOENT'), { code: 'ENOENT' }))).toBe(
      true,
    );
  });
  it('não confunde outros erros', () => {
    expect(semFfmpeg(new Error('ffmpeg saiu com código 1'))).toBe(false);
    expect(semFfmpeg(null)).toBe(false);
  });
});
