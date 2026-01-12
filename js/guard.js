import { auth, db } from "./firebase.js";

import { onAuthStateChanged } from
  "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import { doc, getDoc } from
  "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// redirección compatible con GitHub Pages
function go(page) {
  const base = location.pathname.split("/")[1];
  window.location.href = `/${base}/${page}`;
}

// PROTECCIÓN TOTAL
export function protegerPagina(rolPermitido) {
  onAuthStateChanged(auth, async (user) => {

    // ❌ NO LOGUEADO
    if (!user) {
      go("index.html");
      return;
    }

    // 🔍 BUSCAR ROL
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
    }

    // ✅ SI TODO ESTÁ BIEN → NO HACE NADA
  });
}
