import { auth, db } from "./firebase.js";
import {
  signInWithEmailAndPassword,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// LOGIN
document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = email.value;
  const password = password.value;

  await signInWithEmailAndPassword(auth, email, password);
});

// REDIRECCIÓN DESPUÉS DE LOGIN
onAuthStateChanged(auth, async (user) => {
  if (!user) return;

  const ref = doc(db, "usuarios", user.uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) return;

  const rol = snap.data().rol;

  if (rol === "administrador") location.href = "admin.html";
  if (rol === "Vendedor") location.href = "vendedor.html";
  if (rol === "Planta") location.href = "planta.html";
});
