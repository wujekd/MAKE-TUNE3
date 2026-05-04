import { getStorageBlob } from './storageService';
import type { WaveformData } from '../types/waveform';

const waveformCache = new Map<string, Promise<WaveformData>>();

async function readWaveform(path: string): Promise<WaveformData> {
  const blob = await getStorageBlob(path);
  const text = await blob.text();
  const parsed = JSON.parse(text) as WaveformData;
  if (!parsed || !parsed.peaks || !Array.isArray(parsed.peaks.min) || !Array.isArray(parsed.peaks.max)) {
    throw new Error('invalid waveform payload');
  }
  return parsed;
}

export class WaveformService {
  static async loadWaveform(path: string): Promise<WaveformData> {
    const cleanPath = String(path || '').trim();
    if (!cleanPath) {
      throw new Error('waveform path required');
    }

    const cached = waveformCache.get(cleanPath);
    if (cached) {
      return cached;
    }

    const pending = readWaveform(cleanPath).catch(error => {
      waveformCache.delete(cleanPath);
      throw error;
    });

    waveformCache.set(cleanPath, pending);
    return pending;
  }

  static clear(path?: string | null): void {
    const cleanPath = String(path || '').trim();
    if (!cleanPath) return;
    waveformCache.delete(cleanPath);
  }
}
