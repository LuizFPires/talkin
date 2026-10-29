import { spawn } from 'node:child_process';
import { writeFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Concatena os blocos de áudio e normaliza o volume com ffmpeg (worker).
 * `chunks` são caminhos locais já baixados do storage, em ordem.
 * Devolve o caminho do arquivo final (m4a mono, normalizado).
 */
export async function concatAndNormalize(chunks: string[]): Promise<string> {
  if (chunks.length === 0) throw new Error('sem blocos de áudio');
  const dir = await mkdtemp(join(tmpdir(), 'talkin-'));
  const listPath = join(dir, 'list.txt');
  await writeFile(listPath, chunks.map((c) => `file '${c.replace(/'/g, "'\\''")}'`).join('\n'));
  const out = join(dir, 'final.m4a');

  await runFfmpeg([
    '-f', 'concat', '-safe', '0', '-i', listPath,
    '-ac', '1', // mono (voz)
    '-af', 'loudnorm', // normalização de volume
    '-c:a', 'aac', '-b:a', '48k',
    '-y', out,
  ]);
  return out;
}

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    proc.stderr.on('data', (d: Buffer) => {
      stderr += d.toString();
    });
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg saiu com código ${code}: ${stderr.slice(-500)}`));
    });
  });
}
