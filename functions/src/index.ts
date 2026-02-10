import {
  onDocumentCreated,
  onDocumentUpdated,
  onDocumentWritten,
  onDocumentDeleted
} from "firebase-functions/v2/firestore";
import { initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";
import { setGlobalOptions } from "firebase-functions";
import { onObjectFinalized } from "firebase-functions/v2/storage";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getStorage } from "firebase-admin/storage";
import * as path from "path";
import * as os from "os";
import * as fs from "fs";
import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";
import { onSchedule } from "firebase-functions/v2/scheduler";
setGlobalOptions({ region: "europe-west1", maxInstances: 10 });

initializeApp();
const db = getFirestore();
const storageAdmin = getStorage();

const HISTORY_LIMIT = 100;
const DEFAULT_WINNER_NAME = "no name";
const ACTIVE_COLLAB_STATUSES = new Set(["submission", "voting"]);
const PROJECT_DELETION_HISTORY_COLLECTION = "projectDeletionHistory";

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
}

const DEFAULT_SETTINGS: SystemSettings = {
  projectCreationEnabled: true,
  submissionsEnabled: true,
  votingEnabled: true,
  defaultProjectAllowance: 0,
  maxSubmissionsPerCollab: 100
};

const SUBMISSION_RESERVATION_MINUTES = 20;
const SUBMISSION_TOKEN_COLLECTION = "submissionUploadTokens";
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

const findSubmissionByPath = (detailData: any, filePath: string) => {
  const submissions: any[] = Array.isArray(detailData?.submissions) ? detailData.submissions : [];
  return submissions.find(
    (entry) => entry?.path === filePath || entry?.optimizedPath === filePath
  ) || null;
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

export const publishCollaboration = onCall(async (request) => {
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

export const reserveSubmissionSlot = onCall(async (request) => {
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
      moderationStatus: "pending"
    };

    const detailData = detailSnap.exists ? (detailSnap.data() as any) : null;
    const submissions: any[] = Array.isArray(detailData?.submissions) ? [...detailData.submissions] : [];
    const existingIndex = submissions.findIndex((s) => s?.submissionId === submissionId || s?.path === filePath);
    const isNewSubmission = existingIndex === -1;
    if (isNewSubmission) {
      submissions.push(entry);
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

const buildNameKey = (name: string) =>
  name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s/g, "-");

export const createProjectWithUniqueName = onCall(async (request) => {
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
    const projRef = db.collection("projects").doc();
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

    tx.set(projRef, projectData);
    tx.set(idxRef, { projectId: projRef.id, ownerId: uid, createdAt: now });

    // Increment project count for user
    tx.update(userRef, {
      projectCount: (Number(userData.projectCount || 0)) + 1
    });

    return { id: projRef.id, ...(projectData as any) };
  });
  return result;
});

export const recountMyProjectCount = onCall(async (request) => {
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

export const getMySubmissionCollabs = onCall(async (request) => {
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
      submissionCloseAt: collab.submissionCloseAt ? (collab.submissionCloseAt as Timestamp).toMillis() : null,
      votingCloseAt: collab.votingCloseAt ? (collab.votingCloseAt as Timestamp).toMillis() : null,
      backingPath: String(collab.backingTrackPath || ""),
      mySubmissionPath: s.path,
      winnerPath: status === "completed" ? String(collab.winnerPath || "") : null,
      submittedAt: s.createdAt ? s.createdAt.toMillis() : null,
      moderationStatus
    };
  });
  return { items };
});

/**
 * Get collaboration data with submissions filtered by moderation status.
 * Only approved submissions are returned to regular users.
 */
export const getCollaborationData = onCall(async (request) => {
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
export const getModerationData = onCall(async (request) => {
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

export const setSubmissionModeration = onCall(async (request) => {
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

export const addFavoriteTrack = onCall(async (request) => {
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

    const userCollabQuery = db
      .collection("userCollaborations")
      .where("userId", "==", uid)
      .where("collaborationId", "==", collaborationIdRaw)
      .limit(1);
    const userCollabSnap = await tx.get(userCollabQuery);
    const userCollabRef = userCollabSnap.empty
      ? db.collection("userCollaborations").doc()
      : userCollabSnap.docs[0].ref;
    const userCollabData = userCollabSnap.empty ? null : userCollabSnap.docs[0].data();

    const favorites = Array.isArray(userCollabData?.favoriteTracks)
      ? [...userCollabData.favoriteTracks]
      : [];
    if (favorites.includes(filePath)) {
      if (userCollabSnap.empty) {
        tx.set(userCollabRef, {
          userId: uid,
          collaborationId: collaborationIdRaw,
          favoriteTracks: favorites,
          listenedTracks: [],
          listenedRatio: 0,
          finalVote: null,
          createdAt: now,
          lastInteraction: now
        });
      } else {
        tx.update(userCollabRef, { lastInteraction: now });
      }
      return { updated: false };
    }

    favorites.push(filePath);
    if (userCollabSnap.empty) {
      tx.set(userCollabRef, {
        userId: uid,
        collaborationId: collaborationIdRaw,
        favoriteTracks: favorites,
        listenedTracks: [],
        listenedRatio: 0,
        finalVote: null,
        createdAt: now,
        lastInteraction: now
      });
    } else {
      tx.update(userCollabRef, {
        favoriteTracks: favorites,
        lastInteraction: now
      });
    }

    const favoritesCount = toNumber(collabData.favoritesCount, 0);
    tx.update(collabRef, { favoritesCount: favoritesCount + 1, updatedAt: now });
    return { updated: true, favoritesCount: favoritesCount + 1 };
  });
});

export const removeFavoriteTrack = onCall(async (request) => {
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

    const userCollabQuery = db
      .collection("userCollaborations")
      .where("userId", "==", uid)
      .where("collaborationId", "==", collaborationIdRaw)
      .limit(1);
    const userCollabSnap = await tx.get(userCollabQuery);
    if (userCollabSnap.empty) {
      return { updated: false };
    }
    const userCollabRef = userCollabSnap.docs[0].ref;
    const userCollabData = userCollabSnap.docs[0].data();

    const favorites = Array.isArray(userCollabData?.favoriteTracks)
      ? [...userCollabData.favoriteTracks]
      : [];
    if (!favorites.includes(filePath)) {
      tx.update(userCollabRef, { lastInteraction: now });
      return { updated: false };
    }

    const updatedFavorites = favorites.filter((path) => path !== filePath);
    tx.update(userCollabRef, {
      favoriteTracks: updatedFavorites,
      lastInteraction: now
    });

    const favoritesCount = toNumber(collabData.favoritesCount, 0);
    tx.update(collabRef, {
      favoritesCount: Math.max(0, favoritesCount - 1),
      updatedAt: now
    });
    return { updated: true, favoritesCount: Math.max(0, favoritesCount - 1) };
  });
});

export const voteForTrack = onCall(async (request) => {
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

    const userCollabQuery = db
      .collection("userCollaborations")
      .where("userId", "==", uid)
      .where("collaborationId", "==", collaborationIdRaw)
      .limit(1);
    const userCollabSnap = await tx.get(userCollabQuery);
    const userCollabRef = userCollabSnap.empty
      ? db.collection("userCollaborations").doc()
      : userCollabSnap.docs[0].ref;
    const userCollabData = userCollabSnap.empty ? null : userCollabSnap.docs[0].data();

    const currentVote = String(userCollabData?.finalVote || "");
    if (currentVote === filePath) {
      if (userCollabSnap.empty) {
        tx.set(userCollabRef, {
          userId: uid,
          collaborationId: collaborationIdRaw,
          favoriteTracks: [],
          listenedTracks: [],
          listenedRatio: 0,
          finalVote: filePath,
          createdAt: now,
          lastInteraction: now
        });
      } else {
        tx.update(userCollabRef, { lastInteraction: now });
      }
      return { updated: false };
    }

    const isFirstVote = !currentVote;
    if (userCollabSnap.empty) {
      tx.set(userCollabRef, {
        userId: uid,
        collaborationId: collaborationIdRaw,
        favoriteTracks: [],
        listenedTracks: [],
        listenedRatio: 0,
        finalVote: filePath,
        createdAt: now,
        lastInteraction: now
      });
    } else {
      tx.update(userCollabRef, {
        finalVote: filePath,
        lastInteraction: now
      });
    }

    if (isFirstVote) {
      const votesCount = toNumber(collabData.votesCount, 0);
      tx.update(collabRef, { votesCount: votesCount + 1, updatedAt: now });
      return { updated: true, votesCount: votesCount + 1 };
    }

    return { updated: true, votesCount: toNumber(collabData.votesCount, 0) };
  });
});

export const getMyModerationQueue = onCall(async (request) => {
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

export const getMyProjectsOverview = onCall(async (request) => {
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
        submissionCloseAt: currentCollabData.submissionCloseAt
          ? (currentCollabData.submissionCloseAt as Timestamp).toMillis()
          : null,
        votingCloseAt: currentCollabData.votingCloseAt
          ? (currentCollabData.votingCloseAt as Timestamp).toMillis()
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

export const getMyDownloadedCollabs = onCall(async (request) => {
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
      submissionCloseAt: collab.submissionCloseAt ? (collab.submissionCloseAt as Timestamp).toMillis() : null,
      votingCloseAt: collab.votingCloseAt ? (collab.votingCloseAt as Timestamp).toMillis() : null,
      backingPath: String(collab.backingTrackPath || ""),
      lastDownloadedAt: data.lastDownloadedAt ? (data.lastDownloadedAt as Timestamp).toMillis() : null,
      downloadCount: Number(data.downloadCount || 1),
    };
  });

  return { items };
});

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

export const banUserBySubmission = onCall(async (request) => {
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

export const adminListUsers = onCall(async (request) => {
  const uid = request.auth?.uid || null;
  if (!uid) {
    throw new HttpsError("unauthenticated", "unauthenticated");
  }

  const adminSnap = await db.collection("users").doc(uid).get();
  if (!adminSnap.exists || !adminSnap.data()?.isAdmin) {
    throw new HttpsError("permission-denied", "Admin access required");
  }

  const usersSnap = await db.collection("users").orderBy("createdAt", "desc").get();
  const users = usersSnap.docs.map(doc => ({
    uid: doc.id,
    ...doc.data()
  }));

  return { users };
});

export const adminSearchUsers = onCall(async (request) => {
  const uid = request.auth?.uid || null;
  if (!uid) {
    throw new HttpsError("unauthenticated", "unauthenticated");
  }

  const adminSnap = await db.collection("users").doc(uid).get();
  if (!adminSnap.exists || !adminSnap.data()?.isAdmin) {
    throw new HttpsError("permission-denied", "Admin access required");
  }

  const { searchQuery } = request.data;
  if (!searchQuery || typeof searchQuery !== "string") {
    throw new HttpsError("invalid-argument", "Search query required");
  }

  const query = searchQuery.toLowerCase().trim();
  const usersSnap = await db.collection("users").get();

  const users = usersSnap.docs
    .map(doc => ({ uid: doc.id, ...doc.data() }))
    .filter((user: any) => {
      return (
        user.uid.toLowerCase().includes(query) ||
        user.email?.toLowerCase().includes(query) ||
        user.username?.toLowerCase().includes(query)
      );
    });

  return { users };
});

export const adminUpdateUser = onCall(async (request) => {
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
