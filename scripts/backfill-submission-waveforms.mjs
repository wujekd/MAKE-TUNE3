import { createRequire } from 'module';
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, join, basename } from 'path';
import { tmpdir } from 'os';
import { randomBytes } from 'crypto';
import { promises as fs } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const requireFromFunctions = createRequire(join(__dirname, '../functions/package.json'));

const adminAppEntry = requireFromFunctions.resolve('firebase-admin/app');
const adminFsEntry = requireFromFunctions.resolve('firebase-admin/firestore');
const adminStorageEntry = requireFromFunctions.resolve('firebase-admin/storage');
const ffmpegEntry = requireFromFunctions.resolve('fluent-ffmpeg');
const ffmpegStaticEntry = requireFromFunctions.resolve('ffmpeg-static');

const { initializeApp, applicationDefault } = await import(pathToFileURL(adminAppEntry).href);
const { getFirestore, Timestamp } = await import(pathToFileURL(adminFsEntry).href);
const { getStorage } = await import(pathToFileURL(adminStorageEntry).href);
const ffmpegModule = await import(pathToFileURL(ffmpegEntry).href);
const ffmpegStaticModule = await import(pathToFileURL(ffmpegStaticEntry).href);

const ffmpeg = ffmpegModule.default || ffmpegModule;
const ffmpegStatic = ffmpegStaticModule.default || ffmpegStaticModule;

const WAVEFORM_VERSION = 1;
const SUBMISSION_WAVEFORM_BUCKET_COUNT = 512;
const WAVEFORM_PREVIEW_BUCKET_COUNT = 128;

if (ffmpegStatic) {
  ffmpeg.setFfmpegPath(ffmpegStatic);
}

const args = process.argv.slice(2);
const options = {
  collabId: null,
  bucket: null,
  force: false,
  limit: null,
  dryRun: false
};

for (let i = 0; i < args.length; i += 1) {
  const arg = args[i];
  if (arg === '--collab' && args[i + 1]) {
    options.collabId = args[i + 1];
    i += 1;
    continue;
  }
  if (arg === '--bucket' && args[i + 1]) {
    options.bucket = args[i + 1];
    i += 1;
    continue;
  }
  if (arg === '--limit' && args[i + 1]) {
    options.limit = Number(args[i + 1]);
    i += 1;
    continue;
  }
  if (arg === '--force') {
    options.force = true;
    continue;
  }
  if (arg === '--dry-run') {
    options.dryRun = true;
    continue;
  }
  if (arg === '--help' || arg === '-h') {
    printUsage();
    process.exit(0);
  }
}

function printUsage() {
  console.log(`Usage: node scripts/backfill-submission-waveforms.mjs [options]

Options:
  --collab <id>   Backfill only one collaboration
  --bucket <name> Use an explicit Firebase Storage bucket
  --limit <n>     Stop after processing n submissions
  --force         Regenerate even if waveformPath already exists
  --dry-run       Log planned changes without writing files or Firestore
  -h, --help      Show this help
`);
}

async function readEnvFile(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    const values = {};
    for (const rawLine of content.split('\n')) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const separatorIndex = line.indexOf('=');
      if (separatorIndex === -1) continue;
      const key = line.slice(0, separatorIndex).trim();
      const value = line.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, '');
      if (key) values[key] = value;
    }
    return values;
  } catch {
    return {};
  }
}

async function resolveStorageBucket() {
  if (options.bucket) {
    return String(options.bucket).trim();
  }

  const envLocal = await readEnvFile(join(__dirname, '../make-tune3-react/.env.local'));
  const env = await readEnvFile(join(__dirname, '../make-tune3-react/.env'));
  return String(
    envLocal.VITE_FIREBASE_STORAGE_BUCKET ||
    env.VITE_FIREBASE_STORAGE_BUCKET ||
    process.env.FIREBASE_STORAGE_BUCKET ||
    process.env.VITE_FIREBASE_STORAGE_BUCKET ||
    ''
  ).trim();
}

const storageBucket = await resolveStorageBucket();

if (!storageBucket) {
  console.error(
    'No storage bucket found. Pass --bucket <name> or set VITE_FIREBASE_STORAGE_BUCKET in make-tune3-react/.env.local or .env.'
  );
  process.exit(1);
}

initializeApp({
  credential: applicationDefault(),
  storageBucket
});

const db = getFirestore();
const storage = getStorage();
const bucket = storage.bucket(storageBucket);

function roundWaveformNumber(value, digits = 6) {
  return Number(value.toFixed(digits));
}

function parseMonoPcm16Wav(buffer) {
  if (buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error('invalid wav container');
  }

  let offset = 12;
  let audioFormat = 0;
  let numChannels = 0;
  let sampleRate = 0;
  let bitsPerSample = 0;
  let dataOffset = -1;
  let dataSize = 0;

  while (offset + 8 <= buffer.length) {
    const chunkId = buffer.toString('ascii', offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);
    const chunkDataOffset = offset + 8;

    if (chunkId === 'fmt ') {
      audioFormat = buffer.readUInt16LE(chunkDataOffset);
      numChannels = buffer.readUInt16LE(chunkDataOffset + 2);
      sampleRate = buffer.readUInt32LE(chunkDataOffset + 4);
      bitsPerSample = buffer.readUInt16LE(chunkDataOffset + 14);
    } else if (chunkId === 'data') {
      dataOffset = chunkDataOffset;
      dataSize = chunkSize;
    }

    offset = chunkDataOffset + chunkSize + (chunkSize % 2);
  }

  if (audioFormat !== 1) {
    throw new Error(`unsupported wav audio format: ${audioFormat}`);
  }
  if (numChannels !== 1) {
    throw new Error(`expected mono wav, got ${numChannels} channels`);
  }
  if (bitsPerSample !== 16) {
    throw new Error(`expected 16-bit wav, got ${bitsPerSample}-bit`);
  }
  if (dataOffset < 0 || dataSize <= 0) {
    throw new Error('wav data chunk missing');
  }

  const sampleCount = Math.floor(dataSize / 2);
  const samples = new Int16Array(sampleCount);
  for (let i = 0; i < sampleCount; i += 1) {
    samples[i] = buffer.readInt16LE(dataOffset + i * 2);
  }

  return { sampleRate, samples };
}

function buildWaveformPayload(samples, sampleRate, bucketCount, fileName) {
  const framesPerBucket = Math.max(1, Math.floor(samples.length / bucketCount));
  const minPeaks = new Array(bucketCount);
  const maxPeaks = new Array(bucketCount);
  let globalPeak = 0;

  for (let i = 0; i < bucketCount; i += 1) {
    const start = i * framesPerBucket;
    const end = i === bucketCount - 1 ? samples.length : Math.min(samples.length, start + framesPerBucket);
    let min = 1;
    let max = -1;

    for (let j = start; j < end; j += 1) {
      const sample = samples[j] / 32768;
      if (sample < min) min = sample;
      if (sample > max) max = sample;
    }

    if (end <= start) {
      min = 0;
      max = 0;
    }

    minPeaks[i] = min;
    maxPeaks[i] = max;
    globalPeak = Math.max(globalPeak, Math.abs(min), Math.abs(max));
  }

  if (globalPeak > 0) {
    for (let i = 0; i < bucketCount; i += 1) {
      minPeaks[i] /= globalPeak;
      maxPeaks[i] /= globalPeak;
    }
  }

  return {
    version: WAVEFORM_VERSION,
    generator: 'submission-backfill-script',
    fileName,
    duration: roundWaveformNumber(sampleRate > 0 ? samples.length / sampleRate : 0, 4),
    sampleRate,
    channels: 1,
    channelMode: 'mono',
    normalize: true,
    bucketCount,
    framesPerBucket,
    peaks: {
      min: minPeaks.map(value => roundWaveformNumber(value)),
      max: maxPeaks.map(value => roundWaveformNumber(value))
    }
  };
}

function buildWaveformPreview(payload) {
  const sourceMin = Array.isArray(payload?.peaks?.min) ? payload.peaks.min : [];
  const sourceMax = Array.isArray(payload?.peaks?.max) ? payload.peaks.max : [];
  const sourceCount = Math.min(sourceMin.length, sourceMax.length);
  const bucketCount = WAVEFORM_PREVIEW_BUCKET_COUNT;
  const minPeaks = new Array(bucketCount).fill(0);
  const maxPeaks = new Array(bucketCount).fill(0);

  if (sourceCount <= 0) {
    return {
      bucketCount,
      version: payload?.version ?? WAVEFORM_VERSION,
      peaks: { min: minPeaks, max: maxPeaks }
    };
  }

  for (let i = 0; i < bucketCount; i += 1) {
    const start = Math.floor((i * sourceCount) / bucketCount);
    const end = Math.max(start + 1, Math.floor(((i + 1) * sourceCount) / bucketCount));
    let min = 1;
    let max = -1;

    for (let j = start; j < Math.min(end, sourceCount); j += 1) {
      min = Math.min(min, sourceMin[j]);
      max = Math.max(max, sourceMax[j]);
    }

    minPeaks[i] = roundWaveformNumber(min === 1 ? 0 : min);
    maxPeaks[i] = roundWaveformNumber(max === -1 ? 0 : max);
  }

  return {
    bucketCount,
    version: payload?.version ?? WAVEFORM_VERSION,
    peaks: {
      min: minPeaks,
      max: maxPeaks
    }
  };
}

async function convertObjectToMonoWav({ sourcePath, wavPath }) {
  const sourceFile = bucket.file(sourcePath);
  await sourceFile.download({ destination: wavPath.replace(/\.wav$/, '.src') });
  const inputPath = wavPath.replace(/\.wav$/, '.src');

  try {
    await new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .outputOptions(['-ac 1', '-ar 22050', '-f wav', '-acodec pcm_s16le'])
        .save(wavPath)
        .on('end', resolve)
        .on('error', reject);
    });
  } finally {
    await fs.rm(inputPath, { force: true });
  }
}

async function generateSubmissionWaveform({ collabId, submission }) {
  const submissionId = String(submission?.submissionId || '').trim();
  const submissionPath = String(submission?.path || '').trim();
  if (!submissionId || !submissionPath) {
    throw new Error('submission missing submissionId or path');
  }

  const tmpBase = `submission-waveform-${collabId}-${submissionId}-${Date.now()}-${randomBytes(4).toString('hex')}`;
  const wavPath = join(tmpdir(), `${tmpBase}.wav`);
  const waveformPath = `collabs/${collabId}/waveforms/submission-${submissionId}.json`;

  try {
    await convertObjectToMonoWav({ sourcePath: submissionPath, wavPath });
    const wavBuffer = await fs.readFile(wavPath);
    const { sampleRate, samples } = parseMonoPcm16Wav(wavBuffer);
    const payload = buildWaveformPayload(
      samples,
      sampleRate,
      SUBMISSION_WAVEFORM_BUCKET_COUNT,
      basename(submissionPath)
    );

    if (!options.dryRun) {
      await bucket.file(waveformPath).save(JSON.stringify(payload), {
        contentType: 'application/json; charset=utf-8',
        resumable: false,
        public: false,
        metadata: {
          cacheControl: 'public,max-age=31536000,immutable'
        }
      });
    }

    return {
      waveformPath,
      waveformBucketCount: payload.bucketCount,
      waveformVersion: payload.version,
      waveformError: null,
      waveformStatus: 'ready',
      waveformPreview: buildWaveformPreview(payload)
    };
  } finally {
    await fs.rm(wavPath, { force: true });
  }
}

async function readWaveformPreviewFromPath(waveformPathRaw) {
  const waveformPath = String(waveformPathRaw || '').trim();
  if (!waveformPath) {
    throw new Error('waveformPath required');
  }

  const [buffer] = await bucket.file(waveformPath).download();
  const payload = JSON.parse(buffer.toString('utf8'));
  return buildWaveformPreview(payload);
}

async function readExistingWaveformPreview(submission) {
  return readWaveformPreviewFromPath(submission?.waveformPath);
}

function hasValidWaveformPreview(submission) {
  return hasValidPreview(submission?.waveformPreview);
}

function hasValidPreview(preview) {
  return (
    preview?.bucketCount === WAVEFORM_PREVIEW_BUCKET_COUNT &&
    Array.isArray(preview?.peaks?.min) &&
    Array.isArray(preview?.peaks?.max) &&
    preview.peaks.min.length === WAVEFORM_PREVIEW_BUCKET_COUNT &&
    preview.peaks.max.length === WAVEFORM_PREVIEW_BUCKET_COUNT
  );
}

async function run() {
  const detailRefs = [];

  if (options.collabId) {
    detailRefs.push(db.collection('collaborationDetails').doc(options.collabId));
  } else {
    const snap = await db.collection('collaborationDetails').get();
    for (const doc of snap.docs) {
      detailRefs.push(doc.ref);
    }
  }

  let processed = 0;
  let generated = 0;
  let previewed = 0;
  let backingPreviewed = 0;
  let skipped = 0;
  let failed = 0;

  for (const detailRef of detailRefs) {
    const snap = await detailRef.get();
    if (!snap.exists) continue;

    const detailData = snap.data() || {};
    const collabId = String(detailData.collaborationId || snap.id);
    const submissions = Array.isArray(detailData.submissions) ? [...detailData.submissions] : [];
    if (submissions.length === 0) continue;

    let changed = false;

    for (let i = 0; i < submissions.length; i += 1) {
      const submission = submissions[i];
      processed += 1;

      if (options.limit && processed > options.limit) break;

      const hasWaveform = Boolean(String(submission?.waveformPath || '').trim());
      if (hasWaveform && !options.force) {
        if (hasValidWaveformPreview(submission)) {
          skipped += 1;
          continue;
        }

        try {
          console.log(`[submission-waveforms] deriving preview ${collabId}/${submission?.submissionId || 'unknown'}`);
          submissions[i] = {
            ...submission,
            waveformPreview: await readExistingWaveformPreview(submission)
          };
          changed = true;
          previewed += 1;
        } catch (error) {
          failed += 1;
          const message = error instanceof Error ? error.message : String(error);
          console.error(
            `[submission-waveforms] preview failed ${collabId}/${submission?.submissionId || 'unknown'}: ${message}`
          );
        }
        continue;
      }

      try {
        console.log(`[submission-waveforms] generating ${collabId}/${submission?.submissionId || 'unknown'}`);
        const nextFields = await generateSubmissionWaveform({ collabId, submission });
        submissions[i] = {
          ...submission,
          ...nextFields
        };
        changed = true;
        generated += 1;
      } catch (error) {
        failed += 1;
        const message = error instanceof Error ? error.message : String(error);
        console.error(
          `[submission-waveforms] failed ${collabId}/${submission?.submissionId || 'unknown'}: ${message}`
        );
        if (options.force || !hasWaveform) {
          submissions[i] = {
            ...submission,
            waveformStatus: 'failed',
            waveformError: message.slice(0, 500)
          };
          changed = true;
        }
      }
    }

    if (changed && !options.dryRun) {
      await detailRef.set(
        {
          submissions,
          updatedAt: Timestamp.now()
        },
        { merge: true }
      );
    }

    if (options.limit && processed >= options.limit) {
      break;
    }
  }

  const collabRefs = [];
  if (options.collabId) {
    collabRefs.push(db.collection('collaborations').doc(options.collabId));
  } else {
    const snap = await db.collection('collaborations').get();
    for (const doc of snap.docs) {
      collabRefs.push(doc.ref);
    }
  }

  for (const collabRef of collabRefs) {
    const snap = await collabRef.get();
    if (!snap.exists) continue;

    const collab = snap.data() || {};
    const waveformPath = String(collab.backingWaveformPath || '').trim();
    if (!waveformPath || hasValidPreview(collab.backingWaveformPreview)) {
      continue;
    }

    try {
      console.log(`[submission-waveforms] deriving backing preview ${snap.id}`);
      const backingWaveformPreview = await readWaveformPreviewFromPath(waveformPath);
      if (!options.dryRun) {
        await collabRef.set(
          {
            backingWaveformPreview,
            updatedAt: Timestamp.now()
          },
          { merge: true }
        );
      }
      backingPreviewed += 1;
    } catch (error) {
      failed += 1;
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[submission-waveforms] backing preview failed ${snap.id}: ${message}`);
    }
  }

  console.log(
    `[submission-waveforms] done processed=${processed} generated=${generated} previewed=${previewed} backingPreviewed=${backingPreviewed} skipped=${skipped} failed=${failed} dryRun=${options.dryRun}`
  );
}

run().catch(error => {
  console.error(error);
  process.exit(1);
});
