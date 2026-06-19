import { initializeApp } from 'firebase/app';
import { getAuth, RecaptchaVerifier } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyDpObqM0f_0fSzfyVLNbqpuxFkUM3faj_8",
  authDomain: "triq-35908.firebaseapp.com",
  projectId: "triq-35908",
  storageBucket: "triq-35908.firebasestorage.app",
  messagingSenderId: "1021693609301",
  appId: "1:1021693609301:web:839e1693fe685370661bdc",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export { RecaptchaVerifier };
