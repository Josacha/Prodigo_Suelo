// js/auth.js
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

    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    try {
      await signInWithEmailAndPassword(auth, email, password);
      console.log("Login correcto");
    } catch (err) {
      alert("Error: " + err.message);
    }
  });
}

// PROTECCIÓN + ROLES
onAuthStateChanged(auth, async (user) => {
  console.log("Auth state:", user);

  const path = location.pathname;
  const isLogin =
    path.endsWith("/") ||
    path.endsWith("/index.html");

  if (!user) {
    if (!isLogin) {
      window.location.href = "index.html";
    }
    return;
  }

  const ref = doc(db, "usuarios", user.uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    alert("Usuario sin rol");
    return;
  }

  const { rol } = snap.data();

  if (rol === "vendedor" && !path.includes("vendedor")) {
    window.location.href = "vendedor.html";
  }

  if (rol === "planta" && !path.includes("planta")) {
    window.location.href = "planta.html";
  }
});
