/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  getDocFromServer 
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// Test connection
async function testConnection() {
  try {
    // Use a simple getDoc call. Even if permissions fail, it proves reachability.
    await getDocFromServer(doc(db, '_health_check_', 'ping'));
    console.log("Firestore reachability test passed.");
  } catch (error: any) {
    // Missing or insufficient permissions actually means the server responded!
    if (error.code === 'permission-denied') {
      console.log("Firestore connectivity verified (Backend reached).");
      return;
    }
    
    console.error("Firestore connectivity issue:", error.message);
    if (error.message.includes('the client is offline') || error.message.includes('Could not reach')) {
      console.error("CRITICAL: Firestore backend is unreachable. Verify network and project provisioning.");
    }
  }
}
testConnection();
