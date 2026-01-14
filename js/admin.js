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

// 🔒 PROTECCIÓN
onAuthStateChanged(auth, (user) => {
  if (!user) location.href = "index.html";
});

// 🚪 LOGOUT
document.getElementById("btnLogout")?.addEventListener("click", async () => {
  await signOut(auth);
  location.href = "index.html";
});

// ➕ AGREGAR PRODUCTO
document.getElementById("btnAgregar")?.addEventListener("click", async () => {
  await addDoc(collection(db, "productos"), {
    codigo: codigo.value,
    nombre: nombre.value,
    precio: Number(precio.value),
    stock: Number(stock.value),
    activo: true
  });
});

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
