// Lokale Nederlandse tekst-naar-spraak met Piper (open source, draait op de CPU).

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { PIPER_BIN, PIPER_SPEED, voicePath } from './paths.js';
import { encodeWav } from './wav.js';

let sampleRate: number | null = null;

function voiceSampleRate(): number {
  sampleRate ??= (JSON.parse(fs.readFileSync(voicePath() + '.json', 'utf8')) as { audio?: { sample_rate?: number } }).audio?.sample_rate ?? 22050;
  return sampleRate;
}

/** Maakt tekst geschikt om voor te lezen (geen markdown, regeleinden of losse tekens). */
export function speakable(text: string): string {
  return text
    .replace(/[*_#`>|]/g, ' ')
    .replace(/\[(TEST)\]\s*/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 1500);
}

export function synthesize(text: string, timeoutMs = 20000): Promise<Buffer> {
  const input = speakable(text);
  if (!input) return Promise.reject(new Error('Lege tekst.'));
  return new Promise((resolve, reject) => {
    const proc = spawn(PIPER_BIN, ['--model', voicePath(), '--output_raw', '--quiet', '--length_scale', String(1 / PIPER_SPEED)], {
      cwd: path.dirname(PIPER_BIN),
      env: { ...process.env, LD_LIBRARY_PATH: path.dirname(PIPER_BIN) },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const chunks: Buffer[] = [];
    let stderr = '';
    const timer = setTimeout(() => proc.kill('SIGKILL'), timeoutMs);
    proc.stdout.on('data', (c: Buffer) => chunks.push(c));
    proc.stderr.on('data', (c: Buffer) => (stderr += c.toString()));
    proc.on('error', (e) => {
      clearTimeout(timer);
      reject(e);
    });
    proc.on('close', (code) => {
      clearTimeout(timer);
      const pcm = Buffer.concat(chunks);
      if (code !== 0 || pcm.length === 0) reject(new Error(`Piper faalde (code ${code}): ${stderr.slice(0, 200)}`));
      else resolve(encodeWav(pcm, voiceSampleRate()));
    });
    proc.stdin.end(input + '\n');
  });
}
