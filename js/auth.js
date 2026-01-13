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
// LOGIN (SOLO SI EXISTE)
// =====================
const form = document.getElementById("loginForm");

if (form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const emailInput = document.getElementById("email");
    const passwordInput = document.getElementById("password");

    if (!emailInput || !passwordInput) return;

    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();

    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      alert(err.message);
    }
  });
}

// =====================
// AUTH STATE + ROLES
// =====================
onAuthStateChanged(auth, async (user) => {

  const path = location.pathname;

  // NO LOGUEADO → LOGIN
  if (!user) {
    if (!path.endsWith("index.html") && path !== "/" && !path.endsWith("/")) {
      window.location.href = "index.html";
    }
    return;
  }

  // LOGUEADO → BUSCAR ROL
  const ref = doc(db, "usuarios", user.uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) return;

  const rol = snap.data().rol;

  // REDIRECCIÓN POR ROL
  if (rol === "Vendedor" && !path.includes("vendedor.html")) {
    window.location.href = "vendedor.html";
  }

  if (rol === "Planta" && !path.includes("planta.html")) {
    window.location.href = "planta.html";
  }

  if (rol === "administrador" && !path.includes("admin.html")) {
    window.location.href = "admin.html";
  }
});
