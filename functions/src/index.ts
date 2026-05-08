import {
  onDocumentCreated,
  onDocumentUpdated,
  onDocumentWritten,
  onDocumentDeleted
} from "firebase-functions/v2/firestore";
import { initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";
import { setGlobalOptions } from "firebase-functions";
import { onObjectDeleted, onObjectFinalized } from "firebase-functions/v2/storage";
import { onCall, onRequest, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { getStorage } from "firebase-admin/storage";
import { GoogleAuth } from "google-auth-library";
import * as path from "path";
import * as os from "os";
import * as fs from "fs";
import * as crypto from "crypto";
import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";
import { onSchedule } from "firebase-functions/v2/scheduler";
import {
  INTERACTION_EVENTS_COLLECTION,
  INTERACTION_EVENT_TYPES,
  addValueIfMissing,
  buildInteractionEvent,
  removeValueIfPresent,
  setBooleanValue,
  setFinalVote,
  type InteractionEventInput
} from "./interactionEvents.js";
setGlobalOptions({ region: "europe-west1", maxInstances: 10 });

initializeApp();
const db = getFirestore();
const storageAdmin = getStorage();

const HISTORY_LIMIT = 100;
const DEFAULT_WINNER_NAME = "no name";
const ACTIVE_COLLAB_STATUSES = new Set(["submission", "voting"]);
const COLLAB_REACTION_STATUSES = new Set(["published", "submission", "voting", "completed"]);
const PROJECT_DELETION_HISTORY_COLLECTION = "projectDeletionHistory";
const RECOMMENDATIONS_COLLECTION = "recommendations";
const RECOMMENDATION_API_TOKEN = defineSecret("RECOMMENDATION_API_TOKEN");
const HSD_API_TOKEN = defineSecret("HSD_API_TOKEN");
const HSD_SERVICE_URL = defineSecret("HSD_SERVICE_URL");
const HSD_EVENTS_COLLECTION = "hsdEvents";
const HSD_BACKEND_ID = "make-tune3-prod";
const googleAuth = new GoogleAuth();

const BAD = ["foo", "bar"];
const TIER_LIMITS: Record<string, number> = {
  free: 0,
  beta: 3,
  premium: 100
};

interface SystemSettings {
  projectCreationEnabled: boolean;
  submissionsEnabled: boolean;
  votingEnabled: boolean;
  defaultProjectAllowance: number;
  maxSubmissionsPerCollab: number;
  hsdEnabled: boolean;
}

const DEFAULT_SETTINGS: SystemSettings = {
  projectCreationEnabled: true,
  submissionsEnabled: true,
  votingEnabled: true,
  defaultProjectAllowance: 0,
  maxSubmissionsPerCollab: 100,
  hsdEnabled: false
};

const SUBMISSION_RESERVATION_MINUTES = 20;
const BACKING_UPLOAD_RESERVATION_MINUTES = 20;
const SUBMISSION_TOKEN_COLLECTION = "submissionUploadTokens";
const BACKING_TOKEN_COLLECTION = "backingUploadTokens";
const WAVEFORM_VERSION = 1;
const BACKING_WAVEFORM_BUCKET_COUNT = 768;
const SUBMISSION_WAVEFORM_BUCKET_COUNT = 512;
const WAVEFORM_PREVIEW_BUCKET_COUNT = 128;
const ALLOWED_AUDIO_EXTS = new Set([
  "mp3",
  "wav",
  "flac",
  "ogg",
  "m4a",
  "aac",
  "webm",
  "opus"
]);

const DEFAULT_SUBMISSION_SETTINGS = {
  eq: {
    highshelf: { gain: 0, frequency: 8000 },
    param2: { gain: 0, frequency: 3000, Q: 1 },
    param1: { gain: 0, frequency: 250, Q: 1 },
    highpass: { frequency: 20, enabled: false }
  },
  volume: { gain: 1 }
};

const buildSubmissionTokenId = (collabId: string, uid: string) => `${collabId}__${uid}`;
const buildBackingTokenId = (collabId: string, uid: string) => `backing__${collabId}__${uid}`;

async function getSystemSettings(): Promise<SystemSettings> {
  const settingsRef = db.collection("systemSettings").doc("global");
  const snap = await settingsRef.get();
  if (!snap.exists) {
    return DEFAULT_SETTINGS;
  }
  return { ...DEFAULT_SETTINGS, ...snap.data() } as SystemSettings;
}

async function checkUserNotSuspended(uid: string): Promise<void> {
  const userRef = db.collection("users").doc(uid);
  const snap = await userRef.get();
  if (snap.exists) {
    const data = snap.data() as any;
    if (data?.suspended === true) {
      throw new HttpsError("permission-denied", "Your account has been suspended");
    }
  }
}

const sanitize = (s: string) =>
  BAD.reduce(
    (t, w) =>
      t.replace(new RegExp(`\\b${w}\\b`, "gi"), "*".repeat(w.length)),
    s
  );

const toNumber = (value: unknown, fallback = 0) => {
  const num = typeof value === "number" && Number.isFinite(value) ? value : Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const toMillis = (value: any): number | null => {
  if (value == null) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value?.toMillis === "function") return value.toMillis();
  return null;
};

const roundWaveformNumber = (value: number, digits = 6) =>
  Number(value.toFixed(digits));

type ParsedMonoWav = {
  sampleRate: number;
  samples: Int16Array;
};

type WaveformPayload = {
  version: number;
  generator: string;
  fileName: string;
  duration: number;
  sampleRate: number;
  channels: number;
  channelMode: string;
  normalize: boolean;
  bucketCount: number;
  framesPerBucket: number;
  peaks: {
    min: number[];
    max: number[];
  };
};

function parseMonoPcm16Wav(buffer: Buffer): ParsedMonoWav {
  if (buffer.toString("ascii", 0, 4) !== "RIFF" || buffer.toString("ascii", 8, 12) !== "WAVE") {
    throw new Error("invalid wav container");
  }

  let offset = 12;
  let audioFormat = 0;
  let numChannels = 0;
  let sampleRate = 0;
  let bitsPerSample = 0;
  let dataOffset = -1;
  let dataSize = 0;

  while (offset + 8 <= buffer.length) {
    const chunkId = buffer.toString("ascii", offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);
    const chunkDataOffset = offset + 8;

    if (chunkId === "fmt ") {
      audioFormat = buffer.readUInt16LE(chunkDataOffset);
      numChannels = buffer.readUInt16LE(chunkDataOffset + 2);
      sampleRate = buffer.readUInt32LE(chunkDataOffset + 4);
      bitsPerSample = buffer.readUInt16LE(chunkDataOffset + 14);
    } else if (chunkId === "data") {
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
    throw new Error("wav data chunk missing");
  }

  const sampleCount = Math.floor(dataSize / 2);
  const samples = new Int16Array(sampleCount);
  for (let i = 0; i < sampleCount; i += 1) {
    samples[i] = buffer.readInt16LE(dataOffset + i * 2);
  }

  return { sampleRate, samples };
}

function buildWaveformPayload(
  samples: Int16Array,
  sampleRate: number,
  bucketCount: number,
  fileName: string
): WaveformPayload {
  const framesPerBucket = Math.max(1, Math.floor(samples.length / bucketCount));
  const minPeaks = new Array<number>(bucketCount);
  const maxPeaks = new Array<number>(bucketCount);
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
    generator: "make-tune3-ffmpeg-minmax",
    fileName,
    duration: roundWaveformNumber(sampleRate > 0 ? samples.length / sampleRate : 0, 4),
    sampleRate,
    channels: 1,
    channelMode: "merged",
    normalize: true,
    bucketCount,
    framesPerBucket,
    peaks: {
      min: minPeaks.map((value) => roundWaveformNumber(value)),
      max: maxPeaks.map((value) => roundWaveformNumber(value)),
    },
  };
}

function buildWaveformPreview(payload: {
  version?: number;
  bucketCount?: number;
  peaks?: {
    min?: number[];
    max?: number[];
  };
}) {
  const sourceMin = Array.isArray(payload.peaks?.min) ? payload.peaks.min : [];
  const sourceMax = Array.isArray(payload.peaks?.max) ? payload.peaks.max : [];
  const sourceCount = Math.min(sourceMin.length, sourceMax.length);
  const bucketCount = WAVEFORM_PREVIEW_BUCKET_COUNT;
  const minPeaks = new Array(bucketCount).fill(0);
  const maxPeaks = new Array(bucketCount).fill(0);

  if (sourceCount <= 0) {
    return {
      bucketCount,
      version: payload.version ?? WAVEFORM_VERSION,
      peaks: { min: minPeaks, max: maxPeaks },
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
    version: payload.version ?? WAVEFORM_VERSION,
    peaks: {
      min: minPeaks,
      max: maxPeaks,
    },
  };
}

async function generateBackingWaveformAsset(params: {
  bucketName: string;
  collabId: string;
  backingPath: string;
  waveformPath: string;
}) {
  const { bucketName, collabId, backingPath, waveformPath } = params;
  const collabRef = db.collection("collaborations").doc(collabId);
  const bucket = storageAdmin.bucket(bucketName);
  const tmpBase = `backing-waveform-${collabId}-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
  const inputExt = path.extname(backingPath) || ".audio";
  const tmpInput = path.join(os.tmpdir(), `${tmpBase}${inputExt}`);
  const tmpWav = path.join(os.tmpdir(), `${tmpBase}.wav`);

  await collabRef.set({
    backingWaveformStatus: "processing",
    backingWaveformError: null,
    updatedAt: Timestamp.now(),
  }, { merge: true });

  try {
    await bucket.file(backingPath).download({ destination: tmpInput });
    (ffmpeg as any).setFfmpegPath(ffmpegStatic as any);

    await new Promise<void>((resolve, reject) => {
      ffmpeg(tmpInput)
        .noVideo()
        .audioCodec("pcm_s16le")
        .audioChannels(1)
        .audioFrequency(22050)
        .format("wav")
        .on("end", () => resolve())
        .on("error", reject)
        .save(tmpWav);
    });

    const wavBuffer = fs.readFileSync(tmpWav);
    const parsed = parseMonoPcm16Wav(wavBuffer);
    const payload = buildWaveformPayload(
      parsed.samples,
      parsed.sampleRate,
      BACKING_WAVEFORM_BUCKET_COUNT,
      path.basename(backingPath)
    );

    await bucket.file(waveformPath).save(JSON.stringify(payload), {
      resumable: false,
      metadata: {
        contentType: "application/json; charset=utf-8",
        cacheControl: "public, max-age=31536000, immutable",
      },
    });

    const collabSnap = await collabRef.get();
    const collabData = collabSnap.exists ? collabSnap.data() as any : null;
    if (!collabData || String(collabData.backingTrackPath || "") !== backingPath) {
      await bucket.file(waveformPath).delete({ ignoreNotFound: true });
      return;
    }

    await collabRef.set({
      backingWaveformPath: waveformPath,
      backingWaveformStatus: "ready",
      backingWaveformBucketCount: payload.bucketCount,
      backingWaveformVersion: payload.version,
      backingWaveformPreview: buildWaveformPreview(payload),
      backingWaveformError: null,
      updatedAt: Timestamp.now(),
    }, { merge: true });
  } catch (err) {
    const collabSnap = await collabRef.get();
    const collabData = collabSnap.exists ? collabSnap.data() as any : null;
    if (collabData && String(collabData.backingTrackPath || "") === backingPath) {
      await collabRef.set({
        backingWaveformStatus: "failed",
        backingWaveformError: err instanceof Error ? err.message.slice(0, 500) : String(err).slice(0, 500),
        backingWaveformPreview: null,
        updatedAt: Timestamp.now(),
      }, { merge: true });
    }
    throw err;
  } finally {
    try { fs.unlinkSync(tmpInput); } catch { }
    try { fs.unlinkSync(tmpWav); } catch { }
  }
}

const chunkArray = <T>(items: T[], size: number): T[][] => {
  if (size <= 0) return [items];
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
};

const findSubmissionByPath = (detailData: any, filePath: string) => {
  const submissions: any[] = Array.isArray(detailData?.submissions) ? detailData.submissions : [];
  return submissions.find(
    (entry) => entry?.path === filePath || entry?.optimizedPath === filePath
  ) || null;
};

const findSubmissionIndex = (submissions: any[], submissionId: string, filePath?: string) =>
  submissions.findIndex((entry) =>
    entry?.submissionId === submissionId ||
    (filePath ? entry?.path === filePath : false)
  );

async function updateSubmissionWaveformFields(params: {
  collabId: string;
  submissionId: string;
  filePath?: string;
  fields: Record<string, unknown>;
}): Promise<boolean> {
  const { collabId, submissionId, filePath, fields } = params;
  const detailRef = db.collection("collaborationDetails").doc(collabId);
  const collabRef = db.collection("collaborations").doc(collabId);

  return db.runTransaction(async (tx) => {
    const [detailSnap, collabSnap] = await Promise.all([tx.get(detailRef), tx.get(collabRef)]);
    if (!detailSnap.exists) return false;

    const detailData = detailSnap.data() as any;
    const submissions: any[] = Array.isArray(detailData?.submissions) ? [...detailData.submissions] : [];
    const index = findSubmissionIndex(submissions, submissionId, filePath);
    if (index === -1) return false;

    submissions[index] = {
      ...submissions[index],
      ...fields
    };

    const now = Timestamp.now();
    tx.set(detailRef, {
      collaborationId: collabId,
      submissions,
      submissionPaths: submissions.map((entry) => entry?.path).filter(Boolean),
      updatedAt: now,
      createdAt: detailData?.createdAt || now
    }, { merge: true });

    if (collabSnap.exists) {
      tx.update(collabRef, { updatedAt: now });
    }

    return true;
  });
}

async function generateSubmissionWaveformAsset(params: {
  bucketName: string;
  collabId: string;
  submissionId: string;
  submissionPath: string;
  waveformPath: string;
}): Promise<void> {
  const { bucketName, collabId, submissionId, submissionPath, waveformPath } = params;
  const bucket = storageAdmin.bucket(bucketName);
  const tmpBase = `submission-waveform-${collabId}-${submissionId}-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
  const tmpInput = path.join(os.tmpdir(), `${tmpBase}${path.extname(submissionPath) || ".audio"}`);
  const tmpWav = path.join(os.tmpdir(), `${tmpBase}.wav`);

  try {
    await updateSubmissionWaveformFields({
      collabId,
      submissionId,
      filePath: submissionPath,
      fields: {
        waveformStatus: "processing",
        waveformError: null,
        waveformBucketCount: SUBMISSION_WAVEFORM_BUCKET_COUNT,
        waveformVersion: WAVEFORM_VERSION
      }
    });

    await bucket.file(submissionPath).download({ destination: tmpInput });
    (ffmpeg as any).setFfmpegPath(ffmpegStatic as any);
    await new Promise<void>((resolve, reject) => {
      ffmpeg(tmpInput)
        .outputOptions(["-ac 1", "-ar 22050", "-f wav", "-acodec pcm_s16le"])
        .save(tmpWav)
        .on("end", () => resolve())
        .on("error", (error) => reject(error));
    });

    const wavBuffer = fs.readFileSync(tmpWav);
    const parsed = parseMonoPcm16Wav(wavBuffer);
    const payload = buildWaveformPayload(
      parsed.samples,
      parsed.sampleRate,
      SUBMISSION_WAVEFORM_BUCKET_COUNT,
      path.basename(submissionPath)
    );

    await bucket.file(waveformPath).save(JSON.stringify(payload), {
      resumable: false,
      contentType: "application/json; charset=utf-8",
      metadata: {
        cacheControl: "public, max-age=31536000, immutable",
      },
    });

    const updated = await updateSubmissionWaveformFields({
      collabId,
      submissionId,
      filePath: submissionPath,
      fields: {
        waveformPath,
        waveformStatus: "ready",
        waveformBucketCount: payload.bucketCount,
        waveformVersion: payload.version,
        waveformError: null,
        waveformPreview: buildWaveformPreview(payload)
      }
    });

    if (!updated) {
      await bucket.file(waveformPath).delete({ ignoreNotFound: true });
    }
  } catch (err) {
    const updated = await updateSubmissionWaveformFields({
      collabId,
      submissionId,
      filePath: submissionPath,
      fields: {
        waveformStatus: "failed",
        waveformError: err instanceof Error ? err.message.slice(0, 500) : String(err).slice(0, 500),
        waveformBucketCount: SUBMISSION_WAVEFORM_BUCKET_COUNT,
        waveformVersion: WAVEFORM_VERSION,
        waveformPreview: null
      }
    });

    if (!updated) {
      await bucket.file(waveformPath).delete({ ignoreNotFound: true });
    }

    throw err;
  } finally {
    try { fs.unlinkSync(tmpInput); } catch { }
    try { fs.unlinkSync(tmpWav); } catch { }
  }
}

const normalizeStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
};

const getBearerToken = (headerValue: unknown): string | null => {
  if (typeof headerValue !== "string") return null;
  const trimmed = headerValue.trim();
  if (!trimmed.startsWith("Bearer ")) return null;
  const token = trimmed.slice("Bearer ".length).trim();
  return token || null;
};

const tokensMatch = (provided: string | null, expected: string | null): boolean => {
  if (!provided || !expected) return false;
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);
  if (providedBuffer.length !== expectedBuffer.length) return false;
  return crypto.timingSafeEqual(providedBuffer, expectedBuffer);
};

const requireRecommendationApiToken = (authHeader: unknown) => {
  const provided = getBearerToken(authHeader);
  const expected = RECOMMENDATION_API_TOKEN.value();
  if (!tokensMatch(provided, expected)) {
    throw new HttpsError("unauthenticated", "invalid recommendation api token");
  }
};

type HsdEntityType =
  | "project_name"
  | "project_description"
  | "collaboration_name"
  | "collaboration_description";

type HsdSuggestedDecision = "allow" | "review" | "reject";

interface HsdServiceRequest {
  backendId: string;
  requestId: string;
  entityType: HsdEntityType;
  entityId?: string;
  text: string;
}

interface HsdServiceResponse {
  modelVersion: string;
  label: string;
  score: number;
  suggestedDecision: HsdSuggestedDecision;
}

interface HsdCheckResult extends HsdServiceResponse {
  entityType: HsdEntityType;
  entityId: string | null;
}

interface HsdInput {
  entityType: HsdEntityType;
  entityId?: string | null;
  text: string;
}

interface HsdBatchResult {
  requestId: string;
  finalDecision: HsdSuggestedDecision;
  checks: HsdCheckResult[];
}

const getRequiredHsdConfig = () => {
  const serviceUrl = HSD_SERVICE_URL.value().trim().replace(/\/+$/, "");
  const token = HSD_API_TOKEN.value().trim();
  if (!serviceUrl || !token) {
    throw new HttpsError("failed-precondition", "HSD service not configured");
  }
  return { serviceUrl, token };
};

const parseHsdServiceResponse = (value: any): HsdServiceResponse => {
  const modelVersion = typeof value?.modelVersion === "string" ? value.modelVersion.trim() : "";
  const label = typeof value?.label === "string" ? value.label.trim() : "";
  const score = Number(value?.score);
  const suggestedDecision = typeof value?.suggestedDecision === "string"
    ? value.suggestedDecision.trim()
    : "";

  if (
    !modelVersion ||
    !label ||
    !Number.isFinite(score) ||
    !["allow", "review", "reject"].includes(suggestedDecision)
  ) {
    throw new HttpsError("internal", "invalid HSD service response");
  }

  return {
    modelVersion,
    label,
    score,
    suggestedDecision: suggestedDecision as HsdSuggestedDecision
  };
};

const callHsdService = async (
  payload: HsdServiceRequest
): Promise<HsdServiceResponse> => {
  const { serviceUrl, token } = getRequiredHsdConfig();
  let idToken: string;

  try {
    const client = await googleAuth.getIdTokenClient(serviceUrl);
    idToken = await client.idTokenProvider.fetchIdToken(serviceUrl);
  } catch (err) {
    console.error("[hsd] failed to mint cloud run id token", err);
    throw new HttpsError("unavailable", "HSD auth unavailable");
  }

  let response: Response;
  try {
    response = await fetch(`${serviceUrl}/predict`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-serverless-authorization": `Bearer ${idToken}`,
        authorization: `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });
  } catch (err) {
    console.error("[hsd] request failed", err);
    throw new HttpsError("unavailable", "HSD service unavailable");
  }

  const rawBody = await response.text();
  let parsedBody: any = null;
  if (rawBody) {
    try {
      parsedBody = JSON.parse(rawBody);
    } catch {
      parsedBody = null;
    }
  }

  if (!response.ok) {
    console.error("[hsd] non-ok response", {
      status: response.status,
      body: parsedBody ?? rawBody
    });
    const detail = typeof parsedBody?.detail === "string" && parsedBody.detail.trim()
      ? parsedBody.detail.trim()
      : "HSD service error";
    throw new HttpsError("unavailable", detail);
  }

  return parseHsdServiceResponse(parsedBody);
};

const summarizeHsdDecision = (
  checks: HsdCheckResult[]
): HsdSuggestedDecision => {
  if (checks.some((entry) => entry.suggestedDecision === "reject")) return "reject";
  if (checks.some((entry) => entry.suggestedDecision === "review")) return "review";
  return "allow";
};

const runHsdChecks = async (
  inputs: HsdInput[]
): Promise<HsdBatchResult> => {
  const requestId = crypto.randomUUID();
  const checks: HsdCheckResult[] = [];

  for (const input of inputs) {
    const text = String(input.text || "").trim();
    if (!text) continue;

    const response = await callHsdService({
      backendId: HSD_BACKEND_ID,
      requestId,
      entityType: input.entityType,
      entityId: input.entityId ?? undefined,
      text
    });

    checks.push({
      ...response,
      entityType: input.entityType,
      entityId: input.entityId ?? null
    });
  }

  return {
    requestId,
    finalDecision: summarizeHsdDecision(checks),
    checks
  };
};

const writeHsdEvent = async (params: {
  uid: string;
  requestId: string;
  entityKind: "project" | "collaboration";
  entityId: string;
  finalDecision: HsdSuggestedDecision;
  checks: HsdCheckResult[];
  status: "created" | "rejected";
}): Promise<void> => {
  await db.collection(HSD_EVENTS_COLLECTION).add({
    uid: params.uid,
    backendId: HSD_BACKEND_ID,
    requestId: params.requestId,
    entityKind: params.entityKind,
    entityId: params.entityId,
    decision: params.finalDecision,
    status: params.status,
    checks: params.checks.map((entry) => ({
      entityType: entry.entityType,
      entityId: entry.entityId,
      label: entry.label,
      score: entry.score,
      suggestedDecision: entry.suggestedDecision,
      modelVersion: entry.modelVersion
    })),
    createdAt: Timestamp.now()
  });
};

const toIsoString = (value: any): string | null => {
  if (value == null) return null;
  if (typeof value?.toDate === "function") {
    return value.toDate().toISOString();
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === "string" && value.trim()) {
    return value;
  }
  return null;
};

const parseStringArrayField = (value: unknown): string[] => normalizeStringArray(value);

const serializeInteractionEvent = (id: string, data: any) => ({
  id,
  userId: String(data?.userId || ""),
  projectId: String(data?.projectId || ""),
  collaborationId: String(data?.collaborationId || ""),
  trackPath: typeof data?.trackPath === "string" ? data.trackPath : null,
  entityType: String(data?.entityType || ""),
  eventType: String(data?.eventType || ""),
  createdAt: toIsoString(data?.createdAt),
  tags: parseStringArrayField(data?.tags)
});

const serializeCollaborationForRecommendationExport = (id: string, data: any) => ({
  id,
  projectId: String(data?.projectId || ""),
  name: String(data?.name || ""),
  status: String(data?.status || ""),
  tags: parseStringArrayField(data?.tags),
  tagsKey: parseStringArrayField(data?.tagsKey),
  publishedAt: toIsoString(data?.publishedAt)
});

const serializeProjectForRecommendationExport = (id: string, data: any) => ({
  id,
  name: String(data?.name || "")
});

const serializeUserForRecommendationExport = (id: string) => ({
  id
});

const getProjectId = (collabData: any): string | null =>
  typeof collabData?.projectId === "string" && collabData.projectId.trim()
    ? collabData.projectId
    : null;

const writeInteractionEventTx = (
  tx: FirebaseFirestore.Transaction,
  event: InteractionEventInput,
  createdAt: Timestamp
) => {
  const eventRef = db.collection(INTERACTION_EVENTS_COLLECTION).doc();
  tx.set(eventRef, buildInteractionEvent(event, createdAt));
};

const buildUserCollaborationPayload = (
  uid: string,
  collaborationId: string,
  now: Timestamp,
  currentData?: any
) => {
  const base: Record<string, any> = {
    userId: uid,
    collaborationId,
    listenedTracks: normalizeStringArray(currentData?.listenedTracks),
    likedTracks: normalizeStringArray(currentData?.likedTracks),
    favoriteTracks: normalizeStringArray(currentData?.favoriteTracks),
    listenedRatio: toNumber(currentData?.listenedRatio, 0),
    likedCollaboration: Boolean(currentData?.likedCollaboration),
    favoritedCollaboration: Boolean(currentData?.favoritedCollaboration),
    finalVote: typeof currentData?.finalVote === "string" && currentData.finalVote.trim()
      ? currentData.finalVote
      : null,
    createdAt: currentData?.createdAt ?? now,
    lastInteraction: now
  };
  if (typeof currentData?.hasSubmitted === "boolean") {
    base.hasSubmitted = currentData.hasSubmitted;
  }
  return base;
};

const getUserCollaborationTx = async (
  tx: FirebaseFirestore.Transaction,
  uid: string,
  collaborationId: string
) => {
  const userCollabQuery = db
    .collection("userCollaborations")
    .where("userId", "==", uid)
    .where("collaborationId", "==", collaborationId)
    .limit(1);
  const userCollabSnap = await tx.get(userCollabQuery);
  const userCollabRef = userCollabSnap.empty
    ? db.collection("userCollaborations").doc()
    : userCollabSnap.docs[0].ref;
  const userCollabData = userCollabSnap.empty ? null : userCollabSnap.docs[0].data();
  return { userCollabSnap, userCollabRef, userCollabData };
};

const getEffectiveSubmissionLimit = (collabData: any, settings: SystemSettings) => {
  const override = toNumber(collabData?.submissionLimitOverride, NaN);
  const globalLimit = toNumber(settings.maxSubmissionsPerCollab, 0);
  const limit = Number.isFinite(override) ? override : globalLimit;
  return Math.max(0, Math.floor(limit));
};

const normalizeSubmissionSettings = (raw: any) => {
  if (!raw || typeof raw !== "object") {
    return DEFAULT_SUBMISSION_SETTINGS;
  }
  return {
    eq: {
      highshelf: {
        gain: toNumber(raw?.eq?.highshelf?.gain, 0),
        frequency: toNumber(raw?.eq?.highshelf?.frequency, 8000)
      },
      param2: {
        gain: toNumber(raw?.eq?.param2?.gain, 0),
        frequency: toNumber(raw?.eq?.param2?.frequency, 3000),
        Q: toNumber(raw?.eq?.param2?.Q, 1)
      },
      param1: {
        gain: toNumber(raw?.eq?.param1?.gain, 0),
        frequency: toNumber(raw?.eq?.param1?.frequency, 250),
        Q: toNumber(raw?.eq?.param1?.Q, 1)
      },
      highpass: {
        frequency: toNumber(raw?.eq?.highpass?.frequency, 20),
        enabled: Boolean(raw?.eq?.highpass?.enabled)
      }
    },
    volume: {
      gain: toNumber(raw?.volume?.gain, 1)
    }
  };
};

export const sanitizeProjectDescription = onDocumentCreated(
  "projects/{projectId}",
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const data = snap.data();
    const original = String(data?.description ?? "");
    const cleaned = sanitize(original);
    if (cleaned === original) return;
    await db.doc(snap.ref.path).update({ description: cleaned });
  }
);

export const sanitizeProjectDescriptionOnUpdate = onDocumentUpdated(
  "projects/{projectId}",
  async (event) => {
    const after = event.data?.after;
    if (!after) return;
    const data = after.data();
    const original = String(data?.description ?? "");
    const cleaned = sanitize(original);
    if (cleaned === original) return;
    await db.doc(after.ref.path).update({ description: cleaned });
  }
);

export const advanceCollaborationStages = onSchedule(
  "every 3 minutes",
  async () => {
    const now = Timestamp.now();
    let processed = 0;

    // submission -> voting
    while (true) {
      const due = await db
        .collection("collaborations")
        .where("status", "==", "submission")
        .where("submissionCloseAt", "<=", now)
        .orderBy("submissionCloseAt")
        .limit(200)
        .get();
      if (due.empty) break;
      for (const docSnap of due.docs) {
        await db.runTransaction(async (tx) => {
          const ref = docSnap.ref;
          const fresh = await tx.get(ref);
          if (!fresh.exists) return;
          const d = fresh.data() as any;
          if (d.status !== "submission") return;
          if (!d.submissionCloseAt || d.submissionCloseAt.toMillis() > now.toMillis()) return;
          tx.update(ref, { status: "voting", votingStartedAt: now, updatedAt: now });
        });
        processed++;
      }
      if (due.size < 200) break;
    }

    // voting -> completed
    while (true) {
      const due = await db
        .collection("collaborations")
        .where("status", "==", "voting")
        .where("votingCloseAt", "<=", now)
        .orderBy("votingCloseAt")
        .limit(100)
        .get();
      if (due.empty) break;
      for (const docSnap of due.docs) {
        await db.runTransaction(async (tx) => {
          const ref = docSnap.ref;
          const fresh = await tx.get(ref);
          if (!fresh.exists) return;
          const d = fresh.data() as any;
          if (d.status !== "voting") return;
          if (!d.votingCloseAt || d.votingCloseAt.toMillis() > now.toMillis()) return;
          if (d.resultsComputedAt) return;

          const detailRef = db.collection("collaborationDetails").doc(ref.id);
          const detailSnapPromise = tx.get(detailRef);
          const votesQuery = db
            .collection("userCollaborations")
            .where("collaborationId", "==", ref.id)
            .where("finalVote", "!=", null);
          const votesSnapPromise = tx.get(votesQuery);
          const [detailSnap, votesSnap] = await Promise.all([
            detailSnapPromise,
            votesSnapPromise,
          ]);

          const counts: Record<string, number> = {};
          votesSnap.forEach((v) => {
            const fv = (v.data() as any).finalVote as string | null;
            if (!fv) return;
            counts[fv] = (counts[fv] || 0) + 1;
          });

          const submissions: any[] = detailSnap.exists ?
            (Array.isArray((detailSnap.data() as any).submissions) ?
              (detailSnap.data() as any).submissions : []) : [];

          let winnerPath: string | null = null;
          let highestVotes = -1;
          for (const [path, voteCount] of Object.entries(counts)) {
            if (voteCount > highestVotes || (voteCount === highestVotes && path < (winnerPath ?? "~"))) {
              highestVotes = voteCount;
              winnerPath = path;
            }
          }
          if (!winnerPath && submissions.length > 0) {
            const fallback = submissions.find((s) => s?.path);
            if (fallback?.path) {
              winnerPath = String(fallback.path);
            }
          }

          const totalVotes = Object.values(counts).reduce((acc, voteCount) => acc + voteCount, 0);
          const participantIds: string[] = Array.isArray(d.participantIds) ? d.participantIds.filter((pid: unknown) => typeof pid === "string") : [];
          const participationCount = participantIds.length || submissions.length || votesSnap.size;
          const winnerVotes = winnerPath ? counts[winnerPath] ?? 0 : 0;

          // Convert counts object to array format for frontend
          const resultsArray = Object.entries(counts).map(([path, votes]) => ({ path, votes }));

          let winnerUserId: string | null = null;
          let winnerUserName = DEFAULT_WINNER_NAME;
          if (winnerPath) {
            const submissionUserQuery = db
              .collection("submissionUsers")
              .where("collaborationId", "==", ref.id)
              .where("path", "==", winnerPath)
              .limit(1);
            const submissionUserSnap = await tx.get(submissionUserQuery);
            if (!submissionUserSnap.empty) {
              const subUserData = submissionUserSnap.docs[0].data() as any;
              const rawUid = subUserData?.userId;
              if (typeof rawUid === "string" && rawUid) {
                winnerUserId = rawUid;
                const usernameQuery = db
                  .collection("usernames")
                  .where("uid", "==", rawUid)
                  .limit(1);
                const usernameSnap = await tx.get(usernameQuery);
                if (!usernameSnap.empty) {
                  const usernameDoc = usernameSnap.docs[0];
                  const docId = usernameDoc.id;
                  const docName = typeof docId === "string" && docId ? docId : DEFAULT_WINNER_NAME;
                  winnerUserName = docName || DEFAULT_WINNER_NAME;
                }
              }
            }
          }

          const winnerTrackPath = winnerPath ?? "";
          const backingTrackPath = typeof d.backingTrackPath === "string" ? d.backingTrackPath : "";
          const publishedAt = d.publishedAt ?? null;
          const submissionCloseAt = d.submissionCloseAt ?? null;
          const votingCloseAt = d.votingCloseAt ?? null;

          const projectId = String(d.projectId || "");
          let projectSnap = null;
          if (projectId) {
            const projectRef = db.collection("projects").doc(projectId);
            projectSnap = await tx.get(projectRef);
          }

          tx.update(ref, {
            status: "completed",
            completedAt: now,
            updatedAt: now,
            results: resultsArray,
            winnerPath: winnerTrackPath || null,
            winnerUserId: winnerUserId ?? null,
            winnerUserName,
            winnerVotes,
            totalVotes,
            participationCount,
            resultsComputedAt: now,
          });

          if (projectId && projectSnap) {
            const projectRef = db.collection("projects").doc(projectId);
            if (projectSnap.exists) {
              const projectData = projectSnap.data() as any;
              const existingHistory: any[] = Array.isArray(projectData.pastCollaborations) ? projectData.pastCollaborations : [];
              const filteredHistory = existingHistory.filter((item: any) => item?.collaborationId !== ref.id);
              const pastEntry = {
                collaborationId: ref.id,
                name: String(d.name || ""),
                winnerTrackPath,
                pastStageTrackPath: winnerTrackPath || backingTrackPath || "",
                backingTrackPath,
                winnerUserId: winnerUserId ?? null,
                winnerUserName,
                winnerVotes,
                totalVotes,
                participationCount,
                publishedAt,
                submissionCloseAt,
                votingCloseAt,
                completedAt: now,
              };
              const updatedHistory = [pastEntry, ...filteredHistory].slice(0, HISTORY_LIMIT);
              tx.update(projectRef, {
                pastCollaborations: updatedHistory,
                currentCollaborationId: null,
                currentCollaborationStatus: null,
                currentCollaborationStageEndsAt: null,
                updatedAt: now,
              });
            }
          }
        });
        processed++;
      }
      if (due.size < 100) break;
    }

    console.log(`advanceCollaborationStages processed ${processed}`);
  }
);

export const publishCollaboration = onCall({ cors: true }, async (request) => {
  const uid = request.auth?.uid || null;
  if (!uid) throw new HttpsError("unauthenticated", "unauthenticated");

  await checkUserNotSuspended(uid);

  const settings = await getSystemSettings();
  if (!settings.submissionsEnabled) {
    throw new HttpsError("failed-precondition", "Submissions are currently disabled");
  }

  const collaborationIdRaw = String(request.data?.collaborationId || "").trim();
  if (!collaborationIdRaw) {
    throw new HttpsError("invalid-argument", "collaborationId required");
  }

  return db.runTransaction(async (tx) => {
    const collabRef = db.collection("collaborations").doc(collaborationIdRaw);
    const collabSnap = await tx.get(collabRef);
    if (!collabSnap.exists) {
      throw new HttpsError("not-found", "collaboration not found");
    }

    const collabData = collabSnap.data() as any;
    if (collabData.status !== "unpublished") {
      throw new HttpsError("failed-precondition", "collaboration already active");
    }

    const projectId = String(collabData.projectId || "");
    if (!projectId) {
      throw new HttpsError("failed-precondition", "collaboration missing project");
    }

    const projectRef = db.collection("projects").doc(projectId);
    const projectSnap = await tx.get(projectRef);
    if (!projectSnap.exists) {
      throw new HttpsError("not-found", "project not found");
    }

    const projectData = projectSnap.data() as any;
    if (projectData.ownerId && projectData.ownerId !== uid) {
      throw new HttpsError("permission-denied", "only the project owner can publish collaborations");
    }

    const currentId = String(projectData.currentCollaborationId || "");
    const currentStatus = String(projectData.currentCollaborationStatus || "");
    if (
      currentId &&
      currentId !== collaborationIdRaw &&
      ACTIVE_COLLAB_STATUSES.has(currentStatus)
    ) {
      throw new HttpsError("failed-precondition", "another collaboration is already active");
    }

    const activeQuery = db
      .collection("collaborations")
      .where("projectId", "==", projectId)
      .where("status", "in", ["submission", "voting"])
      .limit(2);
    const activeSnap = await tx.get(activeQuery);
    const hasOtherActive = activeSnap.docs.some((doc) => doc.id !== collaborationIdRaw);
    if (hasOtherActive) {
      throw new HttpsError("failed-precondition", "another collaboration is already active");
    }

    const submissionDuration = Number(collabData.submissionDuration || 0);
    const votingDuration = Number(collabData.votingDuration || 0);
    const publishedAt = Timestamp.now();
    const submissionCloseAt = submissionDuration > 0
      ? Timestamp.fromMillis(publishedAt.toMillis() + submissionDuration * 1000)
      : null;
    const baseForVoting = submissionCloseAt ?? publishedAt;
    const votingCloseAt = votingDuration > 0
      ? Timestamp.fromMillis(baseForVoting.toMillis() + votingDuration * 1000)
      : null;

    tx.update(collabRef, {
      status: "submission",
      publishedAt,
      submissionCloseAt,
      votingCloseAt,
      updatedAt: publishedAt,
    });

    tx.update(projectRef, {
      currentCollaborationId: collaborationIdRaw,
      currentCollaborationStatus: "submission",
      currentCollaborationStageEndsAt: submissionCloseAt ?? null,
      updatedAt: publishedAt,
    });

    return {
      collaborationId: collaborationIdRaw,
      submissionCloseAt: submissionCloseAt ? submissionCloseAt.toMillis() : null,
      votingCloseAt: votingCloseAt ? votingCloseAt.toMillis() : null,
    };
  });
});

export const reserveBackingUpload = onCall({ cors: true }, async (request) => {
  const uid = request.auth?.uid || null;
  if (!uid) throw new HttpsError("unauthenticated", "unauthenticated");

  await checkUserNotSuspended(uid);

  const collaborationIdRaw = String(request.data?.collaborationId || "").trim();
  const fileExt = String(request.data?.fileExt || "").trim().toLowerCase();
  if (!collaborationIdRaw || !fileExt) {
    throw new HttpsError("invalid-argument", "collaborationId and fileExt required");
  }
  if (!ALLOWED_AUDIO_EXTS.has(fileExt)) {
    throw new HttpsError("invalid-argument", "unsupported file type");
  }

  return db.runTransaction(async (tx) => {
    const collabRef = db.collection("collaborations").doc(collaborationIdRaw);
    const collabSnap = await tx.get(collabRef);
    if (!collabSnap.exists) {
      throw new HttpsError("not-found", "collaboration not found");
    }
    const collabData = collabSnap.data() as any;
    const projectId = String(collabData.projectId || "");
    if (!projectId) {
      throw new HttpsError("failed-precondition", "collaboration missing project");
    }

    const projectRef = db.collection("projects").doc(projectId);
    const projectSnap = await tx.get(projectRef);
    if (!projectSnap.exists) {
      throw new HttpsError("not-found", "project not found");
    }
    const projectData = projectSnap.data() as any;
    if (String(projectData.ownerId || "") !== uid) {
      throw new HttpsError("permission-denied", "only the project owner can upload backing tracks");
    }

    const now = Timestamp.now();
    const expiresAt = Timestamp.fromMillis(now.toMillis() + BACKING_UPLOAD_RESERVATION_MINUTES * 60 * 1000);
    const tokenId = buildBackingTokenId(collaborationIdRaw, uid);
    const tokenRef = db.collection(BACKING_TOKEN_COLLECTION).doc(tokenId);
    const tokenSnap = await tx.get(tokenRef);
    const tokenData = tokenSnap.exists ? (tokenSnap.data() as any) : null;
    const tokenExpired = tokenData?.expiresAt && tokenData.expiresAt.toMillis() <= now.toMillis();
    const tokenUsed = tokenData?.used === true;

    if (tokenSnap.exists && tokenData && !tokenUsed && !tokenExpired) {
      tx.update(tokenRef, {
        fileExt,
        expiresAt,
        updatedAt: now
      });
      return {
        tokenId: tokenRef.id,
        expiresAt: expiresAt.toMillis()
      };
    }

    tx.set(tokenRef, {
      collabId: collaborationIdRaw,
      uid,
      fileExt,
      createdAt: now,
      expiresAt,
      used: false
    });

    return {
      tokenId: tokenRef.id,
      expiresAt: expiresAt.toMillis()
    };
  });
});

export const reserveSubmissionSlot = onCall({ cors: true }, async (request) => {
  const uid = request.auth?.uid || null;
  if (!uid) throw new HttpsError("unauthenticated", "unauthenticated");

  await checkUserNotSuspended(uid);

  const settings = await getSystemSettings();
  if (!settings.submissionsEnabled) {
    throw new HttpsError("failed-precondition", "Submissions are currently disabled");
  }

  const collaborationIdRaw = String(request.data?.collaborationId || "").trim();
  const fileExt = String(request.data?.fileExt || "").trim().toLowerCase();
  if (!collaborationIdRaw || !fileExt) {
    throw new HttpsError("invalid-argument", "collaborationId and fileExt required");
  }
  if (!ALLOWED_AUDIO_EXTS.has(fileExt)) {
    throw new HttpsError("invalid-argument", "unsupported file type");
  }

  const normalizedSettings = normalizeSubmissionSettings(request.data?.settings);

  return db.runTransaction(async (tx) => {
    const collabRef = db.collection("collaborations").doc(collaborationIdRaw);
    const collabSnap = await tx.get(collabRef);
    if (!collabSnap.exists) {
      throw new HttpsError("not-found", "collaboration not found");
    }
    const collabData = collabSnap.data() as any;
    if (collabData.status !== "submission") {
      throw new HttpsError("failed-precondition", "collaboration not accepting submissions");
    }

    const now = Timestamp.now();
    const submissionCloseMillis = toMillis(collabData.submissionCloseAt);
    if (submissionCloseMillis !== null && submissionCloseMillis <= now.toMillis()) {
      throw new HttpsError("failed-precondition", "submission window closed");
    }
    const expiryMillis = submissionCloseMillis !== null
      ? Math.min(now.toMillis() + SUBMISSION_RESERVATION_MINUTES * 60 * 1000, submissionCloseMillis)
      : now.toMillis() + SUBMISSION_RESERVATION_MINUTES * 60 * 1000;

    const participantIds: string[] = Array.isArray(collabData.participantIds)
      ? collabData.participantIds.filter((pid: unknown) => typeof pid === "string")
      : [];
    if (participantIds.includes(uid)) {
      throw new HttpsError("failed-precondition", "already submitted");
    }

    const tokenId = buildSubmissionTokenId(collaborationIdRaw, uid);
    const tokenRef = db.collection(SUBMISSION_TOKEN_COLLECTION).doc(tokenId);
    const tokenSnap = await tx.get(tokenRef);
    const tokenData = tokenSnap.exists ? (tokenSnap.data() as any) : null;
    const tokenExpired = tokenData?.expiresAt && tokenData.expiresAt.toMillis() <= now.toMillis();
    const tokenUsed = tokenData?.used === true;

    let reservedCount = toNumber(collabData.reservedSubmissionsCount, 0);
    if (tokenSnap.exists && tokenData && tokenExpired && !tokenUsed) {
      reservedCount = reservedCount > 0 ? reservedCount - 1 : 0;
    }

    if (tokenSnap.exists && tokenData && !tokenUsed && !tokenExpired) {
      const refreshedExpiry = Timestamp.fromMillis(expiryMillis);
      tx.update(tokenRef, {
        fileExt,
        settings: normalizedSettings,
        expiresAt: refreshedExpiry,
        submissionCloseAt: collabData.submissionCloseAt || null,
        updatedAt: now
      });
      return {
        tokenId: tokenRef.id,
        submissionId: String(tokenData.submissionId || ""),
        expiresAt: refreshedExpiry.toMillis()
      };
    }

    const effectiveLimit = getEffectiveSubmissionLimit(collabData, settings);
    const submissionsCount = toNumber(collabData.submissionsCount, 0);
    if (submissionsCount + reservedCount >= effectiveLimit) {
      throw new HttpsError("resource-exhausted", "submission limit reached");
    }

    const submissionId = db.collection("submissionUsers").doc().id;
    const expiresAt = Timestamp.fromMillis(expiryMillis);

    tx.set(tokenRef, {
      collabId: collaborationIdRaw,
      uid,
      submissionId,
      fileExt,
      settings: normalizedSettings,
      createdAt: now,
      expiresAt,
      submissionCloseAt: collabData.submissionCloseAt || null,
      used: false
    });

    tx.update(collabRef, {
      reservedSubmissionsCount: reservedCount + 1,
      updatedAt: now
    });

    return {
      tokenId: tokenRef.id,
      submissionId,
      expiresAt: expiresAt.toMillis()
    };
  });
});

export const cleanupSubmissionReservations = onSchedule("every 5 minutes", async () => {
  const now = Timestamp.now();
  const settings = await getSystemSettings();
  const expiredSnap = await db
    .collection(SUBMISSION_TOKEN_COLLECTION)
    .where("expiresAt", "<=", now)
    .limit(200)
    .get();
  const activeSnap = await db
    .collection(SUBMISSION_TOKEN_COLLECTION)
    .where("used", "==", false)
    .limit(200)
    .get();

  const candidates = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>();
  expiredSnap.docs.forEach((doc) => candidates.set(doc.id, doc));
  activeSnap.docs.forEach((doc) => candidates.set(doc.id, doc));
  if (candidates.size === 0) return;

  for (const docSnap of candidates.values()) {
    await db.runTransaction(async (tx) => {
      const tokenRef = docSnap.ref;
      const tokenSnap = await tx.get(tokenRef);
      if (!tokenSnap.exists) return;
      const tokenData = tokenSnap.data() as any;
      if (tokenData.used === true) return;

      const tokenExpired = tokenData.expiresAt && tokenData.expiresAt.toMillis() <= now.toMillis();
      const collabId = String(tokenData.collabId || "");

      let collabSnap: FirebaseFirestore.DocumentSnapshot | null = null;
      if (collabId) {
        const collabRef = db.collection("collaborations").doc(collabId);
        collabSnap = await tx.get(collabRef);
      }

      const invalidReasonParts: string[] = [];
      if (!settings.submissionsEnabled) invalidReasonParts.push("submissions-disabled");
      if (tokenExpired) invalidReasonParts.push("token-expired");
      if (!collabId) invalidReasonParts.push("missing-collab");
      if (collabId && (!collabSnap || !collabSnap.exists)) invalidReasonParts.push("collab-missing");
      if (collabSnap && collabSnap.exists) {
        const collabData = collabSnap.data() as any;
        if (String(collabData.status || "") !== "submission") {
          invalidReasonParts.push("collaboration-closed");
        } else {
          const submissionCloseMillis = toMillis(collabData.submissionCloseAt);
          if (submissionCloseMillis !== null && submissionCloseMillis <= now.toMillis()) {
            invalidReasonParts.push("submission-closed");
          }
        }
      }

      if (invalidReasonParts.length === 0) return;

      if (collabSnap && collabSnap.exists) {
        const collabData = collabSnap.data() as any;
        const reservedCount = toNumber(collabData.reservedSubmissionsCount, 0);
        const nextReserved = reservedCount > 0 ? reservedCount - 1 : 0;
        tx.update(collabSnap.ref, { reservedSubmissionsCount: nextReserved, updatedAt: now });
      }

      tx.update(tokenRef, {
        used: true,
        usedAt: now,
        invalidatedAt: now,
        invalidReason: invalidReasonParts.join(",")
      });
    });
  }
});

export const finalizeBackingUpload = onObjectFinalized({ region: "europe-west1" }, async (event) => {
  const object = event.data;
  const bucketName = object.bucket;
  const filePath = object.name || "";
  const match = filePath.match(/^collabs\/([^/]+)\/backing\.([^/]+)$/i);
  if (!match) return;
  const collabId = match[1];
  const ext = match[2].toLowerCase();
  const waveformRevision = String(object.generation || Date.now());
  const waveformPath = `collabs/${collabId}/waveforms/backing-${waveformRevision}.json`;

  const metadata = object.metadata || {};
  const uploadTokenId = String((metadata as any).backingUploadTokenId || "").trim();
  const ownerUid = String((metadata as any).ownerUid || "").trim();
  if (!uploadTokenId || !ownerUid) {
    return;
  }

  const tokenRef = db.collection(BACKING_TOKEN_COLLECTION).doc(uploadTokenId);
  const collabRef = db.collection("collaborations").doc(collabId);

  let shouldDeleteObject = false;
  let deleteReason = "";
  let previousWaveformPath = "";

  await db.runTransaction(async (tx) => {
    const [tokenSnap, collabSnap] = await Promise.all([
      tx.get(tokenRef),
      tx.get(collabRef)
    ]);

    if (!tokenSnap.exists) {
      return;
    }
    const tokenData = tokenSnap.data() as any;
    const now = Timestamp.now();

    if (tokenData.used === true) {
      return;
    }

    const tokenExpired = tokenData.expiresAt && tokenData.expiresAt.toMillis() <= now.toMillis();
    const invalidReasonParts: string[] = [];
    if (tokenExpired) invalidReasonParts.push("token-expired");
    if (String(tokenData.collabId || "") !== collabId) invalidReasonParts.push("token-collab-mismatch");
    if (String(tokenData.uid || "") !== ownerUid) invalidReasonParts.push("owner-mismatch");
    if (String(tokenData.fileExt || "").toLowerCase() !== ext) invalidReasonParts.push("file-ext-mismatch");
    if (!collabSnap.exists) invalidReasonParts.push("collaboration-missing");

    if (invalidReasonParts.length > 0) {
      tx.update(tokenRef, {
        used: true,
        usedAt: now,
        invalidatedAt: now,
        invalidReason: invalidReasonParts.join(",")
      });
      shouldDeleteObject = true;
      deleteReason = invalidReasonParts.join(",");
      return;
    }

    const collabData = collabSnap.data() as any;
    previousWaveformPath = String(collabData?.backingWaveformPath || "").trim();
    tx.update(tokenRef, { used: true, usedAt: now });
    tx.update(collabRef, {
      backingTrackPath: filePath,
      backingWaveformPath: null,
      backingWaveformStatus: "pending",
      backingWaveformBucketCount: BACKING_WAVEFORM_BUCKET_COUNT,
      backingWaveformVersion: WAVEFORM_VERSION,
      backingWaveformError: null,
      backingWaveformPreview: null,
      updatedAt: now
    });
  });

  if (shouldDeleteObject) {
    try {
      const bucket = storageAdmin.bucket(object.bucket);
      await bucket.file(filePath).delete({ ignoreNotFound: true });
      console.log(`[finalizeBackingUpload] deleted invalid upload ${filePath} reason=${deleteReason}`);
    } catch (err) {
      console.error(`[finalizeBackingUpload] failed to delete invalid upload ${filePath}`, err);
    }
    return;
  }

  if (previousWaveformPath && previousWaveformPath !== waveformPath) {
    try {
      const bucket = storageAdmin.bucket(bucketName);
      await bucket.file(previousWaveformPath).delete({ ignoreNotFound: true });
    } catch (err) {
      console.error(`[finalizeBackingUpload] failed to delete previous waveform ${previousWaveformPath}`, err);
    }
  }

  try {
    await generateBackingWaveformAsset({
      bucketName,
      collabId,
      backingPath: filePath,
      waveformPath
    });
  } catch (err) {
    console.error(`[finalizeBackingUpload] backing waveform generation failed for ${filePath}`, err);
  }
});

// Storage trigger: transcode large files (>20MB) to 256kbps MP3
export const transcodeLargeToMp3 = onObjectFinalized({ region: "europe-west1" }, async (event) => {
  const object = event.data;
  const bucketName = object.bucket;
  const filePath = object.name || "";
  const size = Number(object.size || 0);
  if (!filePath.startsWith("collabs/") || !filePath.includes("/submissions/")) return;
  if (size <= 20 * 1024 * 1024) return;
  // allow any source type above 20MB
  const ext = path.extname(filePath).toLowerCase();
  const base = path.basename(filePath, ext);
  const collabId = filePath.split("/")[1];
  const optimizedPath = `collabs/${collabId}/optimized/${base}.mp3`;

  const bucket = storageAdmin.bucket(bucketName);
  const destFile = bucket.file(optimizedPath);
  const [exists] = await destFile.exists();
  if (exists) return;

  const tmpIn = path.join(os.tmpdir(), `${base}${ext}`);
  const tmpOut = path.join(os.tmpdir(), `${base}.mp3`);
  try {
    // download source
    await bucket.file(filePath).download({ destination: tmpIn });
    // set ffmpeg binary
    (ffmpeg as any).setFfmpegPath(ffmpegStatic as any);
    await new Promise<void>((resolve, reject) => {
      ffmpeg(tmpIn)
        .audioCodec("libmp3lame")
        .audioBitrate("256k")
        .audioFrequency(44100)
        .format("mp3")
        .on("end", () => resolve())
        .on("error", reject)
        .save(tmpOut);
    });
    // upload
    await bucket.upload(tmpOut, { destination: optimizedPath, contentType: "audio/mpeg" });
    const optimizedFile = bucket.file(optimizedPath);
    const [meta] = await optimizedFile.getMetadata();
    const optimizedSize = Number(meta.size || 0);
    // update collaboration detail doc submissions entry
    const collabRef = db.collection("collaborations").doc(collabId);
    const detailRef = db.collection("collaborationDetails").doc(collabId);
    await db.runTransaction(async (tx) => {
      const detailSnap = await tx.get(detailRef);
      if (!detailSnap.exists) return;
      const data = detailSnap.data() as any;
      const subs: any[] = Array.isArray(data.submissions) ? [...data.submissions] : [];
      const idx = subs.findIndex((s) => s?.path && s.path.startsWith(`collabs/${collabId}/submissions/`) && s.path.includes(base));
      const now = Timestamp.now();
      if (idx >= 0) {
        subs[idx] = {
          ...subs[idx],
          optimizedPath,
          optimizedAt: now,
          originalSize: size,
          optimizedSize,
          optimizeStatus: "done",
        };
        tx.update(detailRef, { submissions: subs, updatedAt: now });
        tx.update(collabRef, { updatedAt: now });
      } else {
        // legacy or not found: no-op
      }
    });
  } catch (e) {
    console.error("transcodeLargeToMp3 failed", e);
  } finally {
    try { fs.unlinkSync(tmpIn); } catch { }
    try { fs.unlinkSync(tmpOut); } catch { }
  }
});

export const finalizeSubmissionUpload = onObjectFinalized({ region: "europe-west1" }, async (event) => {
  const object = event.data;
  const filePath = object.name || "";
  if (!filePath.startsWith("collabs/") || !filePath.includes("/submissions/")) return;
  if (filePath.endsWith("-multitracks.zip")) return;

  const parts = filePath.split("/");
  if (parts.length < 4) return;
  const collabId = parts[1];
  const fileName = parts[3];
  const ext = path.extname(fileName).replace(".", "").toLowerCase();
  const submissionId = path.basename(fileName, path.extname(fileName));

  const metadata = object.metadata || {};
  const uploadTokenId = String((metadata as any).uploadTokenId || "").trim();
  const ownerUid = String((metadata as any).ownerUid || "").trim();
  if (!uploadTokenId || !ownerUid) {
    return;
  }

  const tokenRef = db.collection(SUBMISSION_TOKEN_COLLECTION).doc(uploadTokenId);
  const collabRef = db.collection("collaborations").doc(collabId);
  const detailRef = db.collection("collaborationDetails").doc(collabId);
  const submissionUserRef = db.collection("submissionUsers").doc(submissionId);

  const settings = await getSystemSettings();
  let shouldDeleteObject = false;
  let deleteReason = "";
  let shouldGenerateWaveform = false;
  const waveformPath = `collabs/${collabId}/waveforms/submission-${submissionId}.json`;

  await db.runTransaction(async (tx) => {
    const [tokenSnap, collabSnap, detailSnap, submissionUserSnap] = await Promise.all([
      tx.get(tokenRef),
      tx.get(collabRef),
      tx.get(detailRef),
      tx.get(submissionUserRef)
    ]);

    if (!tokenSnap.exists) {
      return;
    }
    const tokenData = tokenSnap.data() as any;
    const now = Timestamp.now();

    if (submissionUserSnap.exists) {
      if (!tokenData.used) {
        tx.update(tokenRef, { used: true, usedAt: now });
      }
      return;
    }

    if (tokenData.used === true) return;
    const tokenExpired = tokenData.expiresAt && tokenData.expiresAt.toMillis() <= now.toMillis();
    const tokenCollabId = String(tokenData.collabId || "");
    const collabMismatch = tokenCollabId !== collabId;

    let tokenCollabSnap = collabSnap;
    let tokenCollabRef = collabRef;
    if (collabMismatch && tokenCollabId) {
      tokenCollabRef = db.collection("collaborations").doc(tokenCollabId);
      tokenCollabSnap = await tx.get(tokenCollabRef);
    }

    const invalidReasonParts: string[] = [];
    if (!settings.submissionsEnabled) invalidReasonParts.push("submissions-disabled");
    if (tokenExpired) invalidReasonParts.push("token-expired");
    if (collabMismatch) invalidReasonParts.push("token-collab-mismatch");
    if (tokenData.uid !== ownerUid) invalidReasonParts.push("owner-mismatch");
    if (tokenData.submissionId !== submissionId) invalidReasonParts.push("submission-mismatch");
    if (String(tokenData.fileExt || "").toLowerCase() !== ext) invalidReasonParts.push("file-ext-mismatch");

    const collabData = collabSnap.exists ? (collabSnap.data() as any) : null;
    if (!collabSnap.exists) invalidReasonParts.push("collaboration-missing");
    if (collabData && String(collabData.status || "") !== "submission") {
      invalidReasonParts.push("collaboration-closed");
    }
    const submissionCloseMillis = collabData ? toMillis(collabData.submissionCloseAt) : null;
    if (submissionCloseMillis !== null && submissionCloseMillis <= now.toMillis()) {
      invalidReasonParts.push("submission-closed");
    }

    if (invalidReasonParts.length > 0) {
      if (!tokenData.used) {
        if (tokenCollabSnap.exists) {
          const collabTokenData = tokenCollabSnap.data() as any;
          const reservedCount = toNumber(collabTokenData.reservedSubmissionsCount, 0);
          const nextReserved = reservedCount > 0 ? reservedCount - 1 : 0;
          tx.update(tokenCollabRef, { reservedSubmissionsCount: nextReserved, updatedAt: now });
        }
        tx.update(tokenRef, {
          used: true,
          usedAt: now,
          invalidatedAt: now,
          invalidReason: invalidReasonParts.join(",")
        });
      }
      shouldDeleteObject = true;
      deleteReason = invalidReasonParts.join(",");
      return;
    }

    if (!collabSnap.exists) return;

    const reservedCount = toNumber(collabData.reservedSubmissionsCount, 0);
    const nextReserved = reservedCount > 0 ? reservedCount - 1 : 0;

    const submissionSettings = normalizeSubmissionSettings(tokenData.settings);
    const createdAt = now;

    const entry: Record<string, any> = {
      path: filePath,
      submissionId,
      settings: submissionSettings,
      createdAt,
      moderationStatus: "pending",
      waveformPath: null,
      waveformStatus: "pending",
      waveformBucketCount: SUBMISSION_WAVEFORM_BUCKET_COUNT,
      waveformVersion: WAVEFORM_VERSION,
      waveformError: null,
      waveformPreview: null
    };

    const detailData = detailSnap.exists ? (detailSnap.data() as any) : null;
    const submissions: any[] = Array.isArray(detailData?.submissions) ? [...detailData.submissions] : [];
    const existingIndex = submissions.findIndex((s) => s?.submissionId === submissionId || s?.path === filePath);
    const isNewSubmission = existingIndex === -1;
    if (isNewSubmission) {
      submissions.push(entry);
      shouldGenerateWaveform = true;
    } else {
      submissions[existingIndex] = {
        ...submissions[existingIndex],
        waveformPath: submissions[existingIndex]?.waveformPath ?? null,
        waveformStatus: submissions[existingIndex]?.waveformStatus ?? "pending",
        waveformBucketCount: submissions[existingIndex]?.waveformBucketCount ?? SUBMISSION_WAVEFORM_BUCKET_COUNT,
        waveformVersion: submissions[existingIndex]?.waveformVersion ?? WAVEFORM_VERSION,
        waveformError: submissions[existingIndex]?.waveformError ?? null,
        waveformPreview: submissions[existingIndex]?.waveformPreview ?? null
      };
      shouldGenerateWaveform = !submissions[existingIndex]?.waveformPath;
    }

    tx.set(submissionUserRef, {
      userId: ownerUid,
      collaborationId: collabId,
      submissionId,
      path: filePath,
      contentType: object.contentType || "",
      size: Number(object.size || 0),
      createdAt
    }, { merge: true });

    tx.set(detailRef, {
      collaborationId: collabId,
      submissions,
      submissionPaths: submissions.map((s) => s?.path).filter(Boolean),
      updatedAt: now,
      createdAt: detailData?.createdAt || now
    }, { merge: true });

    const collabUpdates: Record<string, unknown> = {
      updatedAt: now
    };
    if (isNewSubmission) {
      collabUpdates.submissionsCount = FieldValue.increment(1);
      collabUpdates.reservedSubmissionsCount = nextReserved;
      collabUpdates.participantIds = FieldValue.arrayUnion(ownerUid);
      collabUpdates.unmoderatedSubmissions = true;
    }
    tx.update(collabRef, collabUpdates);

    tx.update(tokenRef, { used: true, usedAt: now });
  });

  if (shouldDeleteObject) {
    try {
      const bucket = storageAdmin.bucket(object.bucket);
      await bucket.file(filePath).delete({ ignoreNotFound: true });
      console.log(`[finalizeSubmissionUpload] deleted invalid upload ${filePath} reason=${deleteReason}`);
    } catch (err) {
      console.error(`[finalizeSubmissionUpload] failed to delete invalid upload ${filePath}`, err);
    }
  }

  if (shouldGenerateWaveform) {
    try {
      await generateSubmissionWaveformAsset({
        bucketName: object.bucket,
        collabId,
        submissionId,
        submissionPath: filePath,
        waveformPath
      });
    } catch (err) {
      console.error(`[finalizeSubmissionUpload] submission waveform generation failed for ${filePath}`, err);
    }
  }
});

export const attachSubmissionMultitracks = onObjectFinalized({ region: "europe-west1" }, async (event) => {
  const object = event.data;
  const filePath = object.name || "";
  if (!filePath.startsWith("collabs/") || !filePath.includes("/submissions/")) return;
  if (!filePath.endsWith("-multitracks.zip")) return;

  const parts = filePath.split("/");
  if (parts.length < 4) return;
  const collabId = parts[1];
  const fileName = parts[3];
  const submissionId = fileName.replace(/-multitracks\.zip$/i, "");

  const metadata = object.metadata || {};
  const ownerUid = String((metadata as any).ownerUid || "").trim();
  const metaSubmissionId = String((metadata as any).submissionId || "").trim();
  if (!ownerUid || (metaSubmissionId && metaSubmissionId !== submissionId)) {
    return;
  }

  const submissionUserRef = db.collection("submissionUsers").doc(submissionId);
  const detailRef = db.collection("collaborationDetails").doc(collabId);

  await db.runTransaction(async (tx) => {
    const [submissionUserSnap, detailSnap] = await Promise.all([
      tx.get(submissionUserRef),
      tx.get(detailRef)
    ]);
    if (!submissionUserSnap.exists) return;
    const subUser = submissionUserSnap.data() as any;
    if (String(subUser.userId || "") !== ownerUid) return;
    if (String(subUser.collaborationId || "") !== collabId) return;

    const detailData = detailSnap.exists ? (detailSnap.data() as any) : null;
    const submissions: any[] = Array.isArray(detailData?.submissions) ? [...detailData.submissions] : [];
    const idx = submissions.findIndex((s) => s?.submissionId === submissionId);
    if (idx === -1) return;

    submissions[idx] = { ...submissions[idx], multitrackZipPath: filePath };
    tx.set(detailRef, {
      collaborationId: collabId,
      submissions,
      submissionPaths: submissions.map((s) => s?.path).filter(Boolean),
      updatedAt: Timestamp.now(),
      createdAt: detailData?.createdAt || Timestamp.now()
    }, { merge: true });
  });
});

export const cleanupSubmissionWaveformOnDelete = onObjectDeleted({ region: "europe-west1" }, async (event) => {
  const object = event.data;
  const filePath = object.name || "";
  if (!filePath.startsWith("collabs/") || !filePath.includes("/submissions/")) return;
  if (filePath.endsWith("-multitracks.zip")) return;

  const parts = filePath.split("/");
  if (parts.length < 4) return;
  const collabId = parts[1];
  const fileName = parts[3];
  const submissionId = path.basename(fileName, path.extname(fileName));
  const conventionalWaveformPath = `collabs/${collabId}/waveforms/submission-${submissionId}.json`;
  const bucket = storageAdmin.bucket(object.bucket);
  const detailRef = db.collection("collaborationDetails").doc(collabId);
  const collabRef = db.collection("collaborations").doc(collabId);
  const submissionUserRef = db.collection("submissionUsers").doc(submissionId);

  let derivedPaths: string[] = [conventionalWaveformPath];

  await db.runTransaction(async (tx) => {
    const [detailSnap, collabSnap, submissionUserSnap] = await Promise.all([
      tx.get(detailRef),
      tx.get(collabRef),
      tx.get(submissionUserRef)
    ]);

    const now = Timestamp.now();
    const detailData = detailSnap.exists ? detailSnap.data() as any : null;
    const submissions: any[] = Array.isArray(detailData?.submissions) ? [...detailData.submissions] : [];
    const index = findSubmissionIndex(submissions, submissionId, filePath);
    const removed = index >= 0 ? submissions[index] : null;

    if (index >= 0) {
      submissions.splice(index, 1);
      tx.set(detailRef, {
        collaborationId: collabId,
        submissions,
        submissionPaths: submissions.map((entry) => entry?.path).filter(Boolean),
        updatedAt: now,
        createdAt: detailData?.createdAt || now
      }, { merge: true });
    }

    if (submissionUserSnap.exists) {
      tx.delete(submissionUserRef);
    }

    if (collabSnap.exists && (index >= 0 || submissionUserSnap.exists)) {
      const collabData = collabSnap.data() as any;
      const nextSubmissionsCount = Math.max(0, toNumber(collabData?.submissionsCount, 0) - (index >= 0 ? 1 : 0));
      tx.set(collabRef, {
        submissionsCount: nextSubmissionsCount,
        unmoderatedSubmissions: submissions.some((entry: any) => (entry?.moderationStatus || "pending") === "pending"),
        updatedAt: now
      }, { merge: true });
    }

    if (removed) {
      derivedPaths = Array.from(new Set([
        conventionalWaveformPath,
        String(removed.waveformPath || "").trim(),
        String(removed.optimizedPath || "").trim(),
        String(removed.multitrackZipPath || "").trim()
      ].filter((value) => value && value !== filePath)));
    }
  });

  for (const derivedPath of derivedPaths) {
    try {
      await bucket.file(derivedPath).delete({ ignoreNotFound: true });
    } catch (err) {
      console.error(`[cleanupSubmissionWaveformOnDelete] failed to delete ${derivedPath}`, err);
    }
  }
});

const buildNameKey = (name: string) =>
  name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s/g, "-");

export const createProjectWithUniqueName = onCall(
  { secrets: [HSD_API_TOKEN, HSD_SERVICE_URL], cors: true },
  async (request) => {
    const uid = request.auth?.uid || null;
    if (!uid) throw new HttpsError("unauthenticated", "unauthenticated");

    await checkUserNotSuspended(uid);

    const settings = await getSystemSettings();
    if (!settings.projectCreationEnabled) {
      throw new HttpsError("failed-precondition", "Project creation is currently disabled");
    }

    const nameRaw = String(request.data?.name ?? "").trim();
    const descriptionRaw = String(request.data?.description ?? "");
    // Project tags are deprecated for beta; projects inherit tags from collaborations.
    const tags: string[] = [];
    const tagsKey: string[] = [];
    if (!nameRaw) throw new HttpsError("invalid-argument", "name required");
    const nameKey = buildNameKey(nameRaw);
    const projectRef = db.collection("projects").doc();

    let hsdResult: HsdBatchResult | null = null;
    if (settings.hsdEnabled) {
      hsdResult = await runHsdChecks([
        { entityType: "project_name", entityId: projectRef.id, text: nameRaw },
        { entityType: "project_description", entityId: projectRef.id, text: descriptionRaw }
      ]);

      if (hsdResult.finalDecision === "reject") {
        await writeHsdEvent({
          uid,
          requestId: hsdResult.requestId,
          entityKind: "project",
          entityId: projectRef.id,
          finalDecision: hsdResult.finalDecision,
          checks: hsdResult.checks,
          status: "rejected"
        });
        throw new HttpsError("failed-precondition", "Project text rejected by HSD policy");
      }
    }

    const result = await db.runTransaction(async (tx) => {
      const userRef = db.collection("users").doc(uid);
      const idxRef = db.collection("projectNameIndex").doc(nameKey);

      const [userSnap, idxSnap] = await Promise.all([
        tx.get(userRef),
        tx.get(idxRef)
      ]);

      if (!userSnap.exists) throw new HttpsError("permission-denied", "user profile not found");
      if (idxSnap.exists) throw new HttpsError("already-exists", "name taken");

      const userData = userSnap.data() as any;
      if (!userData.isAdmin) {
        const tier = userData.tier || "free";
        const bonus = Number(userData.bonusProjects || 0);
        const projectCount = Number(userData.projectCount || 0);
        const baseLimit = TIER_LIMITS[tier] ?? 0;
        const globalDefault = settings.defaultProjectAllowance || 0;
        const totalLimit = baseLimit + bonus + globalDefault;

        if (projectCount >= totalLimit) {
          throw new HttpsError("resource-exhausted", `Project limit reached. You have ${projectCount} of ${totalLimit} allowed projects.`);
        }
      }

      const now = Timestamp.now();
      const projectData = {
        name: nameRaw,
        description: descriptionRaw,
        createdAt: now,
        updatedAt: now,
        ownerId: uid,
        isActive: true,
        pastCollaborations: [],
        nameKey,
        tags,
        tagsKey,
        currentCollaborationId: null,
        currentCollaborationStatus: null,
        currentCollaborationStageEndsAt: null,
      } as any;

      tx.set(projectRef, projectData);
      tx.set(idxRef, { projectId: projectRef.id, ownerId: uid, createdAt: now });

      // Increment project count for user
      tx.update(userRef, {
        projectCount: (Number(userData.projectCount || 0)) + 1
      });

      return { id: projectRef.id, ...(projectData as any) };
    });

    if (hsdResult) {
      await writeHsdEvent({
        uid,
        requestId: hsdResult.requestId,
        entityKind: "project",
        entityId: result.id,
        finalDecision: hsdResult.finalDecision,
        checks: hsdResult.checks,
        status: "created"
      });
    }
    return result;
  }
);

export const createCollaborationWithHSD = onCall(
  { secrets: [HSD_API_TOKEN, HSD_SERVICE_URL], cors: true },
  async (request) => {
    const uid = request.auth?.uid || null;
    if (!uid) throw new HttpsError("unauthenticated", "unauthenticated");

    await checkUserNotSuspended(uid);

    const projectId = String(request.data?.projectId ?? "").trim();
    const nameRaw = String(request.data?.name ?? "").trim();
    const descriptionRaw = String(request.data?.description ?? "");
    const tags = normalizeStringArray(request.data?.tags);
    const tagsKey = normalizeStringArray(request.data?.tagsKey);
    const submissionDuration = toNumber(request.data?.submissionDuration, 604800);
    const votingDuration = toNumber(request.data?.votingDuration, 259200);
    const statusRaw = String(request.data?.status ?? "unpublished").trim() || "unpublished";
    const backingTrackPath = String(request.data?.backingTrackPath ?? "").trim();

    if (!projectId) throw new HttpsError("invalid-argument", "projectId required");
    if (!nameRaw) throw new HttpsError("invalid-argument", "name required");
    if (tags.length === 0 || tagsKey.length === 0) {
      throw new HttpsError("invalid-argument", "at least one tag required");
    }
    if (!Number.isFinite(submissionDuration) || submissionDuration <= 0) {
      throw new HttpsError("invalid-argument", "invalid submissionDuration");
    }
    if (!Number.isFinite(votingDuration) || votingDuration <= 0) {
      throw new HttpsError("invalid-argument", "invalid votingDuration");
    }
    if (!["unpublished", "submission", "voting", "completed", "published"].includes(statusRaw)) {
      throw new HttpsError("invalid-argument", "invalid status");
    }

    const settings = await getSystemSettings();
    const collabRef = db.collection("collaborations").doc();
    const detailRef = db.collection("collaborationDetails").doc(collabRef.id);

    let hsdResult: HsdBatchResult | null = null;
    if (settings.hsdEnabled) {
      hsdResult = await runHsdChecks([
        { entityType: "collaboration_name", entityId: collabRef.id, text: nameRaw },
        { entityType: "collaboration_description", entityId: collabRef.id, text: descriptionRaw }
      ]);

      if (hsdResult.finalDecision === "reject") {
        await writeHsdEvent({
          uid,
          requestId: hsdResult.requestId,
          entityKind: "collaboration",
          entityId: collabRef.id,
          finalDecision: hsdResult.finalDecision,
          checks: hsdResult.checks,
          status: "rejected"
        });
        throw new HttpsError("failed-precondition", "Collaboration text rejected by HSD policy");
      }
    }

    const result = await db.runTransaction(async (tx) => {
      const projectRef = db.collection("projects").doc(projectId);
      const projectSnap = await tx.get(projectRef);
      if (!projectSnap.exists) {
        throw new HttpsError("not-found", "project not found");
      }
      const projectData = projectSnap.data() as any;
      if (String(projectData.ownerId || "") !== uid) {
        throw new HttpsError("permission-denied", "only the project owner can create collaborations");
      }

      const now = Timestamp.now();
      const collaborationData = {
        projectId,
        name: nameRaw,
        description: descriptionRaw,
        tags,
        tagsKey,
        backingTrackPath,
        participantIds: [],
        submissionsCount: 0,
        reservedSubmissionsCount: 0,
        favoritesCount: 0,
        votesCount: 0,
        submissionDuration,
        votingDuration,
        status: statusRaw,
        publishedAt: null,
        createdAt: now,
        updatedAt: now
      } as any;

      tx.set(collabRef, collaborationData);
      tx.set(detailRef, {
        collaborationId: collabRef.id,
        submissions: [],
        submissionPaths: [],
        createdAt: now,
        updatedAt: now
      });

      return {
        id: collabRef.id,
        ...collaborationData,
        submissions: [],
        submissionPaths: []
      };
    });

    if (hsdResult) {
      await writeHsdEvent({
        uid,
        requestId: hsdResult.requestId,
        entityKind: "collaboration",
        entityId: result.id,
        finalDecision: hsdResult.finalDecision,
        checks: hsdResult.checks,
        status: "created"
      });
    }

    return result;
  }
);

export const recountMyProjectCount = onCall({ cors: true }, async (request) => {
  const uid = request.auth?.uid || null;
  if (!uid) throw new HttpsError("unauthenticated", "unauthenticated");

  const ownerProjectsQuery = db.collection("projects").where("ownerId", "==", uid);
  let projectCount = 0;
  if (typeof (ownerProjectsQuery as any).count === "function") {
    const countSnap = await (ownerProjectsQuery as any).count().get();
    projectCount = Number(countSnap.data()?.count || 0);
  } else {
    const ownerProjectsSnap = await ownerProjectsQuery.get();
    projectCount = ownerProjectsSnap.size;
  }

  await db.collection("users").doc(uid).set({ projectCount }, { merge: true });
  return { projectCount };
});

export const getMySubmissionCollabs = onCall({ cors: true }, async (request) => {
  const uid = request.auth?.uid || null;
  if (!uid) {
    return { items: [], unauthenticated: true };
  }
  const subSnap = await db
    .collection("submissionUsers")
    .where("userId", "==", uid)
    .orderBy("createdAt", "desc")
    .limit(10)
    .get();
  if (subSnap.empty) {
    return { items: [] };
  }
  const submissions = subSnap.docs.map((d) => ({
    id: d.id,
    collaborationId: String((d.data() as any).collaborationId || ""),
    path: String((d.data() as any).path || ""),
    createdAt: (d.data() as any).createdAt as Timestamp,
  }));
  const collabIds = Array.from(new Set(submissions.map((s) => s.collaborationId).filter(Boolean)));
  const collabRefs = collabIds.map((id) => db.collection("collaborations").doc(id));
  const collabSnaps = collabRefs.length ? await db.getAll(...collabRefs) : [];
  const collabMap = new Map<string, any>();
  collabSnaps.forEach((s) => {
    if (s.exists) collabMap.set(s.id, s.data());
  });
  const projectIds = Array.from(new Set(collabSnaps.filter((s) => s.exists).map((s) => String((s.data() as any).projectId || "")).filter(Boolean)));
  const projectRefs = projectIds.map((id) => db.collection("projects").doc(id));
  const projectSnaps = projectRefs.length ? await db.getAll(...projectRefs) : [];
  const projectMap = new Map<string, any>();
  projectSnaps.forEach((s) => {
    if (s.exists) projectMap.set(s.id, s.data());
  });

  const detailRefs = collabIds.map((id) => db.collection("collaborationDetails").doc(id));
  const detailSnaps = detailRefs.length ? await db.getAll(...detailRefs) : [];
  const detailMap = new Map<string, any>();
  detailSnaps.forEach((s) => {
    if (s.exists) detailMap.set(s.id, s.data());
  });

  const items = submissions.map((s) => {
    const collab = collabMap.get(s.collaborationId) || {};
    const projectId = String(collab.projectId || "");
    const project = projectId ? projectMap.get(projectId) || {} : {};
    const status = String(collab.status || "");

    const detail = detailMap.get(s.collaborationId);
    let moderationStatus = "pending";
    if (detail && Array.isArray(detail.submissions)) {
      const found = detail.submissions.find((sub: any) => sub.path === s.path);
      if (found && found.moderationStatus) {
        moderationStatus = found.moderationStatus;
      }
    }

    return {
      projectId,
      projectName: String(project.name || ""),
      collabId: s.collaborationId,
      collabName: String(collab.name || ""),
      status,
      publishedAt: collab.publishedAt ? (collab.publishedAt as Timestamp).toMillis() : null,
      submissionCloseAt: collab.submissionCloseAt ? (collab.submissionCloseAt as Timestamp).toMillis() : null,
      votingCloseAt: collab.votingCloseAt ? (collab.votingCloseAt as Timestamp).toMillis() : null,
      backingPath: String(collab.backingTrackPath || ""),
      mySubmissionPath: s.path,
      winnerPath: status === "completed" ? String(collab.winnerPath || "") : null,
      submittedAt: s.createdAt ? s.createdAt.toMillis() : null,
      submissionDurationSeconds:
        typeof collab.submissionDuration === "number" ? collab.submissionDuration : null,
      votingDurationSeconds:
        typeof collab.votingDuration === "number" ? collab.votingDuration : null,
      updatedAt: collab.updatedAt ? (collab.updatedAt as Timestamp).toMillis() : null,
      moderationStatus
    };
  });
  return { items };
});

/**
 * Get collaboration data with submissions filtered by moderation status.
 * Only approved submissions are returned to regular users.
 */
export const getCollaborationData = onCall({ cors: true }, async (request) => {
  const uid = request.auth?.uid || null;
  const collaborationIdRaw = String(request.data?.collaborationId || "").trim();
  if (!collaborationIdRaw) {
    throw new HttpsError("invalid-argument", "collaborationId required");
  }

  // Get collaboration document
  const collabRef = db.collection("collaborations").doc(collaborationIdRaw);
  const collabSnap = await collabRef.get();
  if (!collabSnap.exists) {
    return { collaboration: null };
  }
  const collabData = collabSnap.data() as any;
  const status = String(collabData.status || "");
  if (status === "unpublished") {
    if (!uid) {
      return { collaboration: null };
    }
    const projectId = String(collabData.projectId || "");
    if (projectId) {
      const projectSnap = await db.collection("projects").doc(projectId).get();
      const projectData = projectSnap.exists ? (projectSnap.data() as any) : null;
      if (!projectData || projectData.ownerId !== uid) {
        const adminSnap = await db.collection("users").doc(uid).get();
        const adminData = adminSnap.exists ? adminSnap.data() : null;
        if (!adminData?.isAdmin) {
          return { collaboration: null };
        }
      }
    } else {
      const adminSnap = await db.collection("users").doc(uid).get();
      const adminData = adminSnap.exists ? adminSnap.data() : null;
      if (!adminData?.isAdmin) {
        return { collaboration: null };
      }
    }
  }
  const settings = await getSystemSettings();
  const effectiveLimit = getEffectiveSubmissionLimit(collabData, settings);
  const submissionsUsedCount = toNumber(collabData.submissionsCount, 0)
    + toNumber(collabData.reservedSubmissionsCount, 0);

  // Get collaboration details (submissions)
  const detailRef = db.collection("collaborationDetails").doc(collaborationIdRaw);
  const detailSnap = await detailRef.get();

  let submissions: any[] = [];
  let submissionPaths: string[] = [];
  if (detailSnap.exists) {
    const detailData = detailSnap.data() as any;
    const allSubmissions = Array.isArray(detailData.submissions) ? detailData.submissions : [];

    // Filter: only return approved submissions to users
    submissions = allSubmissions.filter((s: any) =>
      s?.moderationStatus === "approved"
    );
    submissionPaths = submissions.map((s: any) => String(s?.path || "")).filter(Boolean);
  }

  // Helper to convert Timestamp to millis or return null
  const toMillis = (ts: any) => (ts && typeof ts.toMillis === "function" ? ts.toMillis() : null);

  // Build response
  const collaboration = {
    ...collabData,
    id: collabSnap.id,
    effectiveSubmissionLimit: effectiveLimit,
    submissionsUsedCount,
    submissions,
    submissionPaths,
    // Convert Timestamps to millis for client
    createdAt: toMillis(collabData.createdAt),
    updatedAt: toMillis(collabData.updatedAt),
    publishedAt: toMillis(collabData.publishedAt),
    submissionCloseAt: toMillis(collabData.submissionCloseAt),
    votingCloseAt: toMillis(collabData.votingCloseAt),
    completedAt: toMillis(collabData.completedAt),
  };

  return { collaboration };
});

/**
 * Get moderation data for a collaboration.
 * Returns only pending submissions for the project owner to moderate.
 */
export const getModerationData = onCall({ cors: true }, async (request) => {
  const uid = request.auth?.uid || null;
  if (!uid) throw new HttpsError("unauthenticated", "unauthenticated");

  const collaborationIdRaw = String(request.data?.collaborationId || "").trim();
  if (!collaborationIdRaw) {
    throw new HttpsError("invalid-argument", "collaborationId required");
  }

  // Get collaboration document
  const collabRef = db.collection("collaborations").doc(collaborationIdRaw);
  const collabSnap = await collabRef.get();
  if (!collabSnap.exists) {
    throw new HttpsError("not-found", "collaboration not found");
  }
  const collabData = collabSnap.data() as any;
  const settings = await getSystemSettings();
  const effectiveLimit = getEffectiveSubmissionLimit(collabData, settings);
  const submissionsUsedCount = toNumber(collabData.submissionsCount, 0)
    + toNumber(collabData.reservedSubmissionsCount, 0);

  // Verify user is project owner
  const projectId = String(collabData.projectId || "");
  if (!projectId) {
    throw new HttpsError("failed-precondition", "collaboration missing project");
  }
  const projectRef = db.collection("projects").doc(projectId);
  const projectSnap = await projectRef.get();
  if (!projectSnap.exists) {
    throw new HttpsError("not-found", "project not found");
  }
  const projectData = projectSnap.data() as any;
  if (projectData.ownerId !== uid) {
    throw new HttpsError("permission-denied", "only project owner can moderate");
  }

  // Get collaboration details (submissions)
  const detailRef = db.collection("collaborationDetails").doc(collaborationIdRaw);
  const detailSnap = await detailRef.get();

  let pendingSubmissions: any[] = [];
  if (detailSnap.exists) {
    const detailData = detailSnap.data() as any;
    const allSubmissions = Array.isArray(detailData.submissions) ? detailData.submissions : [];

    // Filter: only return pending submissions for moderation
    pendingSubmissions = allSubmissions.filter((s: any) =>
      s?.moderationStatus === "pending"
    );
  }

  // Helper to convert Timestamp to millis or return null
  const toMillis = (ts: any) => (ts && typeof ts.toMillis === "function" ? ts.toMillis() : null);

  // Build response with collaboration info and pending submissions only
  const collaboration = {
    ...collabData,
    id: collabSnap.id,
    effectiveSubmissionLimit: effectiveLimit,
    submissionsUsedCount,
    submissions: pendingSubmissions,
    submissionPaths: pendingSubmissions.map((s: any) => String(s?.path || "")).filter(Boolean),
    createdAt: toMillis(collabData.createdAt),
    updatedAt: toMillis(collabData.updatedAt),
    publishedAt: toMillis(collabData.publishedAt),
    submissionCloseAt: toMillis(collabData.submissionCloseAt),
    votingCloseAt: toMillis(collabData.votingCloseAt),
    completedAt: toMillis(collabData.completedAt),
  };

  return { collaboration };
});

export const setSubmissionModeration = onCall({ cors: true }, async (request) => {
  const uid = request.auth?.uid || null;
  if (!uid) throw new HttpsError("unauthenticated", "unauthenticated");

  const collaborationIdRaw = String(request.data?.collaborationId || "").trim();
  const submissionIdentifier = String(request.data?.submissionIdentifier || "").trim();
  const statusRaw = String(request.data?.status || "").trim();
  if (!collaborationIdRaw || !submissionIdentifier) {
    throw new HttpsError("invalid-argument", "collaborationId and submissionIdentifier required");
  }
  if (!["approved", "rejected"].includes(statusRaw)) {
    throw new HttpsError("invalid-argument", "invalid moderation status");
  }

  const collabRef = db.collection("collaborations").doc(collaborationIdRaw);
  const detailRef = db.collection("collaborationDetails").doc(collaborationIdRaw);

  await db.runTransaction(async (tx) => {
    const collabSnap = await tx.get(collabRef);
    if (!collabSnap.exists) {
      throw new HttpsError("not-found", "collaboration not found");
    }
    const collabData = collabSnap.data() as any;

    const projectId = String(collabData.projectId || "");
    if (!projectId) {
      throw new HttpsError("failed-precondition", "collaboration missing project");
    }
    const projectRef = db.collection("projects").doc(projectId);
    const projectSnap = await tx.get(projectRef);
    if (!projectSnap.exists) {
      throw new HttpsError("not-found", "project not found");
    }
    const projectData = projectSnap.data() as any;
    if (projectData.ownerId !== uid) {
      throw new HttpsError("permission-denied", "only project owner can moderate");
    }

    const detailSnap = await tx.get(detailRef);
    if (!detailSnap.exists) {
      throw new HttpsError("not-found", "collaboration details not found");
    }
    const detailData = detailSnap.data() as any;
    const submissionsArray = Array.isArray(detailData.submissions) ? [...detailData.submissions] : [];
    if (submissionsArray.length === 0) {
      throw new HttpsError("failed-precondition", "no submissions to moderate");
    }

    const targetIndex = submissionsArray.findIndex((entry: any) => {
      if (!entry) return false;
      const entryId = entry.submissionId || entry.path;
      return entryId === submissionIdentifier || entry.path === submissionIdentifier;
    });
    if (targetIndex === -1) {
      throw new HttpsError("not-found", "submission not found");
    }

    const target = submissionsArray[targetIndex] || {};
    const currentStatus = target.moderationStatus || "pending";
    if (currentStatus !== "pending") {
      throw new HttpsError("failed-precondition", "already moderated");
    }

    const now = Timestamp.now();
    submissionsArray[targetIndex] = {
      ...target,
      submissionId: target.submissionId || submissionIdentifier,
      moderationStatus: statusRaw,
      moderatedAt: now,
      moderatedBy: uid
    };

    const stillPending = submissionsArray.some((entry: any) => entry?.moderationStatus === "pending");

    tx.update(detailRef, {
      submissions: submissionsArray,
      updatedAt: now
    });

    tx.update(collabRef, {
      unmoderatedSubmissions: stillPending,
      updatedAt: now
    });
  });

  return { status: statusRaw };
});

export const addFavoriteTrack = onCall({ cors: true }, async (request) => {
  const uid = request.auth?.uid || null;
  if (!uid) throw new HttpsError("unauthenticated", "unauthenticated");

  await checkUserNotSuspended(uid);

  const collaborationIdRaw = String(request.data?.collaborationId || "").trim();
  const filePath = String(request.data?.filePath || "").trim();
  if (!collaborationIdRaw || !filePath) {
    throw new HttpsError("invalid-argument", "collaborationId and filePath required");
  }

  const settings = await getSystemSettings();
  if (!settings.votingEnabled) {
    throw new HttpsError("failed-precondition", "Voting is currently disabled");
  }

  return db.runTransaction(async (tx) => {
    const now = Timestamp.now();
    const collabRef = db.collection("collaborations").doc(collaborationIdRaw);
    const detailRef = db.collection("collaborationDetails").doc(collaborationIdRaw);

    const [collabSnap, detailSnap] = await Promise.all([
      tx.get(collabRef),
      tx.get(detailRef)
    ]);

    if (!collabSnap.exists) {
      throw new HttpsError("not-found", "collaboration not found");
    }
    const collabData = collabSnap.data() as any;
    const status = String(collabData.status || "");
    if (!ACTIVE_COLLAB_STATUSES.has(status)) {
      throw new HttpsError("failed-precondition", "collaboration not active");
    }
    if (status === "voting") {
      const votingCloseMillis = toMillis(collabData.votingCloseAt);
      if (votingCloseMillis !== null && votingCloseMillis <= now.toMillis()) {
        throw new HttpsError("failed-precondition", "voting closed");
      }
    }

    const submissionEntry = findSubmissionByPath(detailSnap.exists ? detailSnap.data() : null, filePath);
    if (!submissionEntry) {
      throw new HttpsError("not-found", "submission not found");
    }
    if (collabData.requiresModeration && submissionEntry.moderationStatus !== "approved") {
      throw new HttpsError("failed-precondition", "submission not approved");
    }

    const { userCollabData, userCollabRef } = await getUserCollaborationTx(
      tx,
      uid,
      collaborationIdRaw
    );
    const nextUserCollab = buildUserCollaborationPayload(uid, collaborationIdRaw, now, userCollabData);

    const favoriteChange = addValueIfMissing(nextUserCollab.favoriteTracks, filePath);
    if (!favoriteChange.changed) {
      tx.set(userCollabRef, nextUserCollab, { merge: true });
      return { updated: false };
    }

    tx.set(userCollabRef, {
      ...nextUserCollab,
      favoriteTracks: favoriteChange.next
    }, { merge: true });

    const favoritesCount = toNumber(collabData.favoritesCount, 0);
    tx.update(collabRef, { favoritesCount: favoritesCount + 1, updatedAt: now });
    writeInteractionEventTx(tx, {
      userId: uid,
      projectId: getProjectId(collabData),
      collaborationId: collaborationIdRaw,
      trackPath: filePath,
      entityType: "submission",
      eventType: INTERACTION_EVENT_TYPES.SUBMISSION_FAVORITE
    }, now);
    return { updated: true, favoritesCount: favoritesCount + 1 };
  });
});

export const removeFavoriteTrack = onCall({ cors: true }, async (request) => {
  const uid = request.auth?.uid || null;
  if (!uid) throw new HttpsError("unauthenticated", "unauthenticated");

  await checkUserNotSuspended(uid);

  const collaborationIdRaw = String(request.data?.collaborationId || "").trim();
  const filePath = String(request.data?.filePath || "").trim();
  if (!collaborationIdRaw || !filePath) {
    throw new HttpsError("invalid-argument", "collaborationId and filePath required");
  }

  const settings = await getSystemSettings();
  if (!settings.votingEnabled) {
    throw new HttpsError("failed-precondition", "Voting is currently disabled");
  }

  return db.runTransaction(async (tx) => {
    const now = Timestamp.now();
    const collabRef = db.collection("collaborations").doc(collaborationIdRaw);
    const detailRef = db.collection("collaborationDetails").doc(collaborationIdRaw);

    const [collabSnap, detailSnap] = await Promise.all([
      tx.get(collabRef),
      tx.get(detailRef)
    ]);

    if (!collabSnap.exists) {
      throw new HttpsError("not-found", "collaboration not found");
    }
    const collabData = collabSnap.data() as any;
    const status = String(collabData.status || "");
    if (!ACTIVE_COLLAB_STATUSES.has(status)) {
      throw new HttpsError("failed-precondition", "collaboration not active");
    }
    if (status === "voting") {
      const votingCloseMillis = toMillis(collabData.votingCloseAt);
      if (votingCloseMillis !== null && votingCloseMillis <= now.toMillis()) {
        throw new HttpsError("failed-precondition", "voting closed");
      }
    }

    const submissionEntry = findSubmissionByPath(detailSnap.exists ? detailSnap.data() : null, filePath);
    if (!submissionEntry) {
      throw new HttpsError("not-found", "submission not found");
    }
    if (collabData.requiresModeration && submissionEntry.moderationStatus !== "approved") {
      throw new HttpsError("failed-precondition", "submission not approved");
    }

    const { userCollabSnap, userCollabRef, userCollabData } = await getUserCollaborationTx(
      tx,
      uid,
      collaborationIdRaw
    );
    if (userCollabSnap.empty) {
      return { updated: false };
    }
    const nextUserCollab = buildUserCollaborationPayload(uid, collaborationIdRaw, now, userCollabData);

    const favoriteChange = removeValueIfPresent(nextUserCollab.favoriteTracks, filePath);
    if (!favoriteChange.changed) {
      tx.update(userCollabRef, { lastInteraction: now });
      return { updated: false };
    }

    tx.set(userCollabRef, {
      ...nextUserCollab,
      favoriteTracks: favoriteChange.next
    }, { merge: true });

    const favoritesCount = toNumber(collabData.favoritesCount, 0);
    tx.update(collabRef, {
      favoritesCount: Math.max(0, favoritesCount - 1),
      updatedAt: now
    });
    writeInteractionEventTx(tx, {
      userId: uid,
      projectId: getProjectId(collabData),
      collaborationId: collaborationIdRaw,
      trackPath: filePath,
      entityType: "submission",
      eventType: INTERACTION_EVENT_TYPES.SUBMISSION_UNFAVORITE
    }, now);
    return { updated: true, favoritesCount: Math.max(0, favoritesCount - 1) };
  });
});

export const likeTrack = onCall({ cors: true }, async (request) => {
  const uid = request.auth?.uid || null;
  if (!uid) throw new HttpsError("unauthenticated", "unauthenticated");

  await checkUserNotSuspended(uid);

  const collaborationIdRaw = String(request.data?.collaborationId || "").trim();
  const filePath = String(request.data?.filePath || "").trim();
  if (!collaborationIdRaw || !filePath) {
    throw new HttpsError("invalid-argument", "collaborationId and filePath required");
  }

  const settings = await getSystemSettings();
  if (!settings.votingEnabled) {
    throw new HttpsError("failed-precondition", "Voting is currently disabled");
  }

  return db.runTransaction(async (tx) => {
    const now = Timestamp.now();
    const collabRef = db.collection("collaborations").doc(collaborationIdRaw);
    const detailRef = db.collection("collaborationDetails").doc(collaborationIdRaw);

    const [collabSnap, detailSnap] = await Promise.all([
      tx.get(collabRef),
      tx.get(detailRef)
    ]);

    if (!collabSnap.exists) {
      throw new HttpsError("not-found", "collaboration not found");
    }
    const collabData = collabSnap.data() as any;
    const status = String(collabData.status || "");
    if (!ACTIVE_COLLAB_STATUSES.has(status)) {
      throw new HttpsError("failed-precondition", "collaboration not active");
    }
    if (status === "voting") {
      const votingCloseMillis = toMillis(collabData.votingCloseAt);
      if (votingCloseMillis !== null && votingCloseMillis <= now.toMillis()) {
        throw new HttpsError("failed-precondition", "voting closed");
      }
    }

    const submissionEntry = findSubmissionByPath(detailSnap.exists ? detailSnap.data() : null, filePath);
    if (!submissionEntry) {
      throw new HttpsError("not-found", "submission not found");
    }
    if (collabData.requiresModeration && submissionEntry.moderationStatus !== "approved") {
      throw new HttpsError("failed-precondition", "submission not approved");
    }

    const { userCollabData, userCollabRef } = await getUserCollaborationTx(
      tx,
      uid,
      collaborationIdRaw
    );
    const nextUserCollab = buildUserCollaborationPayload(uid, collaborationIdRaw, now, userCollabData);
    const likeChange = addValueIfMissing(nextUserCollab.likedTracks, filePath);
    if (!likeChange.changed) {
      tx.set(userCollabRef, nextUserCollab, { merge: true });
      return { updated: false };
    }

    tx.set(userCollabRef, {
      ...nextUserCollab,
      likedTracks: likeChange.next
    }, { merge: true });
    writeInteractionEventTx(tx, {
      userId: uid,
      projectId: getProjectId(collabData),
      collaborationId: collaborationIdRaw,
      trackPath: filePath,
      entityType: "submission",
      eventType: INTERACTION_EVENT_TYPES.SUBMISSION_LIKE
    }, now);
    return { updated: true };
  });
});

export const unlikeTrack = onCall({ cors: true }, async (request) => {
  const uid = request.auth?.uid || null;
  if (!uid) throw new HttpsError("unauthenticated", "unauthenticated");

  await checkUserNotSuspended(uid);

  const collaborationIdRaw = String(request.data?.collaborationId || "").trim();
  const filePath = String(request.data?.filePath || "").trim();
  if (!collaborationIdRaw || !filePath) {
    throw new HttpsError("invalid-argument", "collaborationId and filePath required");
  }

  const settings = await getSystemSettings();
  if (!settings.votingEnabled) {
    throw new HttpsError("failed-precondition", "Voting is currently disabled");
  }

  return db.runTransaction(async (tx) => {
    const now = Timestamp.now();
    const collabRef = db.collection("collaborations").doc(collaborationIdRaw);
    const detailRef = db.collection("collaborationDetails").doc(collaborationIdRaw);

    const [collabSnap, detailSnap] = await Promise.all([
      tx.get(collabRef),
      tx.get(detailRef)
    ]);

    if (!collabSnap.exists) {
      throw new HttpsError("not-found", "collaboration not found");
    }
    const collabData = collabSnap.data() as any;
    const status = String(collabData.status || "");
    if (!ACTIVE_COLLAB_STATUSES.has(status)) {
      throw new HttpsError("failed-precondition", "collaboration not active");
    }
    if (status === "voting") {
      const votingCloseMillis = toMillis(collabData.votingCloseAt);
      if (votingCloseMillis !== null && votingCloseMillis <= now.toMillis()) {
        throw new HttpsError("failed-precondition", "voting closed");
      }
    }

    const submissionEntry = findSubmissionByPath(detailSnap.exists ? detailSnap.data() : null, filePath);
    if (!submissionEntry) {
      throw new HttpsError("not-found", "submission not found");
    }
    if (collabData.requiresModeration && submissionEntry.moderationStatus !== "approved") {
      throw new HttpsError("failed-precondition", "submission not approved");
    }

    const { userCollabSnap, userCollabData, userCollabRef } = await getUserCollaborationTx(
      tx,
      uid,
      collaborationIdRaw
    );
    if (userCollabSnap.empty) {
      return { updated: false };
    }

    const nextUserCollab = buildUserCollaborationPayload(uid, collaborationIdRaw, now, userCollabData);
    const likeChange = removeValueIfPresent(nextUserCollab.likedTracks, filePath);
    if (!likeChange.changed) {
      tx.update(userCollabRef, { lastInteraction: now });
      return { updated: false };
    }

    tx.set(userCollabRef, {
      ...nextUserCollab,
      likedTracks: likeChange.next
    }, { merge: true });
    writeInteractionEventTx(tx, {
      userId: uid,
      projectId: getProjectId(collabData),
      collaborationId: collaborationIdRaw,
      trackPath: filePath,
      entityType: "submission",
      eventType: INTERACTION_EVENT_TYPES.SUBMISSION_UNLIKE
    }, now);
    return { updated: true };
  });
});

export const voteForTrack = onCall({ cors: true }, async (request) => {
  const uid = request.auth?.uid || null;
  if (!uid) throw new HttpsError("unauthenticated", "unauthenticated");

  await checkUserNotSuspended(uid);

  const collaborationIdRaw = String(request.data?.collaborationId || "").trim();
  const filePath = String(request.data?.filePath || "").trim();
  if (!collaborationIdRaw || !filePath) {
    throw new HttpsError("invalid-argument", "collaborationId and filePath required");
  }

  const settings = await getSystemSettings();
  if (!settings.votingEnabled) {
    throw new HttpsError("failed-precondition", "Voting is currently disabled");
  }

  return db.runTransaction(async (tx) => {
    const now = Timestamp.now();
    const collabRef = db.collection("collaborations").doc(collaborationIdRaw);
    const detailRef = db.collection("collaborationDetails").doc(collaborationIdRaw);

    const [collabSnap, detailSnap] = await Promise.all([
      tx.get(collabRef),
      tx.get(detailRef)
    ]);

    if (!collabSnap.exists) {
      throw new HttpsError("not-found", "collaboration not found");
    }
    const collabData = collabSnap.data() as any;
    const status = String(collabData.status || "");
    if (status !== "voting") {
      throw new HttpsError("failed-precondition", "collaboration not accepting votes");
    }
    const votingCloseMillis = toMillis(collabData.votingCloseAt);
    if (votingCloseMillis !== null && votingCloseMillis <= now.toMillis()) {
      throw new HttpsError("failed-precondition", "voting closed");
    }

    const submissionEntry = findSubmissionByPath(detailSnap.exists ? detailSnap.data() : null, filePath);
    if (!submissionEntry) {
      throw new HttpsError("not-found", "submission not found");
    }
    if (collabData.requiresModeration && submissionEntry.moderationStatus !== "approved") {
      throw new HttpsError("failed-precondition", "submission not approved");
    }

    const { userCollabData, userCollabRef } = await getUserCollaborationTx(
      tx,
      uid,
      collaborationIdRaw
    );
    const nextUserCollab = buildUserCollaborationPayload(uid, collaborationIdRaw, now, userCollabData);

    const voteChange = setFinalVote(nextUserCollab.finalVote, filePath);
    if (!voteChange.changed) {
      tx.set(userCollabRef, {
        ...nextUserCollab,
        finalVote: filePath
      }, { merge: true });
      return { updated: false };
    }

    const isFirstVote = !nextUserCollab.finalVote;
    tx.set(userCollabRef, {
      ...nextUserCollab,
      finalVote: voteChange.next
    }, { merge: true });
    writeInteractionEventTx(tx, {
      userId: uid,
      projectId: getProjectId(collabData),
      collaborationId: collaborationIdRaw,
      trackPath: filePath,
      entityType: "submission",
      eventType: INTERACTION_EVENT_TYPES.SUBMISSION_VOTE,
      metadata: voteChange.metadata
    }, now);

    if (isFirstVote) {
      const votesCount = toNumber(collabData.votesCount, 0);
      tx.update(collabRef, { votesCount: votesCount + 1, updatedAt: now });
      return { updated: true, votesCount: votesCount + 1 };
    }

    return { updated: true, votesCount: toNumber(collabData.votesCount, 0) };
  });
});

export const likeCollaboration = onCall({ cors: true }, async (request) => {
  const uid = request.auth?.uid || null;
  if (!uid) throw new HttpsError("unauthenticated", "unauthenticated");

  await checkUserNotSuspended(uid);

  const collaborationIdRaw = String(request.data?.collaborationId || "").trim();
  if (!collaborationIdRaw) {
    throw new HttpsError("invalid-argument", "collaborationId required");
  }

  return db.runTransaction(async (tx) => {
    const now = Timestamp.now();
    const collabRef = db.collection("collaborations").doc(collaborationIdRaw);
    const collabSnap = await tx.get(collabRef);
    if (!collabSnap.exists) {
      throw new HttpsError("not-found", "collaboration not found");
    }

    const collabData = collabSnap.data() as any;
    const status = String(collabData.status || "");
    if (!COLLAB_REACTION_STATUSES.has(status)) {
      throw new HttpsError("failed-precondition", "collaboration not available");
    }

    const { userCollabData, userCollabRef } = await getUserCollaborationTx(
      tx,
      uid,
      collaborationIdRaw
    );
    const nextUserCollab = buildUserCollaborationPayload(uid, collaborationIdRaw, now, userCollabData);
    const likeChange = setBooleanValue(nextUserCollab.likedCollaboration, true);
    if (!likeChange.changed) {
      tx.set(userCollabRef, nextUserCollab, { merge: true });
      return { updated: false };
    }

    tx.set(userCollabRef, {
      ...nextUserCollab,
      likedCollaboration: likeChange.next
    }, { merge: true });
    writeInteractionEventTx(tx, {
      userId: uid,
      projectId: getProjectId(collabData),
      collaborationId: collaborationIdRaw,
      trackPath: null,
      entityType: "collaboration",
      eventType: INTERACTION_EVENT_TYPES.COLLABORATION_LIKE
    }, now);
    return { updated: true };
  });
});

export const unlikeCollaboration = onCall({ cors: true }, async (request) => {
  const uid = request.auth?.uid || null;
  if (!uid) throw new HttpsError("unauthenticated", "unauthenticated");

  await checkUserNotSuspended(uid);

  const collaborationIdRaw = String(request.data?.collaborationId || "").trim();
  if (!collaborationIdRaw) {
    throw new HttpsError("invalid-argument", "collaborationId required");
  }

  return db.runTransaction(async (tx) => {
    const now = Timestamp.now();
    const collabRef = db.collection("collaborations").doc(collaborationIdRaw);
    const collabSnap = await tx.get(collabRef);
    if (!collabSnap.exists) {
      throw new HttpsError("not-found", "collaboration not found");
    }

    const collabData = collabSnap.data() as any;
    const status = String(collabData.status || "");
    if (!COLLAB_REACTION_STATUSES.has(status)) {
      throw new HttpsError("failed-precondition", "collaboration not available");
    }

    const { userCollabSnap, userCollabData, userCollabRef } = await getUserCollaborationTx(
      tx,
      uid,
      collaborationIdRaw
    );
    if (userCollabSnap.empty) {
      return { updated: false };
    }

    const nextUserCollab = buildUserCollaborationPayload(uid, collaborationIdRaw, now, userCollabData);
    const likeChange = setBooleanValue(nextUserCollab.likedCollaboration, false);
    if (!likeChange.changed) {
      tx.update(userCollabRef, { lastInteraction: now });
      return { updated: false };
    }

    tx.set(userCollabRef, {
      ...nextUserCollab,
      likedCollaboration: likeChange.next
    }, { merge: true });
    writeInteractionEventTx(tx, {
      userId: uid,
      projectId: getProjectId(collabData),
      collaborationId: collaborationIdRaw,
      trackPath: null,
      entityType: "collaboration",
      eventType: INTERACTION_EVENT_TYPES.COLLABORATION_UNLIKE
    }, now);
    return { updated: true };
  });
});

export const favoriteCollaboration = onCall({ cors: true }, async (request) => {
  const uid = request.auth?.uid || null;
  if (!uid) throw new HttpsError("unauthenticated", "unauthenticated");

  await checkUserNotSuspended(uid);

  const collaborationIdRaw = String(request.data?.collaborationId || "").trim();
  if (!collaborationIdRaw) {
    throw new HttpsError("invalid-argument", "collaborationId required");
  }

  return db.runTransaction(async (tx) => {
    const now = Timestamp.now();
    const collabRef = db.collection("collaborations").doc(collaborationIdRaw);
    const collabSnap = await tx.get(collabRef);
    if (!collabSnap.exists) {
      throw new HttpsError("not-found", "collaboration not found");
    }

    const collabData = collabSnap.data() as any;
    const status = String(collabData.status || "");
    if (!COLLAB_REACTION_STATUSES.has(status)) {
      throw new HttpsError("failed-precondition", "collaboration not available");
    }

    const { userCollabData, userCollabRef } = await getUserCollaborationTx(
      tx,
      uid,
      collaborationIdRaw
    );
    const nextUserCollab = buildUserCollaborationPayload(uid, collaborationIdRaw, now, userCollabData);
    const favoriteChange = setBooleanValue(nextUserCollab.favoritedCollaboration, true);
    if (!favoriteChange.changed) {
      tx.set(userCollabRef, nextUserCollab, { merge: true });
      return { updated: false };
    }

    tx.set(userCollabRef, {
      ...nextUserCollab,
      favoritedCollaboration: favoriteChange.next
    }, { merge: true });
    writeInteractionEventTx(tx, {
      userId: uid,
      projectId: getProjectId(collabData),
      collaborationId: collaborationIdRaw,
      trackPath: null,
      entityType: "collaboration",
      eventType: INTERACTION_EVENT_TYPES.COLLABORATION_FAVORITE
    }, now);
    return { updated: true };
  });
});

export const unfavoriteCollaboration = onCall({ cors: true }, async (request) => {
  const uid = request.auth?.uid || null;
  if (!uid) throw new HttpsError("unauthenticated", "unauthenticated");

  await checkUserNotSuspended(uid);

  const collaborationIdRaw = String(request.data?.collaborationId || "").trim();
  if (!collaborationIdRaw) {
    throw new HttpsError("invalid-argument", "collaborationId required");
  }

  return db.runTransaction(async (tx) => {
    const now = Timestamp.now();
    const collabRef = db.collection("collaborations").doc(collaborationIdRaw);
    const collabSnap = await tx.get(collabRef);
    if (!collabSnap.exists) {
      throw new HttpsError("not-found", "collaboration not found");
    }

    const collabData = collabSnap.data() as any;
    const status = String(collabData.status || "");
    if (!COLLAB_REACTION_STATUSES.has(status)) {
      throw new HttpsError("failed-precondition", "collaboration not available");
    }

    const { userCollabSnap, userCollabData, userCollabRef } = await getUserCollaborationTx(
      tx,
      uid,
      collaborationIdRaw
    );
    if (userCollabSnap.empty) {
      return { updated: false };
    }

    const nextUserCollab = buildUserCollaborationPayload(uid, collaborationIdRaw, now, userCollabData);
    const favoriteChange = setBooleanValue(nextUserCollab.favoritedCollaboration, false);
    if (!favoriteChange.changed) {
      tx.update(userCollabRef, { lastInteraction: now });
      return { updated: false };
    }

    tx.set(userCollabRef, {
      ...nextUserCollab,
      favoritedCollaboration: favoriteChange.next
    }, { merge: true });
    writeInteractionEventTx(tx, {
      userId: uid,
      projectId: getProjectId(collabData),
      collaborationId: collaborationIdRaw,
      trackPath: null,
      entityType: "collaboration",
      eventType: INTERACTION_EVENT_TYPES.COLLABORATION_UNFAVORITE
    }, now);
    return { updated: true };
  });
});

export const getMyModerationQueue = onCall({ cors: true }, async (request) => {
  const uid = request.auth?.uid || null;
  if (!uid) throw new HttpsError("unauthenticated", "unauthenticated");

  const projectSnap = await db
    .collection("projects")
    .where("ownerId", "==", uid)
    .get();

  if (projectSnap.empty) {
    return { items: [] };
  }

  const projectIds = projectSnap.docs.map((doc) => doc.id);

  const collabSnap = await db
    .collection("collaborations")
    .where("projectId", "in", projectIds.slice(0, 10))
    .where("unmoderatedSubmissions", "==", true)
    .get();

  const items = collabSnap.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      name: data.name || "untitled",
      projectId: data.projectId || null
    };
  });

  return { items };
});

export const getMyProjectsOverview = onCall({ cors: true }, async (request) => {
  const uid = request.auth?.uid || null;
  if (!uid) {
    return { items: [], unauthenticated: true };
  }

  const projectSnap = await db
    .collection("projects")
    .where("ownerId", "==", uid)
    .limit(25)
    .get();

  if (projectSnap.empty) {
    return { items: [] };
  }

  const projects = projectSnap.docs.map((docSnap) => ({
    id: docSnap.id,
    data: docSnap.data(),
  }));

  const collabIds = Array.from(new Set(
    projects
      .map(({ data }) => String((data as any).currentCollaborationId || ""))
      .filter((id) => id)
  ));

  const collabRefs = collabIds.map((id) => db.collection("collaborations").doc(id));
  const collabSnaps = collabRefs.length ? await db.getAll(...collabRefs) : [];
  const collabMap = new Map<string, any>();
  collabSnaps.forEach((snap) => {
    if (snap.exists) {
      collabMap.set(snap.id, snap.data());
    }
  });

  const items = projects.map(({ id, data }) => {
    const createdAt = (data as any).createdAt as Timestamp | undefined;
    const updatedAt = (data as any).updatedAt as Timestamp | undefined;
    const currentCollabId = String((data as any).currentCollaborationId || "");
    const currentCollabData = currentCollabId ? collabMap.get(currentCollabId) || null : null;

    const currentCollaboration = currentCollabData
      ? {
        collabId: currentCollabId,
        name: String(currentCollabData.name || ""),
        status: String(currentCollabData.status || ""),
        publishedAt: currentCollabData.publishedAt
          ? (currentCollabData.publishedAt as Timestamp).toMillis()
          : null,
        submissionCloseAt: currentCollabData.submissionCloseAt
          ? (currentCollabData.submissionCloseAt as Timestamp).toMillis()
          : null,
        votingCloseAt: currentCollabData.votingCloseAt
          ? (currentCollabData.votingCloseAt as Timestamp).toMillis()
          : null,
        submissionDuration:
          typeof currentCollabData.submissionDuration === "number"
            ? currentCollabData.submissionDuration
            : null,
        votingDuration:
          typeof currentCollabData.votingDuration === "number"
            ? currentCollabData.votingDuration
            : null,
        backingPath: String(currentCollabData.backingTrackPath || ""),
        updatedAt: currentCollabData.updatedAt
          ? (currentCollabData.updatedAt as Timestamp).toMillis()
          : null,
      }
      : null;

    return {
      projectId: id,
      projectName: String((data as any).name || ""),
      description: String((data as any).description || ""),
      createdAt: createdAt ? createdAt.toMillis() : null,
      updatedAt: updatedAt ? updatedAt.toMillis() : null,
      currentCollaboration,
    };
  });

  return { items };
});

export const getMyDownloadedCollabs = onCall({ cors: true }, async (request) => {
  const uid = request.auth?.uid || null;
  if (!uid) {
    return { items: [], unauthenticated: true };
  }

  const downloadsSnap = await db
    .collection("userDownloads")
    .where("userId", "==", uid)
    .orderBy("lastDownloadedAt", "desc")
    .limit(20)
    .get();

  if (downloadsSnap.empty) {
    return { items: [] };
  }

  const downloads = downloadsSnap.docs.map((docSnap) => ({
    id: docSnap.id,
    data: docSnap.data() as any,
  }));

  const collabIds = Array.from(
    new Set(
      downloads
        .map(({ data }) => String(data.collaborationId || ""))
        .filter((id) => id)
    )
  );

  const collabRefs = collabIds.map((id) => db.collection("collaborations").doc(id));
  const collabSnaps = collabRefs.length ? await db.getAll(...collabRefs) : [];
  const collabMap = new Map<string, any>();
  collabSnaps.forEach((snap) => {
    if (snap.exists) {
      collabMap.set(snap.id, snap.data());
    }
  });

  const projectIds = Array.from(
    new Set(
      collabSnaps
        .filter((snap) => snap.exists)
        .map((snap) => String((snap.data() as any).projectId || ""))
        .filter((id) => id)
    )
  );
  const projectRefs = projectIds.map((id) => db.collection("projects").doc(id));
  const projectSnaps = projectRefs.length ? await db.getAll(...projectRefs) : [];
  const projectMap = new Map<string, any>();
  projectSnaps.forEach((snap) => {
    if (snap.exists) {
      projectMap.set(snap.id, snap.data());
    }
  });

  const items = downloads.map(({ data }) => {
    const collabId = String(data.collaborationId || "");
    const collab = collabMap.get(collabId) || {};
    const projectId = String(collab.projectId || "");
    const project = projectId ? projectMap.get(projectId) || {} : {};

    return {
      projectId,
      projectName: String(project.name || ""),
      collabId,
      collabName: String(collab.name || ""),
      status: String(collab.status || ""),
      publishedAt: collab.publishedAt ? (collab.publishedAt as Timestamp).toMillis() : null,
      submissionCloseAt: collab.submissionCloseAt ? (collab.submissionCloseAt as Timestamp).toMillis() : null,
      votingCloseAt: collab.votingCloseAt ? (collab.votingCloseAt as Timestamp).toMillis() : null,
      submissionDuration:
        typeof collab.submissionDuration === "number" ? collab.submissionDuration : null,
      votingDuration:
        typeof collab.votingDuration === "number" ? collab.votingDuration : null,
      backingPath: String(collab.backingTrackPath || ""),
      lastDownloadedAt: data.lastDownloadedAt ? (data.lastDownloadedAt as Timestamp).toMillis() : null,
      downloadCount: Number(data.downloadCount || 1),
      updatedAt: collab.updatedAt ? (collab.updatedAt as Timestamp).toMillis() : null,
    };
  });

  return { items };
});

export const getMyAccountStats = onCall({ cors: true }, async (request) => {
  const uid = request.auth?.uid || null;
  if (!uid) {
    return {
      collabs: 0,
      active: 0,
      submissions: 0,
      votes: 0,
      unauthenticated: true
    };
  }

  const [submissionUsersSnap, userCollaborationsSnap, userDownloadsSnap] = await Promise.all([
    db
      .collection("submissionUsers")
      .where("userId", "==", uid)
      .get(),
    db
      .collection("userCollaborations")
      .where("userId", "==", uid)
      .get(),
    db
      .collection("userDownloads")
      .where("userId", "==", uid)
      .get()
  ]);

  const collabIdsSet = new Set<string>();
  submissionUsersSnap.forEach((docSnap) => {
    const collabId = String((docSnap.data() as any).collaborationId || "");
    if (collabId) collabIdsSet.add(collabId);
  });
  userCollaborationsSnap.forEach((docSnap) => {
    const collabId = String((docSnap.data() as any).collaborationId || "");
    if (collabId) collabIdsSet.add(collabId);
  });
  userDownloadsSnap.forEach((docSnap) => {
    const collabId = String((docSnap.data() as any).collaborationId || "");
    if (collabId) collabIdsSet.add(collabId);
  });

  const collabIds = Array.from(collabIdsSet);

  let active = 0;
  const collabRefs = collabIds.map((id) => db.collection("collaborations").doc(id));
  const refChunks = chunkArray(collabRefs, 200);
  for (const refs of refChunks) {
    const collabSnaps = refs.length ? await db.getAll(...refs) : [];
    for (const collabSnap of collabSnaps) {
      if (!collabSnap.exists) continue;
      const status = String((collabSnap.data() as any)?.status || "");
      if (ACTIVE_COLLAB_STATUSES.has(status)) {
        active += 1;
      }
    }
  }

  const votes = userCollaborationsSnap.docs.reduce((sum, docSnap) => {
    const finalVote = (docSnap.data() as any).finalVote;
    return typeof finalVote === "string" && finalVote.trim() ? sum + 1 : sum;
  }, 0);

  return {
    collabs: collabIds.length,
    active,
    submissions: submissionUsersSnap.size,
    votes
  };
});

export const getMyRecommendations = onCall({ cors: true }, async (request) => {
  const uid = request.auth?.uid || null;
  if (!uid) {
    return { items: [], unauthenticated: true };
  }

  const recDoc = await db.collection(RECOMMENDATIONS_COLLECTION).doc(uid).get();
  if (!recDoc.exists) {
    return { items: [] };
  }

  const recData = recDoc.data() as any;
  const entries: Array<{
    rank: number;
    collaborationId: string;
    projectId: string;
    score: number;
    highlightedTrackPath: string | null;
  }> = Array.isArray(recData.recommendations) ? recData.recommendations : [];
  const generatedAt = typeof recData.generatedAt === "string" ? recData.generatedAt : "";
  const modelVersion = typeof recData.modelVersion === "string" ? recData.modelVersion : "";

  const collabIds = entries.map((e) => e.collaborationId).filter((id) => id);
  const projectIdsFromRecs = entries.map((e) => e.projectId).filter((id) => id);
  const allProjectIds = new Set<string>(projectIdsFromRecs);

  const collabRefs = collabIds.map((id) => db.collection("collaborations").doc(id));
  const collabSnaps = collabRefs.length ? await db.getAll(...collabRefs) : [];
  const collabMap = new Map<string, any>();
  for (const snap of collabSnaps) {
    if (snap.exists) {
      const cdata = snap.data() as any;
      collabMap.set(snap.id, cdata);
      if (cdata.projectId) {
        allProjectIds.add(String(cdata.projectId));
      }
    }
  }

  const projectRefs = Array.from(allProjectIds).map((id) => db.collection("projects").doc(id));
  const projectSnaps = projectRefs.length ? await db.getAll(...projectRefs) : [];
  const projectMap = new Map<string, any>();
  projectSnaps.forEach((snap) => {
    if (snap.exists) {
      projectMap.set(snap.id, snap.data());
    }
  });

  const items = entries
    .filter((entry) => entry.collaborationId)
    .map((entry) => {
      const collab = collabMap.get(entry.collaborationId) || {};
      const projectId = String(collab.projectId || entry.projectId || "");
      const project = projectId ? projectMap.get(projectId) || {} : {};

      return {
        collaborationId: entry.collaborationId,
        collaborationName: String(collab.name || ""),
        collaborationStatus: String(collab.status || ""),
        collaborationDescription: String(collab.description || ""),
        collaborationTags: Array.isArray(collab.tags) ? collab.tags : [],
        projectId,
        projectName: String(project.name || ""),
        rank: Number(entry.rank) || 0,
        score: Number(entry.score) || 0,
        highlightedTrackPath:
          typeof entry.highlightedTrackPath === "string" && entry.highlightedTrackPath
            ? entry.highlightedTrackPath
            : null,
        backingTrackPath: String(collab.backingTrackPath || ""),
        backingWaveformPath: String(collab.backingWaveformPath || ""),
        backingWaveformStatus: String(collab.backingWaveformStatus || ""),
        backingWaveformBucketCount:
          typeof collab.backingWaveformBucketCount === "number" ? collab.backingWaveformBucketCount : null,
        backingWaveformVersion:
          typeof collab.backingWaveformVersion === "number" ? collab.backingWaveformVersion : null,
        backingWaveformPreview: collab.backingWaveformPreview || null,
        publishedAt: collab.publishedAt ? (collab.publishedAt as Timestamp).toMillis() : null,
        submissionCloseAt: collab.submissionCloseAt ? (collab.submissionCloseAt as Timestamp).toMillis() : null,
        votingCloseAt: collab.votingCloseAt ? (collab.votingCloseAt as Timestamp).toMillis() : null,
        updatedAt: collab.updatedAt ? (collab.updatedAt as Timestamp).toMillis() : null,
        submissionDurationSeconds:
          typeof collab.submissionDuration === "number" ? collab.submissionDuration : null,
        votingDurationSeconds:
          typeof collab.votingDuration === "number" ? collab.votingDuration : null,
        generatedAt,
        modelVersion
      };
    });

  return { items };
});

export const getDashboardStats = onCall({ cors: true }, async () => {
  const snap = await db.collection("collaborations")
    .where("status", "in", ["published", "submission", "voting", "completed"])
    .get();

  let totalSubmissions = 0;
  let totalVotes = 0;
  let activeCollabs = 0;

  for (const docSnap of snap.docs) {
    const data = docSnap.data() as any;
    const status = String(data.status || "");
    if (status === "published" || status === "submission" || status === "voting") {
      activeCollabs += 1;
    }
    totalSubmissions += Number(data.submissionsCount || 0);
    totalVotes += Number(data.votesCount || 0);
  }

  return {
    totalCollabs: snap.size,
    totalSubmissions,
    totalVotes,
    activeCollabs
  };
});

export const recommendationExport = onRequest(
  { secrets: [RECOMMENDATION_API_TOKEN] },
  async (req, res) => {
    if (req.method !== "GET") {
      res.status(405).json({ error: "method-not-allowed" });
      return;
    }

    try {
      requireRecommendationApiToken(req.headers.authorization);
    } catch (_err) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }

    try {
      const [eventsSnap, collaborationsSnap, projectsSnap, usersSnap] = await Promise.all([
        db.collection(INTERACTION_EVENTS_COLLECTION).orderBy("createdAt", "asc").get(),
        db.collection("collaborations").get(),
        db.collection("projects").get(),
        db.collection("users").get()
      ]);

      const interactionEvents = eventsSnap.docs.map((docSnap) =>
        serializeInteractionEvent(docSnap.id, docSnap.data())
      );
      const collaborations = collaborationsSnap.docs.map((docSnap) =>
        serializeCollaborationForRecommendationExport(docSnap.id, docSnap.data())
      );
      const projects = projectsSnap.docs.map((docSnap) =>
        serializeProjectForRecommendationExport(docSnap.id, docSnap.data())
      );
      const users = usersSnap.docs.map((docSnap) =>
        serializeUserForRecommendationExport(docSnap.id)
      );

      res.status(200).json({
        generatedAt: new Date().toISOString(),
        modelInputVersion: "v1",
        interactionEvents,
        collaborations,
        projects,
        users
      });
    } catch (err) {
      console.error("[recommendationExport] failed", err);
      res.status(500).json({ error: "internal" });
    }
  }
);

export const recommendationImport = onRequest(
  { secrets: [RECOMMENDATION_API_TOKEN] },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "method-not-allowed" });
      return;
    }

    try {
      requireRecommendationApiToken(req.headers.authorization);
    } catch (_err) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }

    const generatedAt = typeof req.body?.generatedAt === "string" ? req.body.generatedAt.trim() : "";
    const modelVersion = typeof req.body?.modelVersion === "string" ? req.body.modelVersion.trim() : "";
    const recommendations = Array.isArray(req.body?.recommendations) ? req.body.recommendations : null;

    if (!generatedAt || !modelVersion || !recommendations) {
      res.status(400).json({ error: "invalid-payload" });
      return;
    }

    const importedAt = Timestamp.now();
    const sanitizedDocs: Array<{
      userId: string;
      recommendations: Array<{
        rank: number;
        collaborationId: string;
        projectId: string;
        score: number;
        highlightedTrackPath: string | null;
      }>;
    }> = [];
    type RecommendationImportItem = {
      rank: number;
      collaborationId: string;
      projectId: string;
      score: number;
      highlightedTrackPath: string | null;
    };

    for (const entry of recommendations) {
      const userId = typeof entry?.userId === "string" ? entry.userId.trim() : "";
      const items = Array.isArray(entry?.collaborations) ? entry.collaborations : null;
      if (!userId || !items) {
        res.status(400).json({ error: "invalid-recommendation-entry" });
        return;
      }

      const sanitizedItems = items
        .map((item: any): RecommendationImportItem => ({
          rank: Number(item?.rank),
          collaborationId: typeof item?.collaborationId === "string" ? item.collaborationId.trim() : "",
          projectId: typeof item?.projectId === "string" ? item.projectId.trim() : "",
          score: Number(item?.score),
          highlightedTrackPath: typeof item?.highlightedTrackPath === "string" &&
            item.highlightedTrackPath.trim()
            ? item.highlightedTrackPath.trim()
            : null
        }))
        .filter((item: RecommendationImportItem) =>
          Number.isFinite(item.rank) &&
          item.rank > 0 &&
          item.collaborationId &&
          item.projectId &&
          Number.isFinite(item.score)
        )
        .sort((a: RecommendationImportItem, b: RecommendationImportItem) => a.rank - b.rank);

      sanitizedDocs.push({
        userId,
        recommendations: sanitizedItems
      });
    }

    try {
      for (const chunk of chunkArray(sanitizedDocs, 400)) {
        const batch = db.batch();
        for (const doc of chunk) {
          const docRef = db.collection(RECOMMENDATIONS_COLLECTION).doc(doc.userId);
          batch.set(docRef, {
            userId: doc.userId,
            generatedAt,
            modelVersion,
            importedAt,
            recommendations: doc.recommendations
          });
        }
        await batch.commit();
      }

      res.status(200).json({
        ok: true,
        usersWritten: sanitizedDocs.length,
        modelVersion
      });
    } catch (err) {
      console.error("[recommendationImport] failed", err);
      res.status(500).json({ error: "internal" });
    }
  }
);

export const syncTagsOnProjectWrite = onDocumentWritten(
  "projects/{projectId}",
  async (event) => {
    const before = event.data?.before?.data() as any;
    const after = event.data?.after?.data() as any;

    const oldTags = (before?.tagsKey || []) as string[];
    const newTags = (after?.tagsKey || []) as string[];

    const removed = oldTags.filter((t) => !newTags.includes(t));
    const added = newTags.filter((t) => !oldTags.includes(t));

    const now = Timestamp.now();

    for (const tagKey of removed) {
      const tagRef = db.collection("tags").doc(tagKey);
      await db.runTransaction(async (tx) => {
        const tagSnap = await tx.get(tagRef);
        if (!tagSnap.exists) return;
        const data = tagSnap.data() as any;
        const newCount = Math.max(0, (data.projectCount || 0) - 1);
        tx.update(tagRef, { projectCount: newCount, lastUpdatedAt: now });
      });
    }

    for (const tagKey of added) {
      const tagRef = db.collection("tags").doc(tagKey);
      const displayTag = after?.tags?.[newTags.indexOf(tagKey)] || tagKey;

      await db.runTransaction(async (tx) => {
        const tagSnap = await tx.get(tagRef);
        if (tagSnap.exists) {
          const data = tagSnap.data() as any;
          tx.update(tagRef, {
            projectCount: (data.projectCount || 0) + 1,
            lastUpdatedAt: now,
          });
        } else {
          tx.set(tagRef, {
            name: displayTag,
            key: tagKey,
            projectCount: 1,
            collaborationCount: 0,
            createdAt: now,
            lastUpdatedAt: now,
          });
        }
      });
    }
  }
);

export const syncTagsOnCollaborationWrite = onDocumentWritten(
  "collaborations/{collaborationId}",
  async (event) => {
    const before = event.data?.before?.data() as any;
    const after = event.data?.after?.data() as any;

    const oldTags = (before?.tagsKey || []) as string[];
    const newTags = (after?.tagsKey || []) as string[];

    const removed = oldTags.filter((t) => !newTags.includes(t));
    const added = newTags.filter((t) => !oldTags.includes(t));

    const now = Timestamp.now();

    for (const tagKey of removed) {
      const tagRef = db.collection("tags").doc(tagKey);
      await db.runTransaction(async (tx) => {
        const tagSnap = await tx.get(tagRef);
        if (!tagSnap.exists) return;
        const data = tagSnap.data() as any;
        const newCount = Math.max(0, (data.collaborationCount || 0) - 1);
        tx.update(tagRef, { collaborationCount: newCount, lastUpdatedAt: now });
      });
    }

    for (const tagKey of added) {
      const tagRef = db.collection("tags").doc(tagKey);
      const displayTag = after?.tags?.[newTags.indexOf(tagKey)] || tagKey;

      await db.runTransaction(async (tx) => {
        const tagSnap = await tx.get(tagRef);
        if (tagSnap.exists) {
          const data = tagSnap.data() as any;
          tx.update(tagRef, {
            collaborationCount: (data.collaborationCount || 0) + 1,
            lastUpdatedAt: now,
          });
        } else {
          tx.set(tagRef, {
            name: displayTag,
            key: tagKey,
            projectCount: 0,
            collaborationCount: 1,
            createdAt: now,
            lastUpdatedAt: now,
          });
        }
      });
    }

    const collabId = event.params.collaborationId;
    const afterProjectId = String(after?.projectId || "");
    const beforeProjectId = String(before?.projectId || "");
    const updates: Promise<unknown>[] = [];

    if (afterProjectId) {
      const projectRef = db.collection("projects").doc(afterProjectId);
      if (after && ACTIVE_COLLAB_STATUSES.has(String(after.status || ""))) {
        const stageEndsAt = after.status === "submission"
          ? after.submissionCloseAt ?? null
          : after.status === "voting"
            ? after.votingCloseAt ?? null
            : null;
        updates.push(projectRef.set({
          currentCollaborationId: collabId,
          currentCollaborationStatus: after.status ?? null,
          currentCollaborationStageEndsAt: stageEndsAt ?? null,
          updatedAt: now,
        }, { merge: true }));
      } else {
        updates.push(db.runTransaction(async (tx) => {
          const snap = await tx.get(projectRef);
          if (!snap.exists) return;
          const projectData = snap.data() as any;
          if (projectData.currentCollaborationId === collabId) {
            tx.update(projectRef, {
              currentCollaborationId: null,
              currentCollaborationStatus: null,
              currentCollaborationStageEndsAt: null,
              updatedAt: now,
            });
          }
        }));
      }
    }

    if (beforeProjectId && (!afterProjectId || beforeProjectId !== afterProjectId)) {
      const prevProjectRef = db.collection("projects").doc(beforeProjectId);
      updates.push(db.runTransaction(async (tx) => {
        const snap = await tx.get(prevProjectRef);
        if (!snap.exists) return;
        const projectData = snap.data() as any;
        if (projectData.currentCollaborationId === collabId) {
          tx.update(prevProjectRef, {
            currentCollaborationId: null,
            currentCollaborationStatus: null,
            currentCollaborationStageEndsAt: null,
            updatedAt: now,
          });
        }
      }));
    }

    await Promise.all(updates);
  }
);

export const cleanupProjectOnDelete = onDocumentDeleted(
  "projects/{projectId}",
  async (event) => {
    const projectId = event.params.projectId;
    if (!projectId) return;

    const projectData = event.data?.data() as any | undefined;
    const projectName = typeof projectData?.name === "string" ? projectData.name : "";
    const ownerId = typeof projectData?.ownerId === "string" ? projectData.ownerId : "";
    const startedAt = Timestamp.now();

    console.log(`[cleanupProjectOnDelete] started for project=${projectId}`);

    if (ownerId) {
      try {
        const ownerProjectsQuery = db.collection("projects").where("ownerId", "==", ownerId);
        let projectCount = 0;
        if (typeof (ownerProjectsQuery as any).count === "function") {
          const countSnap = await (ownerProjectsQuery as any).count().get();
          projectCount = Number(countSnap.data()?.count || 0);
        } else {
          const ownerProjectsSnap = await ownerProjectsQuery.get();
          projectCount = ownerProjectsSnap.size;
        }
        await db.collection("users").doc(ownerId).set({ projectCount }, { merge: true });
        console.log(`[cleanupProjectOnDelete] updated projectCount=${projectCount} for owner=${ownerId}`);
      } catch (err) {
        console.error(`[cleanupProjectOnDelete] failed to update projectCount for owner=${ownerId}`, err);
      }
    }

    const historyRef = db.collection(PROJECT_DELETION_HISTORY_COLLECTION).doc();
    await historyRef.set({
      projectId,
      projectName,
      ownerId,
      startedAt,
      lastUpdatedAt: startedAt,
      status: "started",
      collaborationCount: 0,
      submissionUserCount: 0,
      userCollaborationCount: 0,
      userDownloadCount: 0,
      reportCount: 0,
      resolvedReportCount: 0,
      storagePathCount: 0,
      storagePathSample: [],
    });

    try {
      const collabSnap = await db
        .collection("collaborations")
        .where("projectId", "==", projectId)
        .get();

      if (collabSnap.empty) {
        const finishedAt = Timestamp.now();
        await historyRef.update({
          status: "completed",
          collaborationCount: 0,
          submissionUserCount: 0,
          dbCleanupCompletedAt: finishedAt,
          storageCleanupCompletedAt: finishedAt,
          lastUpdatedAt: finishedAt,
          notes: "project had no collaborations",
        });
        console.log(`[cleanupProjectOnDelete] no collaborations for project=${projectId}`);
        return;
      }

      type CollabCleanupContext = {
        id: string;
        name: string;
        docRef: FirebaseFirestore.DocumentReference;
        detailRef: FirebaseFirestore.DocumentReference;
        detailExists: boolean;
        submissionUserDocs: FirebaseFirestore.QueryDocumentSnapshot[];
        userCollaborationDocs: FirebaseFirestore.QueryDocumentSnapshot[];
        userDownloadDocs: FirebaseFirestore.QueryDocumentSnapshot[];
        reportDocs: FirebaseFirestore.QueryDocumentSnapshot[];
        resolvedReportDocs: FirebaseFirestore.QueryDocumentSnapshot[];
        storagePrefix: string;
        orphanPaths: string[];
      };

      const contexts: CollabCleanupContext[] = [];
      const storagePathSet = new Set<string>();
      const storagePathSample: string[] = [];

      let totalSubmissionUsers = 0;
      let totalUserCollaborations = 0;
      let totalUserDownloads = 0;
      let totalReports = 0;
      let totalResolvedReports = 0;

      for (const collabDoc of collabSnap.docs) {
        const collabData = collabDoc.data() as any;
        const collabId = collabDoc.id;
        const collabName = typeof collabData?.name === "string" ? collabData.name : "";
        const storagePrefix = `collabs/${collabId}/`;

        const detailRef = db.collection("collaborationDetails").doc(collabId);
        const detailSnap = await detailRef.get();

        const collabOrphanPaths = new Set<string>();
        const recordPath = (raw: unknown) => {
          const path = typeof raw === "string" ? raw.trim() : "";
          if (!path) return;
          if (!storagePathSet.has(path)) {
            storagePathSet.add(path);
            if (storagePathSample.length < 25) {
              storagePathSample.push(path);
            }
          }
          if (!path.startsWith(storagePrefix)) {
            collabOrphanPaths.add(path);
          }
        };

        recordPath(collabData?.backingTrackPath);
        recordPath(collabData?.backingWaveformPath);
        recordPath(collabData?.winnerPath);
        if (Array.isArray(collabData?.submissionPaths)) {
          for (const p of collabData.submissionPaths) {
            recordPath(p);
          }
        }

        let detailExists = false;
        if (detailSnap.exists) {
          detailExists = true;
          const detailData = detailSnap.data() as any;
          if (Array.isArray(detailData?.submissions)) {
            for (const submission of detailData.submissions) {
              recordPath((submission as any)?.path);
              recordPath((submission as any)?.optimizedPath);
              recordPath((submission as any)?.waveformPath);
              recordPath((submission as any)?.multitrackZipPath);
            }
          }
          if (Array.isArray(detailData?.submissionPaths)) {
            for (const p of detailData.submissionPaths) {
              recordPath(p);
            }
          }
        }

        const submissionUsersSnap = await db
          .collection("submissionUsers")
          .where("collaborationId", "==", collabId)
          .get();
        totalSubmissionUsers += submissionUsersSnap.size;
        for (const subDoc of submissionUsersSnap.docs) {
          const subData = subDoc.data() as any;
          recordPath(subData?.path);
          recordPath(subData?.optimizedPath);
        }

        const userCollaborationSnap = await db
          .collection("userCollaborations")
          .where("collaborationId", "==", collabId)
          .get();
        totalUserCollaborations += userCollaborationSnap.size;

        const userDownloadsSnap = await db
          .collection("userDownloads")
          .where("collaborationId", "==", collabId)
          .get();
        totalUserDownloads += userDownloadsSnap.size;

        const reportsSnap = await db
          .collection("reports")
          .where("collaborationId", "==", collabId)
          .get();
        totalReports += reportsSnap.size;

        const resolvedReportsSnap = await db
          .collection("resolvedReports")
          .where("collaborationId", "==", collabId)
          .get();
        totalResolvedReports += resolvedReportsSnap.size;

        contexts.push({
          id: collabId,
          name: collabName,
          docRef: collabDoc.ref,
          detailRef,
          detailExists,
          submissionUserDocs: submissionUsersSnap.docs,
          userCollaborationDocs: userCollaborationSnap.docs,
          userDownloadDocs: userDownloadsSnap.docs,
          reportDocs: reportsSnap.docs,
          resolvedReportDocs: resolvedReportsSnap.docs,
          storagePrefix,
          orphanPaths: Array.from(collabOrphanPaths),
        });
      }

      await historyRef.update({
        collaborationCount: contexts.length,
        collaborationIds: contexts.map((ctx) => ctx.id),
        submissionUserCount: totalSubmissionUsers,
        userCollaborationCount: totalUserCollaborations,
        userDownloadCount: totalUserDownloads,
        reportCount: totalReports,
        resolvedReportCount: totalResolvedReports,
        storagePathCount: storagePathSet.size,
        storagePathSample,
        lastUpdatedAt: Timestamp.now(),
      });

      const deletionMarker = Timestamp.now();

      let updatedSubmissionUsers = 0;
      let deletedCollaborationDocs = 0;
      let deletedDetailDocs = 0;
      let deletedUserCollaborationDocs = 0;
      let deletedUserDownloadDocs = 0;
      let deletedReportDocs = 0;
      let deletedResolvedReportDocs = 0;

      const dbErrors: Array<{ collabId: string; stage: string; message: string }> = [];
      const noteDbError = (collabId: string, stage: string, err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        dbErrors.push({ collabId, stage, message });
        console.error(`[cleanupProjectOnDelete] Firestore cleanup error project=${projectId} collab=${collabId} stage=${stage}: ${message}`);
      };

      for (const ctx of contexts) {
        const submissionUpdateTime = Timestamp.now();
        for (const submissionDoc of ctx.submissionUserDocs) {
          try {
            await submissionDoc.ref.update({
              collaborationDeleted: true,
              collaborationDeletedAt: deletionMarker,
              collaborationDeletedByProjectId: projectId,
              lastKnownProjectName: projectName,
              lastKnownCollaborationName: ctx.name,
              storageDeletionPending: true,
              storageDeletionError: null,
              storageDeletionLastCheckedAt: submissionUpdateTime,
            });
            updatedSubmissionUsers++;
          } catch (err) {
            noteDbError(ctx.id, "update-submission-user", err);
          }
        }

        if (ctx.detailExists) {
          try {
            await ctx.detailRef.delete();
            deletedDetailDocs++;
          } catch (err) {
            noteDbError(ctx.id, "delete-collaboration-detail", err);
          }
        }

        for (const doc of ctx.userCollaborationDocs) {
          try {
            await doc.ref.delete();
            deletedUserCollaborationDocs++;
          } catch (err) {
            noteDbError(ctx.id, "delete-user-collaboration", err);
          }
        }

        for (const doc of ctx.userDownloadDocs) {
          try {
            await doc.ref.delete();
            deletedUserDownloadDocs++;
          } catch (err) {
            noteDbError(ctx.id, "delete-user-download", err);
          }
        }

        for (const doc of ctx.reportDocs) {
          try {
            await doc.ref.delete();
            deletedReportDocs++;
          } catch (err) {
            noteDbError(ctx.id, "delete-report", err);
          }
        }

        for (const doc of ctx.resolvedReportDocs) {
          try {
            await doc.ref.delete();
            deletedResolvedReportDocs++;
          } catch (err) {
            noteDbError(ctx.id, "delete-resolved-report", err);
          }
        }

        try {
          await ctx.docRef.delete();
          deletedCollaborationDocs++;
        } catch (err) {
          noteDbError(ctx.id, "delete-collaboration", err);
        }
      }

      const dbStageCompletedAt = Timestamp.now();
      await historyRef.update({
        dbCleanupCompletedAt: dbStageCompletedAt,
        lastUpdatedAt: dbStageCompletedAt,
        updatedSubmissionUsers,
        deletedCollaborationDocs,
        deletedDetailDocs,
        deletedUserCollaborationDocs,
        deletedUserDownloadDocs,
        deletedReportDocs,
        deletedResolvedReportDocs,
        dbErrors,
        status: dbErrors.length ? "db-error" : "storage-pending",
      });

      if (dbErrors.length) {
        throw new Error(`Firestore cleanup incomplete for project ${projectId}`);
      }

      const bucket = storageAdmin.bucket();
      let storagePrefixesDeleted = 0;
      let orphanFilesDeleted = 0;
      const storageErrors: Array<{ collabId: string; stage: string; message: string; path?: string }> = [];
      const collabStorageErrors = new Map<string, string[]>();
      const noteStorageError = (collabId: string, stage: string, err: unknown, path?: string) => {
        const message = err instanceof Error ? err.message : String(err);
        storageErrors.push({ collabId, stage, message, path });
        const existing = collabStorageErrors.get(collabId) ?? [];
        existing.push(path ? `${stage}:${path}:${message}` : `${stage}:${message}`);
        collabStorageErrors.set(collabId, existing);
        console.error(`[cleanupProjectOnDelete] Storage cleanup error project=${projectId} collab=${collabId} stage=${stage}: ${message}`);
      };

      for (const ctx of contexts) {
        try {
          await bucket.deleteFiles({ prefix: ctx.storagePrefix, force: true });
          storagePrefixesDeleted++;
        } catch (err) {
          noteStorageError(ctx.id, "prefix", err);
        }

        for (const orphanPath of ctx.orphanPaths) {
          try {
            await bucket.file(orphanPath).delete({ ignoreNotFound: true });
            orphanFilesDeleted++;
          } catch (err) {
            noteStorageError(ctx.id, "orphan", err, orphanPath);
          }
        }

        const storageUpdateTime = Timestamp.now();
        const collabErrors = collabStorageErrors.get(ctx.id) ?? [];
        const submissionStorageUpdate: Record<string, unknown> = {
          storageDeletionPending: false,
          storageDeletionLastCheckedAt: storageUpdateTime,
        };
        if (collabErrors.length === 0) {
          submissionStorageUpdate.storageDeletedAt = storageUpdateTime;
          submissionStorageUpdate.storageDeletionError = null;
        } else {
          submissionStorageUpdate.storageDeletionError = collabErrors.join(" | ").slice(0, 900);
        }

        for (const submissionDoc of ctx.submissionUserDocs) {
          try {
            await submissionDoc.ref.update(submissionStorageUpdate);
          } catch (err) {
            noteStorageError(ctx.id, "update-submission-user-post-storage", err);
          }
        }
      }

      const storageCompletedAt = Timestamp.now();
      await historyRef.update({
        storageCleanupCompletedAt: storageCompletedAt,
        storagePrefixesRequested: contexts.length,
        storagePrefixesDeleted,
        storageOrphanFilesAttempted: contexts.reduce((acc, ctx) => acc + ctx.orphanPaths.length, 0),
        storageOrphanFilesDeleted: orphanFilesDeleted,
        storageErrors,
        lastUpdatedAt: storageCompletedAt,
        status: storageErrors.length ? "storage-error" : "completed",
      });

      if (storageErrors.length) {
        throw new Error(`Storage cleanup incomplete for project ${projectId}`);
      }

      console.log(`[cleanupProjectOnDelete] completed project=${projectId}`);
    } catch (err) {
      console.error(`[cleanupProjectOnDelete] failed for project=${projectId}`, err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      await historyRef.set({
        failureMessage: errorMessage,
        lastUpdatedAt: Timestamp.now(),
      }, { merge: true }).catch(() => { });
      throw err;
    }
  }
);

export const ensureCollaborationDetail = onDocumentCreated(
  "collaborations/{collaborationId}",
  async (event) => {
    const collabId = event.params.collaborationId;
    if (!collabId) return;
    const detailRef = db.collection("collaborationDetails").doc(collabId);
    const detailSnap = await detailRef.get();
    if (detailSnap.exists) return;
    const now = Timestamp.now();
    await detailRef.set({
      collaborationId: collabId,
      submissions: [],
      submissionPaths: [],
      createdAt: now,
      updatedAt: now,
    });
  }
);

export const banUserBySubmission = onCall({ cors: true }, async (request) => {
  const uid = request.auth?.uid || null;
  if (!uid) throw new HttpsError("unauthenticated", "unauthenticated");

  const userRef = db.collection("users").doc(uid);
  const userSnap = await userRef.get();
  if (!userSnap.exists) {
    throw new HttpsError("permission-denied", "user not found");
  }
  const userData = userSnap.data() as any;
  if (!userData.isAdmin) {
    throw new HttpsError("permission-denied", "admin access required");
  }

  const reportId = String(request.data?.reportId || "").trim();
  const submissionPath = String(request.data?.submissionPath || "").trim();
  const collaborationId = String(request.data?.collaborationId || "").trim();

  if (!reportId || !submissionPath || !collaborationId) {
    throw new HttpsError("invalid-argument", "reportId, submissionPath, and collaborationId required");
  }

  return db.runTransaction(async (tx) => {
    const submissionUserQuery = db
      .collection("submissionUsers")
      .where("path", "==", submissionPath)
      .where("collaborationId", "==", collaborationId)
      .limit(1);

    const reportRef = db.collection("reports").doc(reportId);

    const [submissionUserSnap, reportSnap] = await Promise.all([
      tx.get(submissionUserQuery),
      tx.get(reportRef)
    ]);

    if (submissionUserSnap.empty) {
      throw new HttpsError("not-found", "submission user not found");
    }

    if (!reportSnap.exists) {
      throw new HttpsError("not-found", "report not found");
    }

    const submissionUserData = submissionUserSnap.docs[0].data() as any;
    const reportedUserId = String(submissionUserData.userId || "");

    if (!reportedUserId) {
      throw new HttpsError("not-found", "user ID not found in submission");
    }

    const reportedUserRef = db.collection("users").doc(reportedUserId);
    const reportedUserSnap = await tx.get(reportedUserRef);

    if (!reportedUserSnap.exists) {
      throw new HttpsError("not-found", "reported user profile not found");
    }

    const now = Timestamp.now();
    const reportData = reportSnap.data() as any;

    tx.update(reportedUserRef, {
      banned: true,
      bannedAt: now,
      bannedBy: uid
    });

    tx.update(reportRef, {
      status: "user-banned",
      resolvedAt: now,
      resolvedBy: uid,
      reportedUserId
    });

    const resolvedReportRef = db.collection("resolvedReports").doc();
    tx.set(resolvedReportRef, {
      ...reportData,
      originalReportId: reportId,
      status: "user-banned",
      resolvedAt: now,
      resolvedBy: uid,
      reportedUserId,
      bannedUserId: reportedUserId
    });

    return {
      success: true,
      bannedUserId: reportedUserId
    };
  });
});

export const adminListUsers = onCall({ cors: true }, async (request) => {
  const uid = request.auth?.uid || null;
  if (!uid) {
    throw new HttpsError("unauthenticated", "unauthenticated");
  }

  const adminSnap = await db.collection("users").doc(uid).get();
  if (!adminSnap.exists || !adminSnap.data()?.isAdmin) {
    throw new HttpsError("permission-denied", "Admin access required");
  }

  const pageSize = Math.max(1, Math.min(100, Number(request.data?.pageSize) || 25));
  const pageToken = typeof request.data?.pageToken === "string" && request.data.pageToken ? request.data.pageToken : null;

  let query = db.collection("users").orderBy("createdAt", "desc").limit(pageSize + 1) as any;

  if (pageToken) {
    const cursorSnap = await db.collection("users").doc(pageToken).get();
    if (cursorSnap.exists) {
      query = query.startAfter(cursorSnap);
    }
  }

  const usersSnap = await query.get();
  const docs = usersSnap.docs;
  const hasMore = docs.length > pageSize;
  const visibleDocs = hasMore ? docs.slice(0, pageSize) : docs;

  const users = visibleDocs.map((doc: any) => ({
    uid: doc.id,
    ...doc.data()
  }));

  return {
    users,
    nextPageToken: hasMore && visibleDocs.length > 0 ? visibleDocs[visibleDocs.length - 1].id : null,
    hasMore
  };
});

export const adminSearchUsers = onCall({ cors: true }, async (request) => {
  const uid = request.auth?.uid || null;
  if (!uid) {
    throw new HttpsError("unauthenticated", "unauthenticated");
  }

  const adminSnap = await db.collection("users").doc(uid).get();
  if (!adminSnap.exists || !adminSnap.data()?.isAdmin) {
    throw new HttpsError("permission-denied", "Admin access required");
  }

  const { searchQuery, pageSize: rawPageSize } = request.data;
  if (!searchQuery || typeof searchQuery !== "string") {
    throw new HttpsError("invalid-argument", "Search query required");
  }

  const pageToken = typeof request.data?.pageToken === "string" && request.data.pageToken ? request.data.pageToken : null;
  const pageSize = Math.max(1, Math.min(100, Number(rawPageSize) || 25));
  const normalizedQuery = searchQuery.toLowerCase().trim();
  const batchSize = Math.min(200, Math.max(pageSize * 3, 50));
  const maxBatches = 10;

  const matchesSearch = (docId: string, data: any) => {
    const haystacks = [
      docId,
      typeof data?.email === "string" ? data.email : "",
      typeof data?.username === "string" ? data.username : ""
    ].map((value) => value.toLowerCase());
    return haystacks.some((value) => value.includes(normalizedQuery));
  };

  let cursorSnap: FirebaseFirestore.DocumentSnapshot | null = null;
  if (pageToken) {
    const snap = await db.collection("users").doc(pageToken).get();
    if (snap.exists) {
      cursorSnap = snap;
    }
  }

  const users: any[] = [];
  let nextPageToken: string | null = null;
  let hasMore = false;

  for (let batchIndex = 0; batchIndex < maxBatches && users.length < pageSize; batchIndex += 1) {
    let searchPageQuery = db.collection("users").orderBy("createdAt", "desc").limit(batchSize) as any;
    if (cursorSnap) {
      searchPageQuery = searchPageQuery.startAfter(cursorSnap);
    }

    const usersSnap = await searchPageQuery.get();
    if (usersSnap.empty) {
      break;
    }

    const docs = usersSnap.docs;
    let consumedIndex = docs.length - 1;

    for (let i = 0; i < docs.length; i += 1) {
      const docSnap = docs[i];
      consumedIndex = i;
      const data = docSnap.data();
      if (!matchesSearch(docSnap.id, data)) {
        continue;
      }

      users.push({
        uid: docSnap.id,
        ...data
      });

      if (users.length >= pageSize) {
        break;
      }
    }

    const consumedDoc = docs[consumedIndex];
    const moreDocsInBatch = consumedIndex < docs.length - 1;
    const moreDocsAfterBatch = docs.length === batchSize;

    if (users.length >= pageSize) {
      hasMore = moreDocsInBatch || moreDocsAfterBatch;
      nextPageToken = hasMore && consumedDoc ? consumedDoc.id : null;
      break;
    }

    if (!moreDocsAfterBatch) {
      break;
    }

    const lastDoc = docs[docs.length - 1];
    cursorSnap = lastDoc;
    nextPageToken = lastDoc.id;
    hasMore = true;
  }

  return {
    users,
    nextPageToken,
    hasMore
  };
});

export const adminUpdateUser = onCall({ cors: true }, async (request) => {
  const uid = request.auth?.uid || null;
  if (!uid) {
    throw new HttpsError("unauthenticated", "unauthenticated");
  }

  const adminSnap = await db.collection("users").doc(uid).get();
  const adminData = adminSnap.data();
  if (!adminSnap.exists || !adminData?.isAdmin) {
    throw new HttpsError("permission-denied", "Admin access required");
  }

  const { targetUserId, updates } = request.data;
  if (!targetUserId || typeof targetUserId !== "string") {
    throw new HttpsError("invalid-argument", "Target user ID required");
  }

  const targetUserRef = db.collection("users").doc(targetUserId);
  const targetSnap = await targetUserRef.get();
  if (!targetSnap.exists) {
    throw new HttpsError("not-found", "User not found");
  }

  const targetData = targetSnap.data() as any;
  const now = Timestamp.now();
  const changes: Record<string, { from: any; to: any }> = {};

  const updateData: Record<string, any> = {};

  if (updates.bonusProjects !== undefined && updates.bonusProjects !== targetData.bonusProjects) {
    changes.bonusProjects = { from: targetData.bonusProjects ?? 0, to: updates.bonusProjects };
    updateData.bonusProjects = updates.bonusProjects;
  }

  if (updates.suspended !== undefined && updates.suspended !== targetData.suspended) {
    changes.suspended = { from: targetData.suspended ?? false, to: updates.suspended };
    updateData.suspended = updates.suspended;
    if (updates.suspended) {
      updateData.suspendedAt = now;
      updateData.suspendedBy = uid;
    } else {
      updateData.suspendedAt = null;
      updateData.suspendedBy = null;
    }
  }

  if (Object.keys(updateData).length === 0) {
    return { success: true, message: "No changes to apply" };
  }

  await targetUserRef.update(updateData);

  const action = updates.suspended === true ? "suspend-user" :
    updates.suspended === false ? "unsuspend-user" : "update-user";

  await db.collection("adminLogs").add({
    adminUid: uid,
    adminEmail: adminData.email || "unknown",
    action,
    targetUserId,
    changes,
    createdAt: now
  });

  return { success: true };
});

export const adminRunHsdTest = onCall(
  { secrets: [HSD_API_TOKEN, HSD_SERVICE_URL], cors: true },
  async (request) => {
    const uid = request.auth?.uid || null;
    if (!uid) {
      throw new HttpsError("unauthenticated", "unauthenticated");
    }

    const adminSnap = await db.collection("users").doc(uid).get();
    if (!adminSnap.exists || !adminSnap.data()?.isAdmin) {
      throw new HttpsError("permission-denied", "Admin access required");
    }

    const text = String(request.data?.text ?? "").trim();
    const entityType = String(request.data?.entityType ?? "").trim() as HsdEntityType;
    const entityIdRaw = String(request.data?.entityId ?? "").trim();

    if (!text) {
      throw new HttpsError("invalid-argument", "text required");
    }

    if (![
      "project_name",
      "project_description",
      "collaboration_name",
      "collaboration_description"
    ].includes(entityType)) {
      throw new HttpsError("invalid-argument", "invalid entityType");
    }

    const requestId = crypto.randomUUID();
    const startedAt = Date.now();
    const result = await callHsdService({
      backendId: HSD_BACKEND_ID,
      requestId,
      entityType,
      entityId: entityIdRaw || undefined,
      text
    });

    return {
      requestId,
      entityType,
      entityId: entityIdRaw || null,
      text,
      elapsedMs: Date.now() - startedAt,
      ...result
    };
  }
);

export const adminListProjects = onCall({ cors: true }, async (request) => {
  const uid = request.auth?.uid || null;
  if (!uid) {
    throw new HttpsError("unauthenticated", "unauthenticated");
  }

  const adminSnap = await db.collection("users").doc(uid).get();
  if (!adminSnap.exists || !adminSnap.data()?.isAdmin) {
    throw new HttpsError("permission-denied", "Admin access required");
  }

  const pageSize = Math.max(1, Math.min(50, Number(request.data?.pageSize) || 25));
  const pageToken = typeof request.data?.pageToken === "string" && request.data.pageToken ? request.data.pageToken : null;

  let query = db.collection("projects").orderBy("createdAt", "desc").limit(pageSize + 1);

  if (pageToken) {
    const cursorSnap = await db.collection("projects").doc(pageToken).get();
    if (cursorSnap.exists) {
      query = query.startAfter(cursorSnap);
    }
  }

  const projectsSnap = await query.get();
  const docs = projectsSnap.docs;
  const hasMore = docs.length > pageSize;
  const visibleDocs = hasMore ? docs.slice(0, pageSize) : docs;

  const projects = visibleDocs.map((docSnap) => {
    const data = docSnap.data() as any;
    return {
      id: docSnap.id,
      name: String(data.name || ""),
      description: String(data.description || ""),
      ownerId: String(data.ownerId || ""),
      tags: Array.isArray(data.tags) ? data.tags : [],
      createdAt: data.createdAt ? (data.createdAt as Timestamp).toMillis() : null,
      updatedAt: data.updatedAt ? (data.updatedAt as Timestamp).toMillis() : null
    };
  });

  // Batch-fetch collaborations for these projects
  const projectIds = projects.map((p) => p.id);
  const collabMap = new Map<string, any[]>();

  if (projectIds.length > 0) {
    const collabPromises = projectIds.map((projectId) =>
      db.collection("collaborations").where("projectId", "==", projectId).limit(100).get()
    );
    const collabResults = await Promise.all(collabPromises);
    projectIds.forEach((projectId, i) => {
      collabMap.set(
        projectId,
        collabResults[i].docs.map((d) => {
          const cd = d.data() as any;
          return {
            id: d.id,
            name: String(cd.name || ""),
            description: String(cd.description || ""),
            status: String(cd.status || ""),
            submissionDuration: typeof cd.submissionDuration === "number" ? cd.submissionDuration : null,
            votingDuration: typeof cd.votingDuration === "number" ? cd.votingDuration : null,
            tags: Array.isArray(cd.tags) ? cd.tags : [],
            createdAt: cd.createdAt ? (cd.createdAt as Timestamp).toMillis() : null,
            updatedAt: cd.updatedAt ? (cd.updatedAt as Timestamp).toMillis() : null
          };
        })
      );
    });
  }

  const items = projects.map((project) => ({
    project,
    collaborations: collabMap.get(project.id) || []
  }));

  return {
    items,
    nextPageToken: hasMore && visibleDocs.length > 0 ? visibleDocs[visibleDocs.length - 1].id : null,
    hasMore
  };
});

export const adminListPendingReports = onCall({ cors: true }, async (request) => {
  const uid = request.auth?.uid || null;
  if (!uid) {
    throw new HttpsError("unauthenticated", "unauthenticated");
  }

  const adminSnap = await db.collection("users").doc(uid).get();
  if (!adminSnap.exists || !adminSnap.data()?.isAdmin) {
    throw new HttpsError("permission-denied", "Admin access required");
  }

  const pageSize = Math.max(1, Math.min(50, Number(request.data?.pageSize) || 25));
  const pageToken = typeof request.data?.pageToken === "string" && request.data.pageToken ? request.data.pageToken : null;

  let query = db.collection("reports")
    .where("status", "==", "pending")
    .orderBy("createdAt", "desc")
    .limit(pageSize + 1);

  if (pageToken) {
    const cursorSnap = await db.collection("reports").doc(pageToken).get();
    if (cursorSnap.exists) {
      query = query.startAfter(cursorSnap);
    }
  }

  const snap = await query.get();
  const docs = snap.docs;
  const hasMore = docs.length > pageSize;
  const visibleDocs = hasMore ? docs.slice(0, pageSize) : docs;

  const reports = visibleDocs.map((docSnap) => {
    const data = docSnap.data() as any;
    return {
      id: docSnap.id,
      submissionPath: String(data.submissionPath || ""),
      collaborationId: String(data.collaborationId || ""),
      reportedBy: String(data.reportedBy || ""),
      reportedByUsername: String(data.reportedByUsername || ""),
      reason: String(data.reason || ""),
      status: String(data.status || "pending"),
      createdAt: data.createdAt ? (data.createdAt as Timestamp).toMillis() : null,
      resolvedAt: data.resolvedAt ? (data.resolvedAt as Timestamp).toMillis() : null,
      resolvedBy: data.resolvedBy || null,
      reportedUserId: data.reportedUserId || null
    };
  });

  return {
    reports,
    nextPageToken: hasMore && visibleDocs.length > 0 ? visibleDocs[visibleDocs.length - 1].id : null,
    hasMore
  };
});

export const adminListResolvedReports = onCall({ cors: true }, async (request) => {
  const uid = request.auth?.uid || null;
  if (!uid) {
    throw new HttpsError("unauthenticated", "unauthenticated");
  }

  const adminSnap = await db.collection("users").doc(uid).get();
  if (!adminSnap.exists || !adminSnap.data()?.isAdmin) {
    throw new HttpsError("permission-denied", "Admin access required");
  }

  const pageSize = Math.max(1, Math.min(50, Number(request.data?.pageSize) || 25));
  const pageToken = typeof request.data?.pageToken === "string" && request.data.pageToken ? request.data.pageToken : null;

  let query = db.collection("resolvedReports")
    .orderBy("resolvedAt", "desc")
    .limit(pageSize + 1);

  if (pageToken) {
    const cursorSnap = await db.collection("resolvedReports").doc(pageToken).get();
    if (cursorSnap.exists) {
      query = query.startAfter(cursorSnap);
    }
  }

  const snap = await query.get();
  const docs = snap.docs;
  const hasMore = docs.length > pageSize;
  const visibleDocs = hasMore ? docs.slice(0, pageSize) : docs;

  const reports = visibleDocs.map((docSnap) => {
    const data = docSnap.data() as any;
    return {
      id: docSnap.id,
      submissionPath: String(data.submissionPath || ""),
      collaborationId: String(data.collaborationId || ""),
      reportedBy: String(data.reportedBy || ""),
      reportedByUsername: String(data.reportedByUsername || ""),
      reason: String(data.reason || ""),
      status: String(data.status || ""),
      createdAt: data.createdAt ? (data.createdAt as Timestamp).toMillis() : null,
      resolvedAt: data.resolvedAt ? (data.resolvedAt as Timestamp).toMillis() : null,
      resolvedBy: data.resolvedBy || null,
      reportedUserId: data.reportedUserId || null
    };
  });

  return {
    reports,
    nextPageToken: hasMore && visibleDocs.length > 0 ? visibleDocs[visibleDocs.length - 1].id : null,
    hasMore
  };
});

export const adminListFeedback = onCall({ cors: true }, async (request) => {
  const uid = request.auth?.uid || null;
  if (!uid) {
    throw new HttpsError("unauthenticated", "unauthenticated");
  }

  const adminSnap = await db.collection("users").doc(uid).get();
  if (!adminSnap.exists || !adminSnap.data()?.isAdmin) {
    throw new HttpsError("permission-denied", "Admin access required");
  }

  const pageSize = Math.max(1, Math.min(50, Number(request.data?.pageSize) || 25));
  const pageToken = typeof request.data?.pageToken === "string" && request.data.pageToken ? request.data.pageToken : null;
  const category = typeof request.data?.category === "string" && request.data.category ? request.data.category : null;
  const status = typeof request.data?.status === "string" && request.data.status ? request.data.status : null;

  let baseQuery: any = db.collection("feedback");

  if (category && status) {
    baseQuery = baseQuery.where("category", "==", category).where("status", "==", status);
  } else if (category) {
    baseQuery = baseQuery.where("category", "==", category);
  } else if (status) {
    baseQuery = baseQuery.where("status", "==", status);
  }

  let query = baseQuery.orderBy("createdAt", "desc").limit(pageSize + 1);

  if (pageToken) {
    const cursorSnap = await db.collection("feedback").doc(pageToken).get();
    if (cursorSnap.exists) {
      query = query.startAfter(cursorSnap);
    }
  }

  const snap = await query.get();
  const docs = snap.docs;
  const hasMore = docs.length > pageSize;
  const visibleDocs = hasMore ? docs.slice(0, pageSize) : docs;

  const feedback = visibleDocs.map((docSnap: any) => {
    const data = docSnap.data() as any;
    return {
      id: docSnap.id,
      uid: String(data.uid || ""),
      createdAt: data.createdAt ? (data.createdAt as Timestamp).toMillis() : null,
      category: String(data.category || "other"),
      message: String(data.message || ""),
      answers: data.answers || null,
      status: String(data.status || "new"),
      adminNote: data.adminNote || null,
      route: String(data.route || "")
    };
  });

  return {
    feedback,
    nextPageToken: hasMore && visibleDocs.length > 0 ? visibleDocs[visibleDocs.length - 1].id : null,
    hasMore
  };
});
