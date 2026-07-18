import { initializeApp, getApp, getApps } from 'firebase/app';
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  getDocFromServer,
  disableNetwork
} from 'firebase/firestore';
import { ExamAllocation, Faculty } from './types';

// ============================================================================
// STEP-BY-STEP FIREBASE SETUP INSTRUCTIONS FOR THE ADMIN:
// ============================================================================
// 1. Go to the Firebase Console: https://console.firebase.google.com/
// 2. Click "Add project" and create a project named "Exam-Duty-Allocation-System".
// 3. In your Firebase project dashboard, click the Web icon (</>) to register a web app.
// 4. Copy the "firebaseConfig" object provided by the console.
// 5. Replace the placeholder object below with your actual Firebase config keys.
// 6. Navigate to "Firestore Database" in the Firebase left menu, and click "Create Database".
// 7. Choose a location and start in Test or Production Mode.
// 8. Go to "Rules" tab and apply the Firestore Security Rules (found in security_spec.md / firestore.rules).
// 9. (Optional) Under "Authentication", enable the Google Sign-In Provider.
// ============================================================================

const EX_FIRESTORE_BLUEPRINT = {
  apiKey: "AIzaSyB2XK7gcHjFxJb5mHuMyzluuYYvwCdlq4o",
  authDomain: "exam-duty-allocation-system.firebaseapp.com",
  projectId: "exam-duty-allocation-system",
  storageBucket: "exam-duty-allocation-system.firebasestorage.app",
  messagingSenderId: "796191097252",
  appId: "1:796191097252:web:382d494f5cdab93ab58131"
};

// Check if actual production credentials have been pasted
const isRealConfig = (
  EX_FIRESTORE_BLUEPRINT.apiKey !== "YOUR_API_KEY_HERE" &&
  EX_FIRESTORE_BLUEPRINT.apiKey !== ""
);

let app;
let db: any = null;
let auth: any = null;

if (isRealConfig) {
  try {
    app = getApps().length === 0 ? initializeApp(EX_FIRESTORE_BLUEPRINT) : getApp();
    db = getFirestore(app);
    auth = getAuth(app);
  } catch (error) {
    console.error("Failed to initialize Firebase with real config:", error);
  }
}

export { db, auth, isRealConfig };

export interface AuthUser {
  email: string;
  uid: string;
}

const MOCK_USER_STORAGE_KEY = 'exam_admin_user_simulated';
const simulatedAuthListeners: ((user: AuthUser | null) => void)[] = [];

export function getSimulatedUser(): AuthUser | null {
  const data = localStorage.getItem(MOCK_USER_STORAGE_KEY);
  if (data) {
    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  }
  return null;
}

export function subscribeToAuth(callback: (user: AuthUser | null) => void): () => void {
  if (isRealConfig && auth) {
    return onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        callback({
          email: firebaseUser.email || '',
          uid: firebaseUser.uid
        });
      } else {
        callback(null);
      }
    });
  } else {
    simulatedAuthListeners.push(callback);
    callback(getSimulatedUser());
    return () => {
      const idx = simulatedAuthListeners.indexOf(callback);
      if (idx !== -1) {
        simulatedAuthListeners.splice(idx, 1);
      }
    };
  }
}

function notifySimulatedAuthChange() {
  const user = getSimulatedUser();
  simulatedAuthListeners.forEach(listener => listener(user));
}

export async function loginWithEmailPassword(email: string, password: string): Promise<AuthUser> {
  const trimmedEmail = email.trim();
  
  if (isRealConfig && auth) {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, trimmedEmail, password);
      return {
        email: userCredential.user.email || '',
        uid: userCredential.user.uid
      };
    } catch (error: any) {
      if (
        (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential' || error.message?.includes('user-not-found')) &&
        trimmedEmail === 'admin@smvcer.ac.in' &&
        password === 'admin123'
      ) {
        try {
          const newUserCredential = await createUserWithEmailAndPassword(auth, trimmedEmail, password);
          return {
            email: newUserCredential.user.email || '',
            uid: newUserCredential.user.uid
          };
        } catch (createErr: any) {
          throw new Error("Admin registration failed: " + createErr.message);
        }
      }
      throw new Error(error.message || "Authentication failed. Invalid credentials.");
    }
  } else {
    if (trimmedEmail === 'admin@smvcer.ac.in' && password === 'admin123') {
      const userObj = { email: trimmedEmail, uid: 'simulated-admin-uid-123' };
      localStorage.setItem(MOCK_USER_STORAGE_KEY, JSON.stringify(userObj));
      notifySimulatedAuthChange();
      return userObj;
    } else {
      throw new Error("Invalid username or password for administrator panel.");
    }
  }
}

export async function logoutUser(): Promise<void> {
  if (isRealConfig && auth) {
    await signOut(auth);
  } else {
    localStorage.removeItem(MOCK_USER_STORAGE_KEY);
    notifySimulatedAuthChange();
  }
}

// Fallback Local Storage Storage Key
const LOCAL_STORAGE_KEY = 'exam_allocations_simulated';

// Initialize Simulated Sample Data if empty
function getLocalAllocations(): ExamAllocation[] {
  const localData = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (localData) {
    try {
      return JSON.parse(localData);
    } catch {
      return [];
    }
  }

  const initialData: ExamAllocation[] = [];

  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(initialData));
  return initialData;
}

function saveLocalAllocations(data: ExamAllocation[]) {
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
}

// ============================================================================
// FIRESTORE CRUD OPERATIONS PATTERN WITH REAL / SIMULATED BRANCHING
// ============================================================================

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
  };
}

let isFallbackMode = false;

export function getIsFallbackMode(): boolean {
  return isFallbackMode || !isRealConfig || !db;
}

export function setFallbackMode(val: boolean) {
  if (isFallbackMode !== val) {
    isFallbackMode = val;
    if (val) {
      console.warn("[Firebase Fallback Engine]: Switching active operations state to browser Local Storage due to connection/permissions constraints.");
      window.dispatchEvent(new Event('firebase-fallback-detected'));
    }
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid || null,
      email: auth?.currentUser?.email || null,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  
  // Trigger self-healing fallback when encountering typical security policy errors
  const errMsg = errInfo.error.toLowerCase();
  if (errMsg.includes('permission') || errMsg.includes('insufficient') || errMsg.includes('missing')) {
    setFallbackMode(true);
  }
  
  throw new Error(JSON.stringify(errInfo));
}

/**
 * Validates connection to Firestore (as mandated by skill guidelines)
 */
export async function validateFirestoreConnection() {
  if (!isRealConfig || !db) return;
  
  const timeoutPromise = new Promise((_, reject) => 
    setTimeout(() => reject(new Error("Connection timeout")), 2500)
  );

  try {
    await Promise.race([
      getDocFromServer(doc(db, 'faculties', 'connection-test')),
      timeoutPromise
    ]);
  } catch (error: any) {
    // If the error is permission-denied or similar, it means we did reach the server successfully!
    const errStr = String(error?.code || error?.message || "").toLowerCase();
    if (errStr.includes("permission-denied") || errStr.includes("permission denied")) {
      console.log("[Firebase] validateFirestoreConnection: received permission-denied, but server is active.");
      return;
    }

    console.warn("[Firebase Fallback Engine]: validateFirestoreConnection failed or timed out. Marking connection as unstable.", error);
    setFallbackMode(true);
    try {
      disableNetwork(db);
    } catch (e) {
      console.error("Error disabling network:", e);
    }
  }
}

/**
 * Subscribes to real-time additions, updates, and deletes
 */
export function subscribeToAllocations(callback: (allocations: ExamAllocation[]) => void): () => void {
  if (isRealConfig && db && !getIsFallbackMode()) {
    const q = query(collection(db, 'exam_allocations'), orderBy('createdAt', 'desc'));
    
    let isCancelled = false;
    let unsubSimulatedFallback: (() => void) | null = null;
    let hasReceivedFirstSnapshot = false;

    const connectionTimeout = setTimeout(() => {
      if (!hasReceivedFirstSnapshot && !isCancelled) {
        console.warn("[Firebase Fallback Engine]: Firestore did not respond within 8s. Activating Local Storage fallback.");
        setFallbackMode(true);
        try {
          disableNetwork(db);
        } catch (e) {}
        window.dispatchEvent(new Event('simulated-mutation-event'));
      }
    }, 8000);

    const unsubReal = onSnapshot(q, (snapshot) => {
      if (isCancelled) {
        clearTimeout(connectionTimeout);
        return;
      }
      hasReceivedFirstSnapshot = true;
      clearTimeout(connectionTimeout);
      const data: ExamAllocation[] = [];
      snapshot.forEach((doc) => {
        const item = doc.data();
        data.push({
          id: doc.id,
          facultyName: item.facultyName,
          department: item.department,
          date: item.date,
          session: item.session,
          createdAt: item.createdAt || null,
          isAdjusted: item.isAdjusted || false,
          adjustedFrom: item.adjustedFrom || '',
        } as ExamAllocation);
      });
      callback(data);
    }, (error) => {
      if (isCancelled) return;
      clearTimeout(connectionTimeout);
      console.warn("Firestore subscription failed for exam_allocations, falling back to Local Storage:", error);
      
      // Toggle Fallback Mode
      setFallbackMode(true);
      try {
        disableNetwork(db);
      } catch (e) {}
      
      // Deliver storage-based backups immediately
      const initial = getLocalAllocations();
      callback(initial);
      
      const handler = () => {
        if (!isCancelled) {
          callback(getLocalAllocations());
        }
      };
      window.addEventListener('simulated-mutation-event', handler);
      unsubSimulatedFallback = () => {
        window.removeEventListener('simulated-mutation-event', handler);
      };
    });

    return () => {
      isCancelled = true;
      clearTimeout(connectionTimeout);
      unsubReal();
      if (unsubSimulatedFallback) {
        unsubSimulatedFallback();
      }
    };
  } else {
    // Simulated Local Storage Callback
    const initial = getLocalAllocations();
    callback(initial);
    
    // Listen for custom trigger to update UI when modification occurs
    const handler = () => {
      callback(getLocalAllocations());
    };
    window.addEventListener('simulated-mutation-event', handler);
    return () => {
      window.removeEventListener('simulated-mutation-event', handler);
    };
  }
}

/**
 * Save custom allocation record
 */
export async function addAllocation(record: Omit<ExamAllocation, 'id' | 'createdAt'>): Promise<void> {
  const cleanedName = record.facultyName
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');

  if (isRealConfig && db && !getIsFallbackMode()) {
    try {
      await addDoc(collection(db, 'exam_allocations'), {
        facultyName: cleanedName,
        department: record.department,
        date: record.date,
        session: record.session,
        isAdjusted: record.isAdjusted || false,
        adjustedFrom: record.adjustedFrom || '',
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'exam_allocations');
    }
  } else {
    // Simulated Write
    const current = getLocalAllocations();
    
    // Duplicate check
    const isDuplicate = current.some(
      a => a.facultyName.toLowerCase() === cleanedName.toLowerCase() &&
           a.date === record.date &&
           a.session === record.session
    );
    
    if (isDuplicate) {
      throw new Error("Allocation already exists.");
    }

    const newRecord: ExamAllocation = {
      id: Math.random().toString(36).substr(2, 9),
      facultyName: cleanedName,
      department: record.department,
      date: record.date,
      session: record.session,
      isAdjusted: record.isAdjusted || false,
      adjustedFrom: record.adjustedFrom || '',
      createdAt: new Date().getTime(),
    };

    current.unshift(newRecord);
    saveLocalAllocations(current);
    // Dispatch event to refresh live observers
    window.dispatchEvent(new Event('simulated-mutation-event'));
  }
}

/**
 * Update custom allocation record
 */
export async function updateAllocation(id: string, record: Omit<ExamAllocation, 'id' | 'createdAt'>): Promise<void> {
  const cleanedName = record.facultyName
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');

  if (isRealConfig && db && !getIsFallbackMode()) {
    try {
      await updateDoc(doc(db, 'exam_allocations', id), {
        facultyName: cleanedName,
        department: record.department,
        date: record.date,
        session: record.session,
        isAdjusted: record.isAdjusted !== undefined ? record.isAdjusted : false,
        adjustedFrom: record.adjustedFrom || '',
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `exam_allocations/${id}`);
    }
  } else {
    // Simulated Update
    const current = getLocalAllocations();
    
    // Duplicate check excluding target ID
    const isDuplicate = current.some(
      a => a.id !== id &&
           a.facultyName.toLowerCase() === cleanedName.toLowerCase() &&
           a.date === record.date &&
           a.session === record.session
    );

    if (isDuplicate) {
      throw new Error("Allocation already exists.");
    }

    const idx = current.findIndex(a => a.id === id);
    if (idx !== -1) {
      current[idx] = {
        ...current[idx],
        facultyName: cleanedName,
        department: record.department,
        date: record.date,
        session: record.session,
        isAdjusted: record.isAdjusted !== undefined ? record.isAdjusted : false,
        adjustedFrom: record.adjustedFrom || '',
      };
      saveLocalAllocations(current);
      window.dispatchEvent(new Event('simulated-mutation-event'));
    } else {
      throw new Error("Record not found.");
    }
  }
}

/**
 * Delete allocation record
 */
export async function removeAllocation(id: string): Promise<void> {
  if (isRealConfig && db && !getIsFallbackMode()) {
    try {
      await deleteDoc(doc(db, 'exam_allocations', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `exam_allocations/${id}`);
    }
  } else {
    // Simulated Delete
    let current = getLocalAllocations();
    current = current.filter(a => a.id !== id);
    saveLocalAllocations(current);
    window.dispatchEvent(new Event('simulated-mutation-event'));
  }
}

// ============================================================================
// FACULTY REGISTRY CRUD OPERATIONS (REAL & SIMULATED FALLBACK)
// ============================================================================

const FACULTY_LOCAL_STORAGE_KEY = 'exam_faculties_simulated';

function getLocalFaculties(): Faculty[] {
  const localData = localStorage.getItem(FACULTY_LOCAL_STORAGE_KEY);
  if (localData) {
    try {
      return JSON.parse(localData);
    } catch {
      return [];
    }
  }

  const initialData: Faculty[] = [];

  localStorage.setItem(FACULTY_LOCAL_STORAGE_KEY, JSON.stringify(initialData));
  return initialData;
}

function saveLocalFaculties(data: Faculty[]) {
  localStorage.setItem(FACULTY_LOCAL_STORAGE_KEY, JSON.stringify(data));
}

export function subscribeToFaculties(callback: (faculties: Faculty[]) => void): () => void {
  if (isRealConfig && db && !getIsFallbackMode()) {
    const q = query(collection(db, 'faculties'), orderBy('name', 'asc'));
    
    let isCancelled = false;
    let unsubSimulatedFallback: (() => void) | null = null;
    let hasReceivedFirstSnapshot = false;

    const connectionTimeout = setTimeout(() => {
      if (!hasReceivedFirstSnapshot && !isCancelled) {
        console.warn("[Firebase Fallback Engine]: Firestore did not respond within 8s. Activating Local Storage fallback.");
        setFallbackMode(true);
        try {
          disableNetwork(db);
        } catch (e) {}
        window.dispatchEvent(new Event('simulated-faculty-mutation-event'));
      }
    }, 8000);

    const unsubReal = onSnapshot(q, (snapshot) => {
      if (isCancelled) {
        clearTimeout(connectionTimeout);
        return;
      }
      hasReceivedFirstSnapshot = true;
      clearTimeout(connectionTimeout);
      const data: Faculty[] = [];
      snapshot.forEach((doc) => {
        const item = doc.data();
        data.push({
          id: doc.id,
          name: item.name,
          department: item.department,
          phone: item.phone || '',
          createdAt: item.createdAt || null,
        } as Faculty);
      });
      callback(data);
    }, (error) => {
      if (isCancelled) return;
      clearTimeout(connectionTimeout);
      console.warn("Firestore subscription failed for faculties, falling back to Local Storage:", error);
      
      // Toggle Fallback Mode
      setFallbackMode(true);
      try {
        disableNetwork(db);
      } catch (e) {}
      
      // Deliver storage-based backups immediately
      const initial = getLocalFaculties();
      callback(initial);
      
      const handler = () => {
        if (!isCancelled) {
          callback(getLocalFaculties());
        }
      };
      window.addEventListener('simulated-faculty-mutation-event', handler);
      unsubSimulatedFallback = () => {
        window.removeEventListener('simulated-faculty-mutation-event', handler);
      };
    });

    return () => {
      isCancelled = true;
      clearTimeout(connectionTimeout);
      unsubReal();
      if (unsubSimulatedFallback) {
        unsubSimulatedFallback();
      }
    };
  } else {
    const initial = getLocalFaculties();
    callback(initial);
    
    const handler = () => {
      callback(getLocalFaculties());
    };
    window.addEventListener('simulated-faculty-mutation-event', handler);
    return () => {
      window.removeEventListener('simulated-faculty-mutation-event', handler);
    };
  }
}

export async function addFaculty(record: Omit<Faculty, 'id' | 'createdAt'>): Promise<void> {
  const cleanedName = record.name
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');

  if (isRealConfig && db && !getIsFallbackMode()) {
    try {
      await addDoc(collection(db, 'faculties'), {
        name: cleanedName,
        department: record.department,
        phone: record.phone || '',
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'faculties');
    }
  } else {
    const current = getLocalFaculties();
    
    const isDuplicate = current.some(
      f => f.name.toLowerCase() === cleanedName.toLowerCase()
    );
    if (isDuplicate) {
      throw new Error("Faculty already exists with this name.");
    }

    const newRecord: Faculty = {
      id: Math.random().toString(36).substr(2, 9),
      name: cleanedName,
      department: record.department,
      phone: record.phone || '',
      createdAt: new Date().getTime(),
    };

    current.push(newRecord);
    current.sort((a, b) => a.name.localeCompare(b.name));
    saveLocalFaculties(current);
    window.dispatchEvent(new Event('simulated-faculty-mutation-event'));
  }
}

export async function updateFaculty(id: string, record: Omit<Faculty, 'id' | 'createdAt'>): Promise<void> {
  const cleanedName = record.name
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');

  if (isRealConfig && db && !getIsFallbackMode()) {
    try {
      await updateDoc(doc(db, 'faculties', id), {
        name: cleanedName,
        department: record.department,
        phone: record.phone || '',
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `faculties/${id}`);
    }
  } else {
    const current = getLocalFaculties();
    
    const isDuplicate = current.some(
      f => f.id !== id && f.name.toLowerCase() === cleanedName.toLowerCase()
    );
    if (isDuplicate) {
      throw new Error("Another faculty already exists with this name.");
    }

    const idx = current.findIndex(f => f.id === id);
    if (idx !== -1) {
      current[idx] = {
        ...current[idx],
        name: cleanedName,
        department: record.department,
        phone: record.phone || '',
      };
      current.sort((a, b) => a.name.localeCompare(b.name));
      saveLocalFaculties(current);
      window.dispatchEvent(new Event('simulated-faculty-mutation-event'));
    } else {
      throw new Error("Faculty register not found.");
    }
  }
}

export async function removeFaculty(id: string): Promise<void> {
  if (isRealConfig && db && !getIsFallbackMode()) {
    try {
      await deleteDoc(doc(db, 'faculties', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `faculties/${id}`);
    }
  } else {
    let current = getLocalFaculties();
    current = current.filter(f => f.id !== id);
    saveLocalFaculties(current);
    window.dispatchEvent(new Event('simulated-faculty-mutation-event'));
  }
}
