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
// LOGIN (SOLO index.html)
// =====================
const form = document.getElementById("loginForm");

if (form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value.trim();

    try {
      await signInWithEmailAndPassword(auth, email, password);
      console.log("Login correcto");
    } catch (err) {
      alert("Credenciales incorrectas");
    }
  });
}

// =====================
// AUTH STATE + ROLES
// =====================
onAuthStateChanged(auth, async (user) => {
  console.log("Auth state:", user);

  const path = location.pathname;

  // NO LOGUEADO
  if (!user) {
    if (!path.endsWith("index.html")) {
      window.location.href = "index.html";
    }
    return;
  }

  // BUSCAR ROL
  const ref = doc(db, "usuarios", user.uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    alert("Usuario sin rol asignado");
    return;
  }

  const { rol } = snap.data();
  console.log("Rol:", rol);

  // REDIRECCIÓN
  if (rol === "vendedor" && !path.includes("vendedor.html")) {
    window.location.href = "vendedor.html";
  }

  if (rol === "planta" && !path.includes("planta.html")) {
    window.location.href = "planta.html";
  }

  if (rol === "admin" && !path.includes("admin.html")) {
    window.location.href = "admin.html";
  }
});
