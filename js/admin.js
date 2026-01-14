import { auth, db } from "./firebase.js";

import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import {
  collection,
  addDoc,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

document.addEventListener("DOMContentLoaded", () => {

  // 🔒 PROTECCIÓN
  onAuthStateChanged(auth, (user) => {
    if (!user) {
      window.location.href = "index.html";
    }
  });

  // 🚪 LOGOUT
  const btnLogout = document.getElementById("btnLogout");
  if (btnLogout) {
    btnLogout.addEventListener("click", async () => {
      await signOut(auth);
      window.location.href = "index.html";
    });
  }

  // ➕ AGREGAR PRODUCTO
  const btnAgregar = document.getElementById("btnAgregar");
  if (btnAgregar) {
    btnAgregar.addEventListener("click", async () => {
      await addDoc(collection(db, "productos"), {
        codigo: document.getElementById("codigo").value,
        nombre: document.getElementById("nombre").value,
        precio: Number(document.getElementById("precio").value),
        stock: Number(document.getElementById("stock").value),
        activo: true
      });
    });
  }

  // 📋 LISTAR INVENTARIO
  onSnapshot(collection(db, "productos"), (snap) => {
    const tabla = document.getElementById("tablaProductos");
    if (!tabla) return;

    tabla.innerHTML = "";

    snap.forEach(doc => {
      const p = doc.data();
      tabla.innerHTML += `
        <tr>
          <td>${p.codigo}</td>
          <td>${p.nombre}</td>
          <td>₡${p.precio}</td>
          <td>${p.stock}</td>
        </tr>
      `;
    });
  });

});
