import { auth, db } from "./firebase.js";

import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import {
  collection,
  addDoc,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  Timestamp,
  query,
  where,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// =====================
// AUTENTICACIÓN
// =====================
onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }

  console.log("Vendedor autenticado:", user.uid);

  cargarProductos();
  cargarVentas(user.uid);
});

// =====================
// LOGOUT
// =====================
document.getElementById("btnLogout")?.addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "index.html";
});

// =====================
// CARGAR PRODUCTOS
// =====================
async function cargarProductos() {
  const select = document.getElementById("productoSelect");
  if (!select) {
    console.error("Select producto no encontrado");
    return;
  }

  select.innerHTML = "";

  const snap = await getDocs(collection(db, "productos"));

  snap.forEach(d => {
    const p = d.data();

    if (p.activo && p.stock > 0) {
      const option = document.createElement("option");
      option.value = d.id;
      option.textContent = `${p.nombre} - ₡${p.precio} (${p.stock} disponibles)`;
      select.appendChild(option);
    }
  });
}

// =====================
// VENDER PRODUCTO
// =====================
document.getElementById("btnVender")?.addEventListener("click", async () => {
  const productoId = document.getElementById("productoSelect").value;
  const cantidad = Number(document.getElementById("cantidad").value);

  if (!productoId || cantidad <= 0) {
    alert("Seleccione producto y cantidad válida");
    return;
  }

  const ref = doc(db, "productos", productoId);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    alert("Producto no encontrado");
    return;
  }

  const producto = snap.data();

  if (producto.stock < cantidad) {
    alert("Stock insuficiente");
    return;
  }

  // REGISTRAR VENTA
  await addDoc(collection(db, "ventas"), {
    productoId,
    nombre: producto.nombre,
    cantidad,
    total: cantidad * producto.precio,
    vendedor: auth.currentUser.uid,
    fecha: Timestamp.now()
  });

  // ACTUALIZAR STOCK
  await updateDoc(ref, {
    stock: producto.stock - cantidad
  });

  alert("Venta registrada");

  document.getElementById("cantidad").value = "";
  cargarProductos();
});

// =====================
// CARGAR MIS VENTAS
// =====================
function cargarVentas(uid) {
  const tabla = document.getElementById("tablaVentas");
  if (!tabla) return;

  const q = query(
    collection(db, "ventas"),
    where("vendedor", "==", uid)
  );

  onSnapshot(q, (snap) => {
    tabla.innerHTML = "";

    snap.forEach(d => {
      const v = d.data();
      tabla.innerHTML += `
        <tr>
          <td>${v.nombre}</td>
          <td>${v.cantidad}</td>
          <td>₡${v.total}</td>
        </tr>
      `;
    });
  });
}
