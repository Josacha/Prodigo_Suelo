import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from
  "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc } from
  "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

function go(page) {
  const base = location.pathname.split("/")[1];
  window.location.href = `/${base}/${page}`;
}

export function protegerPagina(rolPermitido) {
  onAuthStateChanged(auth, async (user) => {

    // ❌ NO LOGUEADO
    if (!user) {
      go("index.html");
      return;
    }

    const ref = doc(db, "usuarios", user.uid);
    const snap = await getDoc(ref);

    // ❌ SIN REGISTRO
    if (!snap.exists()) {
      go("index.html");
      return;
    }

    const rolUsuario = snap.data().rol;

    // ❌ ROL INCORRECTO
    if (rolUsuario !== rolPermitido) {
      go("index.html");
      return;
    }

    // ✅ AUTORIZADO → MOSTRAR PÁGINA
    document.body.style.display = "block";
  });
}
