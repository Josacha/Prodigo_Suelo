import { auth, db } from "./firebase.js";

import {
  signInWithEmailAndPassword,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// =====================
// LOGIN (SOLO INDEX)
// =====================
const form = document.getElementById("loginForm");

if (form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById("email")?.value.trim();
    const password = document.getElementById("password")?.value.trim();

    if (!email || !password) return;

    try {
      await signInWithEmailAndPassword(auth, email, password);
      // 🔑 NO redireccionar aquí
      // onAuthStateChanged se encarga
    } catch (err) {
      alert("Credenciales incorrectas");
    }
  });
}

// =====================
// AUTH STATE + REDIRECCIÓN
// =====================
onAuthStateChanged(auth, async (user) => {

  const path = location.pathname;

  // 🔓 SI NO ESTÁ LOGUEADO
  if (!user) {
    // Solo redirige si NO está en index
    if (!path.endsWith("index.html") && !path.endsWith("/")) {
      location.href = "index.html";
    }
    return;
  }

  // ⛔ SI YA ESTÁ EN INDEX Y LOGUEADO → REDIRIGIR UNA SOLA VEZ
  if (path.endsWith("index.html") || path.endsWith("/")) {

    const ref = doc(db, "usuarios", user.uid);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      alert("Usuario sin rol asignado");
      return;
    }

    const rol = snap.data().rol;

    if (rol === "Vendedor") location.href = "vendedor.html";
    else if (rol === "administrador") location.href = "admin.html";
    else if (rol === "Planta") location.href = "planta.html";
  }

});
