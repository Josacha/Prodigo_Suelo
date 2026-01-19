import { auth, db } from "./firebase.js";
import {
  collection, getDocs, addDoc, doc, getDoc,
  updateDoc, deleteDoc, query, where, Timestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

let editProductoId = null;
let editClienteId = null;
let productosCache = [];
let clientesCache = [];

document.addEventListener("DOMContentLoaded", () => {

  const productosBody = document.getElementById("productosBody");
  const clientesBody = document.getElementById("clientesContainer");

  const buscarProducto = document.getElementById("buscarProducto");
  const buscarCliente = document.getElementById("buscarCliente");

  const codigo = document.getElementById("codigo");
  const nombre = document.getElementById("nombre");
  const variedad = document.getElementById("variedad");
  const peso = document.getElementById("peso");
  const precio = document.getElementById("precio");
  const precioIVA = document.getElementById("precioIVA");

  const btnAgregar = document.getElementById("btnAgregar");

  const clienteNombre = document.getElementById("clienteNombre");
  const clienteTelefono = document.getElementById("clienteTelefono");
  const clienteDireccion = document.getElementById("clienteDireccion");
  const clienteUbicacion = document.getElementById("clienteUbicacion");
  const vendedorSelect = document.getElementById("vendedorSelect");
  const btnAgregarCliente = document.getElementById("btnAgregarCliente");

  /* ================== IVA ================== */
  precio.addEventListener("input", () => {
    precioIVA.value = (Number(precio.value || 0) * 1.01).toFixed(2);
  });

  /* ================== PRODUCTOS ================== */
  btnAgregar.onclick = async () => {
    const data = {
      codigo: codigo.value,
      nombre: nombre.value,
      variedad: variedad.value,
      peso: Number(peso.value),
      precio: Number(precio.value),
      precioIVA: Number(precioIVA.value)
    };

    if (editProductoId) {
      await updateDoc(doc(db, "productos", editProductoId), data);
      editProductoId = null;
    } else {
      await addDoc(collection(db, "productos"), data);
    }

    limpiarProducto();
    cargarProductos();
  };

  async function cargarProductos() {
    const snap = await getDocs(collection(db, "productos"));
    productosCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    pintarProductos(productosCache);
  }

  function pintarProductos(lista) {
    productosBody.innerHTML = "";
    lista.forEach(p => {
      const kg = (p.peso / 1000).toFixed(2);
      productosBody.innerHTML += `
        <tr>
          <td>${p.codigo}</td>
          <td>${p.nombre}</td>
          <td>${p.variedad || "-"}</td>
          <td>${p.peso}</td>
          <td>${kg}</td>
          <td>₡${p.precio}</td>
          <td>₡${p.precioIVA}</td>
          <td>
            <button onclick="editarProducto('${p.id}')">✏️</button>
            <button onclick="eliminarProducto('${p.id}')">🗑️</button>
          </td>
        </tr>`;
    });
  }

  buscarProducto.oninput = () => {
    const t = buscarProducto.value.toLowerCase();
    pintarProductos(productosCache.filter(p =>
      p.nombre.toLowerCase().includes(t) ||
      (p.variedad || "").toLowerCase().includes(t)
    ));
  };

  window.editarProducto = async (id) => {
    const p = productosCache.find(p => p.id === id);
    codigo.value = p.codigo;
    nombre.value = p.nombre;
    variedad.value = p.variedad;
    peso.value = p.peso;
    precio.value = p.precio;
    precioIVA.value = p.precioIVA;
    editProductoId = id;
  };

  window.eliminarProducto = async (id) => {
    if (confirm("¿Eliminar producto?")) {
      await deleteDoc(doc(db, "productos", id));
      cargarProductos();
    }
  };

  function limpiarProducto() {
    codigo.value = nombre.value = variedad.value = peso.value = precio.value = precioIVA.value = "";
  }


 /* ================== GRAFICA ================== */

async function cargarGraficaMensual() {
  if (typeof Chart === "undefined") {
    console.warn("Chart.js no cargó todavía");
    return;
  }

  const snap = await getDocs(collection(db, "ventas"));

  const meses = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
  let ventas = Array(12).fill(0);
  let kilos = Array(12).fill(0);

  snap.forEach(docSnap => {
    const v = docSnap.data();
    if (!v.fecha) return;

    const fecha = v.fecha.toDate ? v.fecha.toDate() : new Date(v.fecha);
    const mes = fecha.getMonth();

    ventas[mes] += Number(v.total || 0);

    if (Array.isArray(v.lineas)) {
      v.lineas.forEach(l => {
        const peso = Number(l.peso);
        const cantidad = Number(l.cantidad);
        if (!isNaN(peso) && !isNaN(cantidad)) {
          kilos[mes] += (peso * cantidad) / 1000;
        }
      });
    }
  });

  const ctx = document.getElementById("graficaVentasMensuales")?.getContext("2d");
  if (!ctx) return;

  if (graficaMensual) graficaMensual.destroy();

  graficaMensual = new Chart(ctx, {
    type: "bar",
    data: {
      labels: meses,
      datasets: [
        { label: "₡ Ventas", data: ventas },
        { label: "Kg vendidos", data: kilos }
      ]
    },
    options: {
      responsive: true,
      scales: { y: { beginAtZero: true } }
    }
  });
}




  
  /* ================== CLIENTES ================== */
  window.obtenerUbicacion = () => {
    navigator.geolocation.getCurrentPosition(pos => {
      clienteUbicacion.value = `${pos.coords.latitude}, ${pos.coords.longitude}`;
    });
  };

  btnAgregarCliente.onclick = async () => {
    const data = {
      nombre: clienteNombre.value,
      telefono: clienteTelefono.value,
      direccion: clienteDireccion.value,
      ubicacion: clienteUbicacion.value,
      vendedorId: vendedorSelect.value
    };

    if (editClienteId) {
      await updateDoc(doc(db, "clientes", editClienteId), data);
      editClienteId = null;
    } else {
      await addDoc(collection(db, "clientes"), data);
    }

    limpiarCliente();
    cargarClientes();
  };

  async function cargarClientes() {
    const snap = await getDocs(collection(db, "clientes"));
    clientesCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    pintarClientes(clientesCache);
  }

  function pintarClientes(lista) {
    clientesBody.innerHTML = "";
    lista.forEach(c => {
      const link = c.ubicacion
        ? `<a href="https://www.google.com/maps?q=${c.ubicacion}" target="_blank">📍</a>`
        : "-";

      clientesBody.innerHTML += `
        <tr>
          <td>${c.nombre}</td>
          <td>${c.telefono || "-"}</td>
          <td>${c.direccion || "-"}</td>
          <td>${link}</td>
          <td>${c.vendedorId || "-"}</td>
          <td>
            <button onclick="editarCliente('${c.id}')">✏️</button>
            <button onclick="eliminarCliente('${c.id}')">🗑️</button>
          </td>
        </tr>`;
    });
  }

  buscarCliente.oninput = () => {
    const t = buscarCliente.value.toLowerCase();
    pintarClientes(clientesCache.filter(c =>
      c.nombre.toLowerCase().includes(t) ||
      (c.telefono || "").includes(t)
    ));
  };

  window.editarCliente = (id) => {
    const c = clientesCache.find(c => c.id === id);
    clienteNombre.value = c.nombre;
    clienteTelefono.value = c.telefono;
    clienteDireccion.value = c.direccion;
    clienteUbicacion.value = c.ubicacion;
    vendedorSelect.value = c.vendedorId;
    editClienteId = id;
  };

  window.eliminarCliente = async (id) => {
    if (confirm("¿Eliminar cliente?")) {
      await deleteDoc(doc(db, "clientes", id));
      cargarClientes();
    }
  };

  function limpiarCliente() {
    clienteNombre.value = clienteTelefono.value = clienteDireccion.value = clienteUbicacion.value = "";
  }

  cargarProductos();
  cargarClientes();
});

