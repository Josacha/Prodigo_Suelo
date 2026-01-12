import { auth } from "./firebase.js";
import {
  signInWithEmailAndPassword,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import {
  getDoc,
  doc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import { db } from "./firebase.js";

// LOGIN
document.getElementById("loginForm")?.addEventListener("submit", (e) => {
  e.preventDefault(); // 🔴 IMPORTANTE

  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  signInWithEmailAndPassword(auth, email, password)
    .catch(err => alert(err.message));
});

// PROTECCIÓN + ROLES
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    if (!location.pathname.includes("login")) {
      window.location.href = "login.html";
    }
    return;
  }

  const ref = doc(db, "usuarios", user.uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    alert("Usuario sin rol asignado");
    return;
  }

  const { rol } = snap.data();

  if (rol === "vendedor") {
    window.location.href = "vendedor.html";
  }

  if (rol === "planta") {
    window.location.href = "planta.html";
  }
});
