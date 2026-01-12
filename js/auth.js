console.log("auth.js cargado");

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
const form = document.getElementById("loginForm");

if (!form) {
  console.error("No se encontró loginForm");
}

form?.addEventListener("submit", (e) => {
  e.preventDefault();
  console.log("Submit ejecutado");

  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  console.log("Intentando login:", email);

  signInWithEmailAndPassword(auth, email, password)
    .then(() => console.log("Login correcto"))
    .catch(err => alert(err.message));
});

// ROLES
onAuthStateChanged(auth, async (user) => {
  console.log("Auth state:", user);

  if (!user) return;

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
