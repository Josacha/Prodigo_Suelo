import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from
  "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc } from
  "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export function protegerPagina(rolPermitido) {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      location.href = "index.html";
      return;
    }

    const ref = doc(db, "usuarios", user.uid);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      location.href = "index.html";
      return;
    }

    const rol = snap.data().rol;

    if (rol !== rolPermitido) {
      location.href = "index.html";
    }
  });
}
