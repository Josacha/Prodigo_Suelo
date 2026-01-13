console.log("vendedor.js cargado");


import { auth, db } from "./firebase.js";

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
  Timestamp,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// 🔒 PROTEGER VENDEDOR
onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "index.html";
  } else {
    cargarProductos();
    cargarPedidos(user.uid);
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

// 🛒 CREAR PEDIDO
const btnCrearPedido = document.getElementById("btnCrearPedido");
if (btnCrearPedido) {
  btnCrearPedido.addEventListener("click", async () => {

    const cliente = document.getElementById("cliente")?.value.trim();
    const producto = document.getElementById("producto")?.value;
    const cantidad = Number(document.getElementById("cantidad")?.value);

    if (!cliente || !producto || !cantidad) {
      alert("Complete todos los campos");
      return;
    }

    await addDoc(collection(db, "ventas"), {
      cliente,
      productoId: producto,
      cantidad,
      vendedor: auth.currentUser.uid,
      fecha: Timestamp.now()
    });

    document.getElementById("cliente").value = "";
    document.getElementById("cantidad").value = "";
  });
}

// 📦 PRODUCTOS DISPONIBLES
async function cargarProductos() {
  const select = document.getElementById("producto");
  if (!select) return;

  const snap = await getDocs(collection(db, "productos"));
  select.innerHTML = "";

  snap.forEach(doc => {
    const p = doc.data();
    if (p.stock > 0 && p.activo) {
      select.innerHTML += `
        <option value="${doc.id}">
          ${p.nombre} (${p.stock} disponibles)
        </option>`;
    }
  });
}

// 📋 MIS PEDIDOS
function cargarPedidos(uid) {
  const tabla = document.getElementById("tablaPedidos");
  if (!tabla) return;

  const q = query(
    collection(db, "ventas"),
    where("vendedor", "==", uid)
  );

  onSnapshot(q, (snap) => {
    tabla.innerHTML = "";
    snap.forEach(d => {
      const p = d.data();
      tabla.innerHTML += `
        <tr>
          <td>${p.cliente}</td>
          <td>${p.productoId}</td>
          <td>${p.cantidad}</td>
          <td>${new Date(p.fecha.seconds * 1000).toLocaleString()}</td>
        </tr>`;
    });
  });
}

