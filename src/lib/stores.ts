import { writable } from 'svelte/store';
import { auth } from './firebaseConfig';
import { onAuthStateChanged } from 'firebase/auth';

interface User {
    uid: string;
    email: string | null;
    displayName: string | null;
    photoURL: string | null;
  }

// Create a user store to manage authentication state
export const user = writable<User | null>(null);

onAuthStateChanged(auth, (firebaseUser) => {
  if (firebaseUser) {
    // User is signed in, update the Svelte store
    user.set({
      uid: firebaseUser.uid,
      email: firebaseUser.email,
      displayName: firebaseUser.displayName,
      photoURL: firebaseUser.photoURL
    });
  } else {
    // User is signed out, set user to null
    user.set(null);
  }
});