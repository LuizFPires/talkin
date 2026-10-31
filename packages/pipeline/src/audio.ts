import { spawn } from 'node:child_process';
import { writeFile, mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { extname, join } from 'node:path';

/**
 * Concatena os blocos de áudio e normaliza o volume com ffmpeg (worker).
 * `chunks` são caminhos locais já baixados do storage, em ordem.
 * Devolve o caminho do arquivo final (m4a mono, normalizado).
 */
export async function concatAndNormalize(chunks: string[]): Promise<string> {
  if (chunks.length === 0) throw new Error('sem blocos de áudio');
  // Rejeita caminhos capazes de injetar diretivas no arquivo de concat do ffmpeg.
  for (const c of chunks) {
    if (/[\n\r\0']/.test(c)) throw new Error('caminho de bloco inválido');
  }
  const dir = await mkdtemp(join(tmpdir(), 'talkin-'));
  const listPath = join(dir, 'list.txt');
  await writeFile(listPath, chunks.map((c) => `file '${c}'`).join('\n'));
  const out = join(dir, 'final.m4a');

  await runFfmpeg([
    '-protocol_whitelist',
    'file,pipe',
    '-f',
    'concat',
    '-safe',
    '0',
    '-i',
    listPath,
    '-ac',
    '1', // mono (voz)
    '-af',
    'loudnorm', // normalização de volume
    '-c:a',
    'aac',
    '-b:a',
    '48k',
    '-y',
    out,
  ]);
  return out;
}

/**
 * Fallback sem ffmpeg (serverless): concatena os bytes dos blocos na ordem.
 * Blocos do MediaRecorder com timeslice são fragmentos de UM stream (webm/opus
 * ou fMP4): só o primeiro tem cabeçalho, então a junção byte a byte reconstrói
 * o arquivo original. Sem normalização de volume — melhor do que falhar.
 */
export async function concatRaw(chunks: string[]): Promise<string> {
  if (chunks.length === 0) throw new Error('sem blocos de áudio');
  const dir = await mkdtemp(join(tmpdir(), 'talkin-raw-'));
  const ext = extname(chunks[0]!) || '.webm';
  const out = join(dir, `final${ext}`);
  const partes: Buffer[] = [];
  for (const c of chunks) partes.push(await readFile(c));
  await writeFile(out, Buffer.concat(partes));
  return out;
}

/** True quando o erro é "ffmpeg não instalado" (spawn ENOENT), caso do serverless. */
export function semFfmpeg(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: unknown }).code === 'ENOENT'
  );
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
