import { auth, db } from "./firebase.js";
import {
  collection, getDocs, addDoc, doc, getDoc, updateDoc, deleteDoc, query, where, Timestamp
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

  const productosBody = document.getElementById("productosBody");

  const clienteNombre = document.getElementById("clienteNombre");
  const clienteTelefono = document.getElementById("clienteTelefono");
  const clienteDireccion = document.getElementById("clienteDireccion");
  const clienteUbicacion = document.getElementById("clienteUbicacion");
  const vendedorSelect = document.getElementById("vendedorSelect");
  const clientesContainer = document.getElementById("clientesContainer");

  const btnAgregar = document.getElementById("btnAgregar");
  const btnAgregarCliente = document.getElementById("btnAgregarCliente");
  const btnLogout = document.getElementById("btnLogout");

  onAuthStateChanged(auth, async (user) => {
    if (!user) location.href = "index.html";
    await cargarVendedores();
    listarProductos();
    cargarClientes();
    cargarDashboard();
    cargarGraficaMensual();
  });

  btnLogout.onclick = async () => {
    await signOut(auth);
    location.href = "index.html";
  };

  precio.addEventListener("input", () => {
    precioIVA.value = (precio.value * 1.01).toFixed(2);
  });

  btnAgregar.onclick = async () => {
    const data = {
      codigo: codigo.value,
      nombre: nombre.value,
      variedad: variedad.value,
      peso: Number(peso.value),
      precio: Number(precio.value),
      precioIVA: Number(precioIVA.value)
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
    productosBody.innerHTML = "";
    const snap = await getDocs(collection(db, "productos"));

    snap.forEach(d => {
      const p = d.data();
      productosBody.innerHTML += `
        <tr>
          <td>${p.codigo}</td>
          <td>${p.nombre}</td>
          <td>${p.variedad || "-"}</td>
          <td>${p.peso}</td>
          <td>${(p.peso / 1000).toFixed(2)}</td>
          <td>₡${p.precio}</td>
          <td>₡${p.precioIVA}</td>
          <td>
            <button onclick="editarProducto('${d.id}')">✏️</button>
            <button onclick="eliminarProducto('${d.id}')">🗑️</button>
          </td>
        </tr>
      `;
    });
  }

  window.editarProducto = async (id) => {
    const d = await getDoc(doc(db, "productos", id));
    const p = d.data();
    codigo.value = p.codigo;
    nombre.value = p.nombre;
    variedad.value = p.variedad;
    peso.value = p.peso;
    precio.value = p.precio;
    precioIVA.value = p.precioIVA;
    editId = id;
  };

  window.eliminarProducto = async (id) => {
    if (confirm("Eliminar producto?")) {
      await deleteDoc(doc(db, "productos", id));
      listarProductos();
    }
  };

  async function cargarVendedores() {
    vendedorSelect.innerHTML = "<option value=''>Vendedor</option>";
    const snap = await getDocs(collection(db, "usuarios"));
    snap.forEach(d => {
      vendedorSelect.innerHTML += `<option value="${d.id}">${d.data().nombre}</option>`;
    });
  }

  btnAgregarCliente.onclick = async () => {
    const data = {
      nombre: clienteNombre.value,
      telefono: clienteTelefono.value,
      direccion: clienteDireccion.value,
      ubicacion: clienteUbicacion.value,
      vendedorId: vendedorSelect.value,
      fecha: Timestamp.now()
    };

    if (editClienteId) {
      await updateDoc(doc(db, "clientes", editClienteId), data);
      editClienteId = null;
    } else {
      await addDoc(collection(db, "clientes"), data);
    }

    clienteNombre.value = clienteTelefono.value = clienteDireccion.value = clienteUbicacion.value = "";
    cargarClientes();
  };

  async function cargarClientes() {
    clientesContainer.innerHTML = "";
    const snap = await getDocs(collection(db, "clientes"));

    snap.forEach(d => {
      const c = d.data();
      const vendedor =
        vendedorSelect.querySelector(`option[value="${c.vendedorId}"]`)?.text || "-";

      const mapa = c.ubicacion
        ? `<a href="https://www.google.com/maps?q=${c.ubicacion}" target="_blank">📍</a>`
        : "-";

      clientesContainer.innerHTML += `
        <tr>
          <td>${c.nombre}</td>
          <td>${c.telefono || "-"}</td>
          <td>${c.direccion || "-"}</td>
          <td>${mapa}</td>
          <td>${vendedor}</td>
          <td>
            <button onclick="editarCliente('${d.id}')">✏️</button>
            <button onclick="eliminarCliente('${d.id}')">🗑️</button>
          </td>
        </tr>
      `;
    });
  }

  window.editarCliente = async (id) => {
    const d = await getDoc(doc(db, "clientes", id));
    const c = d.data();
    clienteNombre.value = c.nombre;
    clienteTelefono.value = c.telefono;
    clienteDireccion.value = c.direccion;
    clienteUbicacion.value = c.ubicacion;
    vendedorSelect.value = c.vendedorId;
    editClienteId = id;
  };

  window.eliminarCliente = async (id) => {
    if (confirm("Eliminar cliente?")) {
      await deleteDoc(doc(db, "clientes", id));
      cargarClientes();
    }
  };

  window.obtenerUbicacion = () => {
    navigator.geolocation.getCurrentPosition(pos => {
      clienteUbicacion.value =
        `${pos.coords.latitude}, ${pos.coords.longitude}`;
    });
  };

  async function cargarDashboard() {
    const snap = await getDocs(collection(db, "ventas"));
    let total = 0, kg = 0, pedidos = 0, entrantes = 0;

    snap.forEach(d => {
      const v = d.data();
      total += v.total || 0;
      pedidos++;
      if (v.estado === "entrante") entrantes++;

      v.lineas?.forEach(l => {
        kg += (l.peso * l.cantidad) / 1000;
      });
    });

    document.getElementById("kpiVentas").textContent = `₡${total.toLocaleString()}`;
    document.getElementById("kpiKg").textContent = `${kg.toFixed(2)} kg`;
    document.getElementById("kpiPedidos").textContent = pedidos;
    document.getElementById("kpiEntrantes").textContent = entrantes;
  }

  async function cargarGraficaMensual() {
    const ctx = document.getElementById("graficaVentasMensuales");
    if (!ctx) return;

    new Chart(ctx, {
      type: "bar",
      data: {
        labels: ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"],
        datasets: [{ label: "Ventas", data: Array(12).fill(0) }]
      }
    });
  }

});
