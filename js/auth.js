import { signInWithEmailAndPassword }
from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import { doc, getDoc }
from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import { auth, db } from "./firebase.js";

document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);

    const userDoc = await getDoc(doc(db, "users", cred.user.uid));
    const rol = userDoc.data().rol;

    if (rol === "vendedor") location.href = "vendedor.html";
    if (rol === "planta") location.href = "planta.html";
    if (rol === "admin") location.href = "admin.html";

  } catch (error) {
    alert("Error de login: " + error.message);
  }
});
