import { auth, db } from "./firebase.js";
import {
  collection, getDocs, addDoc, doc, getDoc,
  updateDoc, deleteDoc, query, where, orderBy, Timestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

document.addEventListener("DOMContentLoaded", () => {

  let editId = null;
  let editClienteId = null;

  const codigo = document.getElementById("codigo");
  const nombre = document.getElementById("nombre");
  const variedad = document.getElementById("variedad");
  const peso = document.getElementById("peso");
  const precio = document.getElementById("precio");
  const precioIVA = document.getElementById("precioIVA");
  const productosContainer = document.getElementById("productosContainer");

  const clienteNombre = document.getElementById("clienteNombre");
  const clienteTelefono = document.getElementById("clienteTelefono");
  const clienteDireccion = document.getElementById("clienteDireccion");
  const clienteUbicacion = document.getElementById("clienteUbicacion");
  const vendedorSelect = document.getElementById("vendedorSelect");
  const clientesContainer = document.getElementById("clientesContainer");

  const fechaInicioInput = document.getElementById("fechaInicio");
  const fechaFinInput = document.getElementById("fechaFin");
  const estadisticasContainer = document.getElementById("estadisticasContainer");

  const btnLogout = document.getElementById("btnLogout");
  const btnRegistro = document.getElementById("btnRegistro");
  const btnAgregar = document.getElementById("btnAgregar");
  const btnAgregarCliente = document.getElementById("btnAgregarCliente");
  const btnFiltrarEstadisticas = document.getElementById("btnFiltrarEstadisticas");
  const btnExportExcel = document.getElementById("btnExportExcel");
  const btnExportarClientes = document.getElementById("btnExportarClientes");

  onAuthStateChanged(auth, async (user) => {
    if (!user) location.href = "index.html";

    await cargarVendedores();
    cargarClientes();
    listarProductos();
    cargarDashboard();
    cargarGraficaMensual();
  });

  if (btnLogout) btnLogout.onclick = async () => {
    await signOut(auth);
    location.href = "index.html";
  };

  if (btnRegistro) btnRegistro.onclick = async () => {
    await signOut(auth);
    location.href = "registro.html";
  };

  window.obtenerUbicacion = () => {
    if (!navigator.geolocation) return alert("La geolocalización no está disponible");
    navigator.geolocation.getCurrentPosition(pos => {
      clienteUbicacion.value = `${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`;
    });
  };

  if (precio && precioIVA) {
    precio.addEventListener("input", () => {
      precioIVA.value = (Number(precio.value) * 1.01).toFixed(2);
    });
  }

  if (btnAgregar) btnAgregar.onclick = async () => {
    if (!codigo.value || !nombre.value || !peso.value || !precio.value) return alert("Complete todos los campos");

    const data = {
      codigo: codigo.value,
      nombre: nombre.value,
      variedad: variedad.value || null,
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

    codigo.value = nombre.value = variedad.value = peso.value = precio.value = precioIVA.value = "";
    listarProductos();
  };

  async function listarProductos() {
    if (!productosContainer) return;
    const snap = await getDocs(collection(db, "productos"));
    productosContainer.innerHTML = "";
    snap.forEach(docSnap => {
      const p = docSnap.data();
      productosContainer.innerHTML += `
        <div class="card">
          <p><strong>${p.nombre}</strong></p>
          <p>₡${p.precioIVA}</p>
        </div>`;
    });
  }

  async function cargarVendedores() {
    if (!vendedorSelect) return;
    const snap = await getDocs(collection(db, "usuarios"));
    vendedorSelect.innerHTML = "<option value=''>Seleccione vendedor</option>";
    snap.forEach(docSnap => {
      vendedorSelect.innerHTML += `<option value="${docSnap.id}">${docSnap.data().nombre}</option>`;
    });
  }

  if (btnAgregarCliente) btnAgregarCliente.onclick = async () => {
    if (!clienteNombre.value || !vendedorSelect.value) return alert("Complete los campos obligatorios");

    const data = {
      nombre: clienteNombre.value,
      telefono: clienteTelefono.value || null,
      direccion: clienteDireccion.value || null,
      ubicacion: clienteUbicacion.value || null,
      vendedorId: vendedorSelect.value
    };

    if (editClienteId) {
      await updateDoc(doc(db, "clientes", editClienteId), data);
      editClienteId = null;
    } else {
      await addDoc(collection(db, "clientes"), { ...data, fecha: Timestamp.now() });
    }

    clienteNombre.value = clienteTelefono.value = clienteDireccion.value = clienteUbicacion.value = "";
    vendedorSelect.value = "";
    cargarClientes();
  };

  async function cargarClientes() {
    if (!clientesContainer) return;
    const snap = await getDocs(collection(db, "clientes"));
    clientesContainer.innerHTML = "";
    snap.forEach(docSnap => {
      const c = docSnap.data();
      clientesContainer.innerHTML += `
        <div class="card">
          <p><strong>${c.nombre}</strong></p>
          <p>${c.telefono || "-"}</p>
        </div>`;
    });
  }

  // =====================
  // EXPORTAR CLIENTES A EXCEL (ORDENADOS POR FECHA)
  // =====================
  if (btnExportarClientes) btnExportarClientes.onclick = async () => {
    const q = query(collection(db, "clientes"), orderBy("fecha", "asc"));
    const snap = await getDocs(q);
    if (snap.empty) return alert("No hay clientes");

    const datos = [];
    snap.forEach(docSnap => {
      const c = docSnap.data();
      datos.push({
        "ID Cliente": docSnap.id,
        "Nombre": c.nombre,
        "Teléfono": c.telefono || "",
        "Dirección": c.direccion || "",
        "Ubicación": c.ubicacion || "",
        "Vendedor ID": c.vendedorId || "",
        "Fecha Registro": c.fecha?.toDate().toLocaleString() || "-"
      });
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(datos);
    XLSX.utils.book_append_sheet(wb, ws, "Clientes");
    XLSX.writeFile(wb, "CAFÉ_PRÓDIGO_SUELO_Clientes.xlsx");
  };

});
