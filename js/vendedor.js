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
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }

  console.log("Vendedor autenticado:", user.uid);

  await cargarProductos();
  cargarVentas(user.uid);
});

// 🚪 LOGOUT
const btnLogout = document.getElementById("btnLogout");
if (btnLogout) {
  btnLogout.addEventListener("click", async () => {
    await signOut(auth);
    window.location.href = "index.html";
  });
}

// 🛒 CREAR VENTA
const btnCrearPedido = document.getElementById("btnCrearPedido");
if (btnCrearPedido) {
  btnCrearPedido.addEventListener("click", async () => {

    const cliente = document.getElementById("cliente")?.value.trim();
    const productoId = document.getElementById("producto")?.value;
    const cantidad = Number(document.getElementById("cantidad")?.value);

    if (!cliente || !productoId || cantidad <= 0) {
      alert("Complete todos los campos correctamente");
      return;
    }

    await addDoc(collection(db, "ventas"), {
      cliente,
      productoId,
      cantidad,
      vendedor: auth.currentUser.uid,
      fecha: Timestamp.now()
    });

    document.getElementById("cliente").value = "";
    document.getElementById("cantidad").value = "";
  });
}

// 📦 CARGAR PRODUCTOS DEL INVENTARIO
async function cargarProductos() {
  const select = document.getElementById("producto");
  if (!select) {
    console.warn("Select producto no encontrado");
    return;
  }

  select.innerHTML = `<option value="">Seleccione producto</option>`;

  const snap = await getDocs(collection(db, "productos"));
  console.log("Productos encontrados:", snap.size);

  snap.forEach(doc => {
    const p = doc.data();

    if (p.activo === true && p.stock > 0) {
      select.innerHTML += `
        <option value="${doc.id}">
          ${p.nombre} - ₡${p.precio} (${p.stock})
        </option>
      `;
    }
  });
}

// 📋 CARGAR MIS VENTAS
function cargarVentas(uid) {
  const tabla = document.getElementById("tablaPedidos");
  if (!tabla) return;

  const q = query(
    collection(db, "ventas"),
    where("vendedor", "==", uid)
  );

  onSnapshot(q, (snap) => {
    tabla.innerHTML = "";

    snap.forEach(doc => {
      const v = doc.data();
      tabla.innerHTML += `
        <tr>
          <td>${v.cliente}</td>
          <td>${v.productoId}</td>
          <td>${v.cantidad}</td>
          <td>${v.fecha.toDate().toLocaleString()}</td>
        </tr>
      `;
    });
  });
}
