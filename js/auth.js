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
// LOGIN
// =====================
const form = document.getElementById("loginForm");

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const emailInput = document.getElementById("email");
  const passwordInput = document.getElementById("password");

  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();

  if (!email || !password) {
    alert("Complete todos los campos");
    return;
  }

  try {
    await signInWithEmailAndPassword(auth, email, password);
    console.log("Login correcto");
  } catch (err) {
    alert("Correo o contraseña incorrectos");
    console.error(err);
  }
});

// =====================
// REDIRECCIÓN POR ROL
// =====================
onAuthStateChanged(auth, async (user) => {
  if (!user) return;

  const ref = doc(db, "usuarios", user.uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    alert("Usuario sin rol asignado");
    return;
  }

  const rol = snap.data().rol;

  if (rol === "administrador") location.href = "admin.html";
  if (rol === "Vendedor") location.href = "vendedor.html";
  if (rol === "Planta") location.href = "planta.html";
});

