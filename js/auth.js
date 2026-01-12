import { auth } from "./firebase.js";
import { getDoc, doc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { db } from "./firebase.js";

onAuthStateChanged(auth, async (user) => {
  if (!user) return;

  const ref = doc(db, "usuarios", user.uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    alert("Usuario sin rol asignado. Contacte al administrador.");
    return;
  }

  const data = snap.data();

  if (!data.rol) {
    alert("El usuario no tiene rol definido");
    return;
  }

  // Redirección por rol
  if (data.rol === "vendedor") {
    window.location.href = "dashboard.html";
  } else if (data.rol === "planta") {
    window.location.href = "planta.html";
  }
});
