// js/firebase.js
import { initializeApp } from
  "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";

import { getAuth } from
  "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import { getFirestore } from
  "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Configuración Firebase (la que te dio Firebase)
const firebaseConfig = {
  apiKey: "AIzaSyDicZZNUn8s87lTuQcmrniqIXoJS4jmDYU",
  authDomain: "prodigosuelo.firebaseapp.com",
  projectId: "prodigosuelo",
  storageBucket: "prodigosuelo.firebasestorage.app",
  messagingSenderId: "685302960196",
  appId: "1:685302960196:web:de8211cd08234f03e72c11"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);

// Exportar servicios
export const auth = getAuth(app);
export const db = getFirestore(app);
