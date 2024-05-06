import { writable } from 'svelte/store';
import { auth } from './firebaseConfig';
import { onAuthStateChanged } from 'firebase/auth';
import { supabase, subscribeToUsageUpdates } from '$lib/supabaseClient';

interface User {
    uid?: string;
    email?: string | null;
    displayName?: string | null;
    photoURL?: string | null;
  }

// Create a user store to manage authentication state
export const user = writable<User | null>(null);
export const usage = writable(0); // 使用回数を格納するストア

onAuthStateChanged(auth, (firebaseUser) => {
  if (firebaseUser) {
    // User is signed in, update the Svelte store
    user.set({
      uid: firebaseUser.uid,
      email: firebaseUser.email,
      displayName: firebaseUser.displayName,
      photoURL: firebaseUser.photoURL
    });
    saveUserToSupabase(firebaseUser);
  } else {
    // User is signed out, set user to null
    user.set(null);
  }
});


// supabaseにユーザ情報を保存する関数
export async function saveUserToSupabase(user: User) {
  const currentUserId = auth.currentUser?.uid;
  console.log('currentUserId:', currentUserId);
  console.log('user.uid:', user.uid);
  if (currentUserId === user.uid) {
    const { data, error } = await supabase
      .from('users')
      .upsert({
        firebase_uid: user.uid,
        email: user.email,
        display_name: user.displayName,
        photo_url: user.photoURL
      })
      .select();

    if (error) {
      console.error('Error updating user in Supabase:', error.message);
    } else {
      console.log('User data updated in Supabase:', data);
    }
  } else {
    console.error('Error: Unauthorized attempt to update user data');
  }
}
