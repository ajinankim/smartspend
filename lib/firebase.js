// Firebase client config (public values)
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth';

const firebaseConfig = {
  apiKey: 'AIzaSyCQlDLWk7nVI0Wfz9LDhoFMIDIizDmYX0w',
  authDomain: 'smartspend-ajinankim.firebaseapp.com',
  projectId: 'smartspend-ajinankim',
  storageBucket: 'smartspend-ajinankim.firebasestorage.app',
  messagingSenderId: '351957751975',
  appId: '1:351957751975:web:b6e34f2f110adcc749e382',
};

let app;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0];
}

const auth = getAuth(app);
setPersistence(auth, browserLocalPersistence).catch(() => {});

export { auth };
