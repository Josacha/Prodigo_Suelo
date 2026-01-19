import { auth, db } from "./firebase.js";
import {
  collection, getDocs, addDoc, doc, getDoc, updateDoc, deleteDoc, query, where, Timestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

document.addEventListener("DOMContentLoaded", () => {

  // =====================
  // VARIABLES GENERALES
  // =====================
  let editId = null;
  let editClienteId = null;

  const codigo = document.getElementById("codigo");
  const nombre = document.getElementById("nombre");
  const variedad = document.getElementById("variedad");
  const peso = document.getElementById("peso");
  const precio = document.getElementById("precio");
  const precioIVA = document.getElementById("precioIVA");

  const productosBody = document.getElementById("productosBody");
  const buscarProducto = document.getElementById("buscarProducto");

  const clienteNombre = document.getElementById("clienteNombre");
  const clienteTelefono = document.getElementById("clienteTelefono");
  const clienteDireccion = document.getElementById("clienteDireccion");
  const clienteUbicacion = document.getElementById("clienteUbicacion");
  const vendedorSelect = document.getElementById("vendedorSelect");
  const clientesContainer = document.getElementById("clientesContainer");

  const btnAgregar = document.getElementById("btnAgregar");
  const btnAgregarCliente = document.getElementById("btnAgregarCliente");
  const btnLogout = document.getElementById("btnLogout");

  // =====================
  // PROTECCIÓN
  // =====================
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      location.href = "index.html";
      return;
    }

    await cargarVendedores();
    listarProductos();
    cargarClientes();
  });

  // =====================
  // LOGOUT
  // =====================
  if (btnLogout) {
    btnLogout.onclick = async () => {
      await signOut(auth);
      location.href = "index.html";
    };
  }

  // =====================
  // IVA
  // =====================
  if (precio && precioIVA) {
    precio.addEventListener("input", () => {
      precioIVA.value = (Number(precio.value || 0) * 1.01).toFixed(2);
    });
  }

  // =====================
  // AGREGAR / EDITAR PRODUCTO
  // =====================
  if (btnAgregar) {
    btnAgregar.onclick = async () => {
      if (!codigo.value || !nombre.value || !peso.value || !precio.value) {
        alert("Complete todos los campos");
        return;
      }

      const data = {
        codigo: codigo.value.trim(),
        nombre: nombre.value.trim(),
        variedad: variedad.value || "",
        peso: Number(peso.value),
        precio: Number(precio.value),
        precioIVA: Number(precioIVA.value),
        activo: true
      };

      if (editId) {
        await updateDoc(doc(db, "productos", editId), data);
        editId = null;
      } else {
        await addDoc(collection(db, "productos"), data);
      }

      codigo.value = "";
      nombre.value = "";
      variedad.value = "";
      peso.value = "";
      precio.value = "";
      precioIVA.value = "";

      listarProductos();
    };
  }

  // =====================
  // LISTAR PRODUCTOS (TABLA)
  // =====================
  async function listarProductos() {
    if (!productosBody) return;

    productosBody.innerHTML = "";
    const snap = await getDocs(collection(db, "productos"));

    snap.forEach(docSnap => {
      const p = docSnap.data();
      const gramos = Number(p.peso || 0);
      const kilos = gramos > 0 ? (gramos / 1000).toFixed(2) : "0.00";

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${p.codigo}</td>
        <td>${p.nombre}</td>
        <td>${p.variedad || "-"}</td>
        <td>${gramos}</td>
        <td>${kilos}</td>
        <td>₡${Number(p.precio).toLocaleString()}</td>
        <td>₡${Number(p.precioIVA).toLocaleString()}</td>
        <td>
          <button onclick="editarProducto('${docSnap.id}')">✏️</button>
          <button onclick="eliminarProducto('${docSnap.id}')">🗑️</button>
        </td>
      `;
      productosBody.appendChild(tr);
    });
  }

  // =====================
  // BUSCADOR EN TIEMPO REAL
  // =====================
  if (buscarProducto) {
    buscarProducto.addEventListener("input", () => {
      const texto = buscarProducto.value.toLowerCase();
      document.querySelectorAll("#productosBody tr").forEach(row => {
        row.style.display = row.textContent.toLowerCase().includes(texto)
          ? ""
          : "none";
      });
    });
  }

  // =====================
  // EDITAR PRODUCTO
  // =====================
  window.editarProducto = async (id) => {
    const snap = await getDoc(doc(db, "productos", id));
    if (!snap.exists()) return;

    const p = snap.data();
    codigo.value = p.codigo;
    nombre.value = p.nombre;
    variedad.value = p.variedad;
    peso.value = p.peso;
    precio.value = p.precio;
    precioIVA.value = p.precioIVA;

    editId = id;
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // =====================
  // ELIMINAR PRODUCTO
  // =====================
  window.eliminarProducto = async (id) => {
    if (!confirm("¿Eliminar producto?")) return;
    await deleteDoc(doc(db, "productos", id));
    listarProductos();
  };

  // =====================
  // CARGAR VENDEDORES
  // =====================
  async function cargarVendedores() {
    if (!vendedorSelect) return;
    vendedorSelect.innerHTML = "<option value=''>Seleccione vendedor</option>";

    const snap = await getDocs(collection(db, "usuarios"));
    snap.forEach(docSnap => {
      vendedorSelect.innerHTML += `<option value="${docSnap.id}">
        ${docSnap.data().nombre}
      </option>`;
    });
  }

  // =====================
  // AGREGAR CLIENTE
  // =====================
  if (btnAgregarCliente) {
    btnAgregarCliente.onclick = async () => {
      if (!clienteNombre.value || !vendedorSelect.value) {
        alert("Complete los campos obligatorios");
        return;
      }

      const data = {
        nombre: clienteNombre.value,
        telefono: clienteTelefono.value || "",
        direccion: clienteDireccion.value || "",
        ubicacion: clienteUbicacion.value || "",
        vendedorId: vendedorSelect.value,
        fecha: Timestamp.now()
      };

      if (editClienteId) {
        await updateDoc(doc(db, "clientes", editClienteId), data);
        editClienteId = null;
      } else {
        await addDoc(collection(db, "clientes"), data);
      }

      clienteNombre.value = "";
      clienteTelefono.value = "";
      clienteDireccion.value = "";
      clienteUbicacion.value = "";
      vendedorSelect.value = "";

      cargarClientes();
    };
  }

  // =====================
  // LISTAR CLIENTES
  // =====================
  async function cargarClientes() {
    if (!clientesContainer) return;

    clientesContainer.innerHTML = "";
    const snap = await getDocs(collection(db, "clientes"));

    snap.forEach(docSnap => {
      const c = docSnap.data();
      const div = document.createElement("div");
      div.className = "card";
      div.innerHTML = `
        <strong>${c.nombre}</strong><br>
        ${c.telefono || ""}<br>
        ${c.direccion || ""}
      `;
      clientesContainer.appendChild(div);
    });
  }

});
