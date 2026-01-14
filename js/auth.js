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
const form = document.getElementById("loginForm");

if (form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value.trim();

    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      alert(err.message);
    }
  });
}

// REDIRECCIÓN POR ROL
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }

  const ref = doc(db, "usuarios", user.uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) return;

  const rol = snap.data().rol;
  const page = location.pathname.split("/").pop();

  // 🔐 REDIRECCIÓN POR ROL (SIN LOOP)
  if (rol === "Vendedor" && page !== "vendedor.html") {
    window.location.href = "vendedor.html";
  }

  if (rol === "administrador" && page !== "admin.html") {
    window.location.href = "admin.html";
  }

  if (rol === "Planta" && page !== "planta.html") {
    window.location.href = "planta.html";
  }
});
