import { auth, db } from "./firebase.js";

import {
  collection,
  getDocs,
  addDoc,
  doc,
  getDoc,
  updateDoc,
  query,
  where,
  Timestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

document.addEventListener("DOMContentLoaded", () => {

  const productoSelect = document.getElementById("productoSelect");
  const cantidadInput = document.getElementById("cantidadInput");
  const venderBtn = document.getElementById("venderBtn");
  const ventasBody = document.getElementById("tablaVentas"); // ✅ ID CORRECTO
  const logoutBtn = document.getElementById("logoutBtn");

  // 🔐 PROTEGER VENDEDOR
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = "index.html";
      return;
    }

    console.log("Vendedor autenticado:", user.uid);
    await cargarProductos();
    await cargarVentas(user.uid);
  });

  // 🚪 CERRAR SESIÓN
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      await signOut(auth);
      window.location.href = "index.html";
    });
  }

  // 🟢 VENDER
  if (venderBtn) {
    venderBtn.addEventListener("click", registrarVenta);
  }

  // ===============================
  async function cargarProductos() {
    if (!productoSelect) return;

    productoSelect.innerHTML = "";

    const q = query(collection(db, "productos"), where("activo", "==", true));
    const snapshot = await getDocs(q);

    snapshot.forEach(docSnap => {
      const p = docSnap.data();

      if (p.stock > 0) {
        const option = document.createElement("option");
        option.value = docSnap.id;
        option.textContent = `${p.nombre} - ₡${p.precio} (Stock: ${p.stock})`;
        productoSelect.appendChild(option);
      }
    });
  }

  // ===============================
  async function registrarVenta() {
    const productoId = productoSelect.value;
    const cantidad = Number(cantidadInput.value);

    if (!productoId || cantidad <= 0) {
      alert("Datos inválidos");
      return;
    }

    const productoRef = doc(db, "productos", productoId);
    const productoSnap = await getDoc(productoRef);

    if (!productoSnap.exists()) {
      alert("Producto no existe");
      return;
    }

    const producto = productoSnap.data();

    if (producto.stock < cantidad) {
      alert("Stock insuficiente");
      return;
    }

    const total = producto.precio * cantidad;

    await addDoc(collection(db, "ventas"), {
      productoId,
      productoNombre: producto.nombre,
      cantidad,
      total,
      vendedorId: auth.currentUser.uid,
      fecha: Timestamp.now()
    });

    await updateDoc(productoRef, {
      stock: producto.stock - cantidad
    });

    alert("Venta registrada correctamente");

    cantidadInput.value = "";
    await cargarProductos();
    await cargarVentas(auth.currentUser.uid);
  }

  // ===============================
  async function cargarVentas(vendedorId) {
    if (!ventasBody) {
      console.warn("tablaVentas no existe en el HTML");
      return;
    }

    ventasBody.innerHTML = "";

    const q = query(
      collection(db, "ventas"),
      where("vendedorId", "==", vendedorId)
    );

    const snapshot = await getDocs(q);

    snapshot.forEach(docSnap => {
      const v = docSnap.data();

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${v.productoNombre}</td>
        <td>${v.cantidad}</td>
        <td>₡${v.total}</td>
        <td>${new Date(v.fecha.seconds * 1000).toLocaleString()}</td>
      `;
      ventasBody.appendChild(tr);
    });
  }

});
