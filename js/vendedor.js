import { auth } from "./firebase.js";
import { db } from "./firebase.js";

import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import {
  collection,
  addDoc,
  query,
  where,
  onSnapshot,
  Timestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// 🔒 PROTEGER LA PÁGINA
onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "index.html";
  } else {
    cargarPedidos(user.uid);
  }
});

// 🚪 CERRAR SESIÓN
document.getElementById("btnLogout").addEventListener("click", () => {
  signOut(auth).then(() => {
    window.location.href = "index.html";
  });
});

// 🛒 CREAR PEDIDO
document.getElementById("btnCrearPedido").addEventListener("click", async () => {
  const cliente = document.getElementById("cliente").value.trim();
  const producto = document.getElementById("producto").value.trim();
  const cantidad = document.getElementById("cantidad").value;

  if (!cliente || !producto || !cantidad) {
    alert("Complete todos los campos");
    return;
  }

  await addDoc(collection(db, "pedidos"), {
    cliente,
    producto,
    cantidad: Number(cantidad),
    estado: "pendiente",
    creadoPor: auth.currentUser.uid,
    fecha: Timestamp.now()
  });

  document.getElementById("cliente").value = "";
  document.getElementById("producto").value = "";
  document.getElementById("cantidad").value = "";
});

// 📋 CARGAR SOLO MIS PEDIDOS
function cargarPedidos(uid) {
  const q = query(
    collection(db, "pedidos"),
    where("creadoPor", "==", uid)
  );

  onSnapshot(q, (snapshot) => {
    const tabla = document.getElementById("tablaPedidos");
    tabla.innerHTML = "";

    snapshot.forEach((doc) => {
      const p = doc.data();

      const fila = `
        <tr>
          <td>${p.cliente}</td>
          <td>${p.producto}</td>
          <td>${p.cantidad}</td>
          <td>${p.estado}</td>
          <td>${p.fecha.toDate().toLocaleString()}</td>
        </tr>
      `;

      tabla.innerHTML += fila;
    });
  });
}


