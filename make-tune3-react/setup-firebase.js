import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, addDoc, collection, Timestamp } from 'firebase/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// read environment variables from .env.local
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = join(__dirname, '.env.local');

let firebaseConfig = {};
try {
  const envContent = readFileSync(envPath, 'utf8');
  const envVars = envContent.split('\n').reduce((acc, line) => {
    const [key, value] = line.split('=');
    if (key && value) {
      acc[key.trim()] = value.trim();
    }
    return acc;
  }, {});

  firebaseConfig = {
    apiKey: envVars.VITE_FIREBASE_API_KEY,
    authDomain: envVars.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: envVars.VITE_FIREBASE_PROJECT_ID,
    storageBucket: envVars.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: envVars.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: envVars.VITE_FIREBASE_APP_ID
  };
} catch (error) {
  console.error('Error reading .env.local file:', error);
  console.log('Please ensure .env.local exists with Firebase config');
  process.exit(1);
}

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
async function setupFirebaseCollections() {
  console.log('setting up Firebase collections...');

  try {
    console.log('creating user profile...');
    const userProfile = {
      uid: 've8DfsfgtjbCV9MdWyCwwwtqCf02',
      email: 'dom.wujek@gmail.com',
      createdAt: Timestamp.now(),
      collaborationIds: []
    };
    
    await setDoc(doc(db, 'users', userProfile.uid), userProfile);
    console.log(' user profile created');

    console.log('creating project...');
    const projectData = {
      name: 'Demo Project',
      description: 'A test project for development',
      ownerId: 've8DfsfgtjbCV9MdWyCwwwtqCf02',
      isActive: true,
      tags: [],
      tagsKey: [],
      currentCollaborationId: null,
      currentCollaborationStatus: null,
      currentCollaborationStageEndsAt: null,
      pastCollaborations: [], // will be populated when collaborations complete
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    };

    const projectRef = await addDoc(collection(db, 'projects'), projectData);
    const projectId = projectRef.id;
    console.log(' project created:', projectId);

    console.log('creating collaboration...');
    const collaborationData = {
      projectId: projectId,
      name: 'First Collaboration',
      description: 'Initial test collaboration',
      backingTrackPath: '', // will be set after creating backing track
      submissionDuration: 7 * 24 * 60 * 60, // 7 days in seconds
      votingDuration: 7 * 24 * 60 * 60, // 7 days in seconds
      status: 'voting',
      publishedAt: Timestamp.now(),
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    };

    const collaborationRef = await addDoc(collection(db, 'collaborations'), collaborationData);
    const collaborationId = collaborationRef.id;
    console.log(' collaboration created:', collaborationId);

    console.log('creating tracks...');
    
    const backingTrackPath = 'demo2%20instrumental.mp3';
    console.log(' backing track path:', backingTrackPath);

    // update collaboration with backing track path
    await setDoc(doc(db, 'collaborations', collaborationId), {
      backingTrackPath: backingTrackPath
    }, { merge: true });

    // submission tracks (anonymous - no artist field in track)
    const submissionTracks = [
      {
        title: 'Phone from China',
        artist: 'Demo Artist', // for submissionUser only
        filePath: 'df9a07de-d40c-4e49-ab35-2c94f55e5137_phone%20from%20china.mp3',
        duration: 240
      },
      {
        title: 'Voiceover 2',
        artist: 'Demo Artist', // for submissionUser only
        filePath: 'voiceover2.mp3',
        duration: 180
      },
      {
        title: 'Fuck Me Up',
        artist: 'Demo Artist', // for submissionUser only
        filePath: 'fuck_me_upppp_mh2bywZ.mp3',
        duration: 200
      },
      {
        title: 'BB G Ab',
        artist: 'Demo Artist', // for submissionUser only
        filePath: 'bb_g_Ab.mp3',
        duration: 220
      }
    ];

    const submissionPaths = [];
    const submissionEntries = [];
    for (const trackData of submissionTracks) {
      submissionPaths.push(trackData.filePath);
      console.log(' submission track path:', trackData.filePath);

      // create private submission-user relationship with artist info
      const submissionUserData = {
        filePath: trackData.filePath,
        userId: 've8DfsfgtjbCV9MdWyCwwwtqCf02', // demo user
        collaborationId: collaborationId,
        artist: trackData.artist, // real artist name (private)
        createdAt: Timestamp.now()
      };
      
      await addDoc(collection(db, 'submissionUsers'), submissionUserData);
      console.log(' submission-user relationship created for path:', trackData.filePath);

      const createdAtTs = Timestamp.now();
      submissionEntries.push({
        path: trackData.filePath,
        submissionId: trackData.filePath,
        settings: {
          eq: {
            highshelf: { gain: 0, frequency: 8000 },
            param2: { gain: 0, frequency: 3000, Q: 1 },
            param1: { gain: 0, frequency: 250, Q: 1 },
            highpass: { frequency: 20, enabled: false }
          },
          volume: { gain: 1 }
        },
        createdAt: createdAtTs,
        moderationStatus: 'approved',
        moderatedAt: createdAtTs,
        moderatedBy: 'seed-script'
      });
    }

    // past stage tracks (no artist field for anonymity)
    const pastStageTracks = [
      {
        title: 'Rudi Demo Arr1',
        filePath: 'Rudi%20demo%20arr1%20acc%20copy.mp3',
        duration: 240
      },
      {
        title: 'Kuba',
        filePath: 'Kuba.mp3',
        duration: 200
      },
      {
        title: 'Tomas Demo1',
        filePath: 'tomas%20demo1%20instrumental.mp3',
        duration: 220
      }
    ];

    await setDoc(doc(db, 'collaborationDetails', collaborationId), {
      collaborationId: collaborationId,
      submissions: submissionEntries,
      submissionPaths: submissionPaths,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    });

    const pastStageTrackPaths = [];
    for (const trackData of pastStageTracks) {
      pastStageTrackPaths.push(trackData.filePath);
      console.log(' past stage track path:', trackData.filePath);
    }

    // create past collaborations for demo purposes (one for each mock file)
    const publishedAt = Timestamp.now();
    const submissionCloseAt = Timestamp.fromMillis(publishedAt.toMillis() + 3 * 24 * 3600 * 1000);
    const votingCloseAt = Timestamp.fromMillis(submissionCloseAt.toMillis() + 2 * 24 * 3600 * 1000);
    const completedAt = Timestamp.fromMillis(votingCloseAt.toMillis() + 2 * 3600 * 1000);
    const pastCollaborations = [
      {
        collaborationId: 'demo-past-collab-1',
        name: 'Demo Past Collaboration 1',
        winnerTrackPath: 'Rudi%20demo%20arr1%20acc%20copy.mp3',
        pastStageTrackPath: 'Rudi%20demo%20arr1%20acc%20copy.mp3',
        backingTrackPath: 'collabs/demo-collab/backing.mp3',
        winnerUserId: 've8DfsfgtjbCV9MdWyCwwwtqCf02',
        winnerUserName: 'demo-artist',
        winnerVotes: 9,
        totalVotes: 15,
        participationCount: 8,
        publishedAt,
        submissionCloseAt,
        votingCloseAt,
        completedAt
      },
      {
        collaborationId: 'demo-past-collab-2',
        name: 'Demo Past Collaboration 2',
        winnerTrackPath: 'Kuba.mp3',
        pastStageTrackPath: 'Kuba.mp3',
        backingTrackPath: 'collabs/demo-collab/backing.mp3',
        winnerUserId: 've8DfsfgtjbCV9MdWyCwwwtqCf02',
        winnerUserName: 'demo-artist',
        winnerVotes: 7,
        totalVotes: 12,
        participationCount: 6,
        publishedAt,
        submissionCloseAt,
        votingCloseAt,
        completedAt
      },
      {
        collaborationId: 'demo-past-collab-3',
        name: 'Demo Past Collaboration 3',
        winnerTrackPath: 'tomas%20demo1%20instrumental.mp3',
        pastStageTrackPath: 'tomas%20demo1%20instrumental.mp3',
        backingTrackPath: 'collabs/demo-collab/backing.mp3',
        winnerUserId: 've8DfsfgtjbCV9MdWyCwwwtqCf02',
        winnerUserName: 'demo-artist',
        winnerVotes: 10,
        totalVotes: 18,
        participationCount: 10,
        publishedAt,
        submissionCloseAt,
        votingCloseAt,
        completedAt
      }
    ];

    // update project with past collaborations
    await setDoc(doc(db, 'projects', projectId), {
      pastCollaborations: pastCollaborations
    }, { merge: true });

    console.log('creating user collaboration...');
    const userCollaborationData = {
      userId: 've8DfsfgtjbCV9MdWyCwwwtqCf02',
      collaborationId: collaborationId,
      listenedTracks: [submissionPaths[0], submissionPaths[1]], // use actual file paths
      favoriteTracks: [submissionPaths[1]],
      finalVote: submissionPaths[1],
      listenedRatio: 7,
      lastInteraction: Timestamp.now(),
      createdAt: Timestamp.now()
    };

    const userCollaborationRef = await addDoc(collection(db, 'userCollaborations'), userCollaborationData);
    console.log(' user collaboration created:', userCollaborationRef.id);

    // update user profile with collaboration ID
    await setDoc(doc(db, 'users', 've8DfsfgtjbCV9MdWyCwwwtqCf02'), {
      ...userProfile,
      collaborationIds: [collaborationId]
    }, { merge: true });

    console.log('Firebase collections setup complete!');
    console.log(' Summary:');
    console.log(`   Project: ${projectId}`);
    console.log(`   Collaboration: ${collaborationId}`);
    console.log(`   Backing Track Path: ${backingTrackPath}`);
    console.log(`   Submission Tracks: ${submissionTracks.length}`);
    console.log(`   Past Stage Tracks: ${pastStageTracks.length}`);
    console.log(`   User Collaboration: created successfully`);

    return {
      projectId: projectId,
      collaborationId: collaborationId,
      backingTrackPath: backingTrackPath
    };

  } catch (error) {
    console.error('❌ Error setting up Firebase collections:', error);
    throw error;
  }
}

console.log('🚀 Starting Firebase setup...');

setupFirebaseCollections()
  .then((result) => {
    console.log('✅ Setup completed successfully!');
    console.log('📋 Results:', result);
  })
  .catch((error) => {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  }); 
