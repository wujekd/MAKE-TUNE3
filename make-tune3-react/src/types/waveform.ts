export type WaveformStatus = 'pending' | 'processing' | 'ready' | 'failed';

export interface WaveformAssetMeta {
  path?: string | null;
  status?: WaveformStatus | null;
  bucketCount?: number | null;
  version?: number | null;
  error?: string | null;
}

export interface WaveformData {
  version: number;
  generator: string;
  fileName?: string;
  duration: number;
  sampleRate: number;
  channels: number;
  channelMode?: string;
  normalize?: boolean;
  bucketCount: number;
  framesPerBucket: number;
  peaks: {
    min: number[];
    max: number[];
  };
}
