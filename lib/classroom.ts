import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from './firebase';

export const PARENT_QR_FLAG = 'BAKAS_ARAL_PARENT_SYNC';
export const DEFAULT_ADMIN_KEY = 'BAKAS_DEV_2026';

export type ClassroomSession = {
  studentId: string | null;
  studentName: string;
  avatar: string | null;
  startedAt?: string | null;
};

function trackerRef(teacherId: string) {
  return doc(db, 'sessions', `active_student_${teacherId}`);
}

function teacherRef(teacherId: string) {
  return doc(db, 'users', teacherId);
}

function systemConfigRef() {
  return doc(db, 'config', 'system');
}

export async function getAdminSecretKey() {
  try {
    const snap = await getDoc(systemConfigRef());
    const stored = snap.exists() ? snap.data()?.adminSecretKey : null;
    if (typeof stored === 'string' && stored.trim()) return stored.trim();
  } catch (error) {
    console.log('Admin key fallback used:', error);
  }
  return DEFAULT_ADMIN_KEY;
}

export async function saveAdminSecretKey(key: string) {
  await setDoc(
    systemConfigRef(),
    { adminSecretKey: key.trim(), updatedAt: new Date().toISOString() },
    { merge: true }
  );
}

export async function startClassroomSession(
  teacherId: string,
  nickname: string,
  avatar: string
) {
  const studentId = `${teacherId}_${Date.now()}`;
  const startedAt = new Date().toISOString();

  await updateDoc(teacherRef(teacherId), {
    activeStudentId: studentId,
    activeStudentName: nickname,
    activeStudentAvatar: avatar,
    sessionStatus: 'active',
    sessionStartedAt: startedAt,
  });

  await setDoc(
    trackerRef(teacherId),
    {
      studentId,
      studentName: nickname,
      avatar,
      teacherId,
      updatedAt: startedAt,
    },
    { merge: true }
  );

  return { studentId, startedAt };
}

export async function clearClassroomSession(teacherId: string) {
  await updateDoc(teacherRef(teacherId), {
    activeStudentId: null,
    activeStudentName: null,
    activeStudentAvatar: null,
    sessionStatus: 'completed',
    sessionStartedAt: null,
  });

  await setDoc(
    trackerRef(teacherId),
    {
      studentId: null,
      studentName: '---',
      avatar: null,
      teacherId,
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );
}

export async function compileSessionReport(options: {
  studentId: string;
  nickname: string;
  avatar: string;
  school?: string | null;
  startedAt?: string | null;
}) {
  const snap = await getDocs(
    query(collection(db, 'sessions'), where('userId', '==', options.studentId))
  );

  let totalAcc = 0;
  let count = 0;
  let stars = 0;
  const letters: { char: string; accuracy: number }[] = [];
  const stickers: string[] = [];

  snap.forEach((entry) => {
    const data = entry.data();
    if (typeof data.accuracy !== 'number') return;
    totalAcc += data.accuracy;
    count += 1;
    if (data.letterOrNumber) {
      letters.push({ char: String(data.letterOrNumber), accuracy: data.accuracy });
    }
    if (data.unlockedSticker) stickers.push(String(data.unlockedSticker));
    if (typeof data.starsEarned === 'number') stars += data.starsEarned;
  });

  const avg = count > 0 ? Math.round(totalAcc / count) : 0;
  let duration = count > 0 ? `${Math.max(1, count * 3)}m` : '0m';
  if (options.startedAt) {
    const minutes = Math.max(1, Math.round((Date.now() - new Date(options.startedAt).getTime()) / 60000));
    duration = minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes}m`;
  }

  return {
    appIdentifier: PARENT_QR_FLAG,
    studentId: options.studentId,
    nickname: options.nickname,
    avatar: options.avatar,
    accuracy: `${avg}%`,
    duration,
    timestamp: new Date().toLocaleString(),
    school: options.school || 'NEU Pre-K Division',
    traces: count,
    letters,
    unlockedStickers: [...new Set(stickers)],
    starsEarned: stars,
  };
}
