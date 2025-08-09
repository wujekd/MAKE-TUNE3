import {onDocumentCreated,
  onDocumentUpdated} from "firebase-functions/v2/firestore";
import {initializeApp} from "firebase-admin/app";
import {getFirestore, Timestamp} from "firebase-admin/firestore";
import {setGlobalOptions} from "firebase-functions";
import {onSchedule} from "firebase-functions/v2/scheduler";
setGlobalOptions({region: "europe-west1", maxInstances: 10});

initializeApp();
const db = getFirestore();

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