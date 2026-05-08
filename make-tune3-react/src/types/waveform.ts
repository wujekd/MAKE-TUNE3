export type WaveformStatus = 'pending' | 'processing' | 'ready' | 'failed';

export interface WaveformAssetMeta {
  path?: string | null;
  status?: WaveformStatus | null;
  bucketCount?: number | null;
  version?: number | null;
  error?: string | null;
}

export interface WaveformPreview {
  bucketCount: 128;
  version?: number;
  peaks: {
    min: number[];
    max: number[];
  };
}

export interface WaveformRenderData {
  version?: number;
  bucketCount: number;
  peaks: {
    min: number[];
    max: number[];
  };
}

export interface WaveformData extends WaveformRenderData {
  version: number;
  generator: string;
  fileName?: string;
  duration: number;
  sampleRate: number;
  channels: number;
  channelMode?: string;
  normalize?: boolean;
  framesPerBucket: number;
}
