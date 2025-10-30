import {onDocumentCreated,
  onDocumentUpdated,
  onDocumentWritten} from "firebase-functions/v2/firestore";
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

const HISTORY_LIMIT = 100;
const DEFAULT_WINNER_NAME = "no name";
const ACTIVE_COLLAB_STATUSES = new Set(["submission", "voting"]);

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
          results: counts,
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
        tx.update(detailRef, {submissions: subs, updatedAt: now});
        tx.update(collabRef, {updatedAt: now});
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
      currentCollaborationId: null,
      currentCollaborationStatus: null,
      currentCollaborationStageEndsAt: null,
    } as any;
    tx.set(projRef, projectData);
    tx.set(idxRef, {projectId: projRef.id, ownerId: uid, createdAt: now});
    return {id: projRef.id, ...(projectData as any)};
  });
  return result;
});

export const getMySubmissionCollabs = onCall(async (request) => {
  const uid = request.auth?.uid || null;
  if (!uid) {
    return {items: [], unauthenticated: true};
  }
  const subSnap = await db
    .collection("submissionUsers")
    .where("userId", "==", uid)
    .orderBy("createdAt", "desc")
    .limit(10)
    .get();
  if (subSnap.empty) {
    return {items: []};
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
  const items = submissions.map((s) => {
    const collab = collabMap.get(s.collaborationId) || {};
    const projectId = String(collab.projectId || "");
    const project = projectId ? projectMap.get(projectId) || {} : {};
    const status = String(collab.status || "");
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
    };
  });
  return {items};
});

export const getMyProjectsOverview = onCall(async (request) => {
  const uid = request.auth?.uid || null;
  if (!uid) {
    return {items: [], unauthenticated: true};
  }

  const projectSnap = await db
    .collection("projects")
    .where("ownerId", "==", uid)
    .limit(25)
    .get();

  if (projectSnap.empty) {
    return {items: []};
  }

  const projects = projectSnap.docs.map((docSnap) => ({
    id: docSnap.id,
    data: docSnap.data(),
  }));

  const collabIds = Array.from(new Set(
    projects
      .map(({data}) => String((data as any).currentCollaborationId || ""))
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

  const items = projects.map(({id, data}) => {
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

  return {items};
});

export const getMyDownloadedCollabs = onCall(async (request) => {
  const uid = request.auth?.uid || null;
  if (!uid) {
    return {items: [], unauthenticated: true};
  }

  const downloadsSnap = await db
    .collection("userDownloads")
    .where("userId", "==", uid)
    .orderBy("lastDownloadedAt", "desc")
    .limit(20)
    .get();

  if (downloadsSnap.empty) {
    return {items: []};
  }

  const downloads = downloadsSnap.docs.map((docSnap) => ({
    id: docSnap.id,
    data: docSnap.data() as any,
  }));

  const collabIds = Array.from(
    new Set(
      downloads
        .map(({data}) => String(data.collaborationId || ""))
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

  const items = downloads.map(({data}) => {
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

  return {items};
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
        tx.update(tagRef, {projectCount: newCount, lastUpdatedAt: now});
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
        tx.update(tagRef, {collaborationCount: newCount, lastUpdatedAt: now});
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
        }, {merge: true}));
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
