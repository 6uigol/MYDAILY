import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';

const serviceConfig = {
  apiKey: 'AIzaSyDGoUX-LZYOUdXK8bq0sVS0BZ6mtSyj6SU',
  authDomain: 'mydaily-dcccb.firebaseapp.com',
  projectId: 'mydaily-dcccb',
  storageBucket: 'mydaily-dcccb.firebasestorage.app',
  messagingSenderId: '664603537896',
  appId: '1:664603537896:web:9f425a2d3f16581fedf45d',
  measurementId: 'G-4NNV1VQHK8'
};

const app = initializeApp(serviceConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };
