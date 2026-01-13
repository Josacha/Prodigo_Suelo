import { auth, db } from "./firebase.js";
import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import {
  collection,
  getDocs,
  addDoc,
  doc,
  updateDoc,
  Timestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let productos = [];

// 🔒 PROTECCIÓN
onAuthStateChanged(auth, user => {
  if (!user) location.href = "index.html";
  cargarProductos();
});

// 📦 CARGAR PRODUCTOS
async function cargarProductos() {
  const snap = await getDocs(collection(db, "productos"));
  const select = document.getElementById("productoSelect");
  select.innerHTML = "";

  productos = [];

  snap.forEach(d => {
    const p = d.data();
    if (p.activo && p.stock > 0) {
      productos.push({ id: d.id, ...p });
      select.innerHTML += `<option value="${d.id}">${p.nombre}</option>`;
    }
  });
}

// 🧾 VENDER
document.getElementById("btnVender").onclick = async () => {
  const prodId = productoSelect.value;
  const cant = Number(cantidad.value);

  const p = productos.find(x => x.id === prodId);

  if (!p || cant > p.stock) {
    alert("Stock insuficiente");
    return;
  }

  // REGISTRAR VENTA
  await addDoc(collection(db, "ventas"), {
    productoId: prodId,
    productoNombre: p.nombre,
    cantidad: cant,
    precioUnitario: p.precio,
    total: cant * p.precio,
    vendedorUid: auth.currentUser.uid,
    fecha: Timestamp.now()
  });

  // DESCONTAR STOCK
  await updateDoc(doc(db, "productos", prodId), {
    stock: p.stock - cant
  });

  alert("Venta registrada");
  cargarProductos();
};
