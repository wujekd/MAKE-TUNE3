import {onDocumentCreated,
  onDocumentUpdated} from "firebase-functions/v2/firestore";
import {initializeApp} from "firebase-admin/app";
import {getFirestore, Timestamp} from "firebase-admin/firestore";
import {setGlobalOptions} from "firebase-functions";
import {onObjectFinalized} from "firebase-functions/v2/storage";
import {onCall, HttpsError} from "firebase-functions/v2/https";
import {getStorage} from "firebase-admin/storage";
import * as path from "path";
import * as os from "os";
import * as fs from "fs";
import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";
import {onSchedule} from "firebase-functions/v2/scheduler";
setGlobalOptions({region: "europe-west1", maxInstances: 10});

initializeApp();
const db = getFirestore();
const storageAdmin = getStorage();

const BAD = ["foo", "bar"];
const sanitize = (s: string) =>
  BAD.reduce(
    (t, w) =>
      t.replace(new RegExp(`\\b${w}\\b`, "gi"), "*".repeat(w.length)),
    s
  );

export const sanitizeProjectDescription = onDocumentCreated(
  "projects/{projectId}",
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const data = snap.data();
    const original = String(data?.description ?? "");
    const cleaned = sanitize(original);
    if (cleaned === original) return;
    await db.doc(snap.ref.path).update({description: cleaned});
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
    await db.doc(after.ref.path).update({description: cleaned});
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
        tx.update(ref, {status: "voting", votingStartedAt: now, updatedAt: now});
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

        // tally final votes
        const votesSnap = await db
          .collection("userCollaborations")
          .where("collaborationId", "==", ref.id)
          .where("finalVote", "!=", null)
          .get();
        const counts: Record<string, number> = {};
        votesSnap.forEach((v) => {
          const fv = (v.data() as any).finalVote as string | null;
          if (!fv) return;
          counts[fv] = (counts[fv] || 0) + 1;
        });
        let winnerPath: string | null = null;
        let max = -1;
        for (const [path, c] of Object.entries(counts)) {
          if (c > max || (c === max && path < (winnerPath ?? "~"))) {
            max = c;
            winnerPath = path;
          }
        }
        tx.update(ref, {
          status: "completed",
          completedAt: now,
          updatedAt: now,
          results: counts,
          winnerPath,
          resultsComputedAt: now,
        });
      });
      processed++;
    }
    if (due.size < 100) break;
  }

  console.log(`advanceCollaborationStages processed ${processed}`);
  }
);

// Storage trigger: transcode large files (>20MB) to 256kbps MP3
export const transcodeLargeToMp3 = onObjectFinalized({region: "europe-west1"}, async (event) => {
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
    await bucket.file(filePath).download({destination: tmpIn});
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
    await bucket.upload(tmpOut, {destination: optimizedPath, contentType: "audio/mpeg"});
    const optimizedFile = bucket.file(optimizedPath);
    const [meta] = await optimizedFile.getMetadata();
    const optimizedSize = Number(meta.size || 0);
    // update collaboration doc submissions entry
    const collabRef = db.collection("collaborations").doc(collabId);
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(collabRef);
      if (!snap.exists) return;
      const data = snap.data() as any;
      const subs: any[] = Array.isArray(data.submissions) ? data.submissions : [];
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
        tx.update(collabRef, {submissions: subs, updatedAt: now});
      } else {
        // legacy or not found: no-op
      }
    });
  } catch (e) {
    console.error("transcodeLargeToMp3 failed", e);
  } finally {
    try { fs.unlinkSync(tmpIn); } catch {}
    try { fs.unlinkSync(tmpOut); } catch {}
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

export const createProjectWithUniqueName = onCall(async (request) => {
  const uid = request.auth?.uid || null;
  if (!uid) throw new HttpsError("unauthenticated", "unauthenticated");
  const nameRaw = String(request.data?.name ?? "").trim();
  const descriptionRaw = String(request.data?.description ?? "");
  if (!nameRaw) throw new HttpsError("invalid-argument", "name required");
  const nameKey = buildNameKey(nameRaw);
  const result = await db.runTransaction(async (tx) => {
    const idxRef = db.collection("projectNameIndex").doc(nameKey);
    const idxSnap = await tx.get(idxRef);
    if (idxSnap.exists) throw new HttpsError("already-exists", "name taken");
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
    } as any;
    tx.set(projRef, projectData);
    tx.set(idxRef, {projectId: projRef.id, ownerId: uid, createdAt: now});
    return {id: projRef.id, ...(projectData as any)};
  });
  return result;
});