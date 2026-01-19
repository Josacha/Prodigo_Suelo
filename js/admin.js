import { auth, db } from "./firebase.js";
import {
  collection, getDocs, addDoc, doc, updateDoc, deleteDoc, Timestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

document.addEventListener("DOMContentLoaded", () => {

  let editProductoId = null;
  let editClienteId = null;
  let chartInstance = null;

  // =======================
  // ELEMENTOS PRODUCTOS
  // =======================
  const codigo = document.getElementById("codigo");
  const nombre = document.getElementById("nombre");
  const variedad = document.getElementById("variedad");
  const peso = document.getElementById("peso");
  const precio = document.getElementById("precio");
  const precioIVA = document.getElementById("precioIVA");
  const tablaProductos = document.getElementById("tablaProductos");

  // =======================
  // ELEMENTOS CLIENTES
  // =======================
  const clienteNombre = document.getElementById("clienteNombre");
  const clienteTelefono = document.getElementById("clienteTelefono");
  const clienteDireccion = document.getElementById("clienteDireccion");
  const clienteUbicacion = document.getElementById("clienteUbicacion");
  const vendedorSelect = document.getElementById("vendedorSelect");
  const tablaClientes = document.getElementById("tablaClientes");

  // =======================
  // DASHBOARD
  // =======================
  const kpiVentas = document.getElementById("kpiVentas");
  const kpiKg = document.getElementById("kpiKg");
  const kpiPedidos = document.getElementById("kpiPedidos");
  const kpiEntrantes = document.getElementById("kpiEntrantes");
  const estadoProduccion = document.getElementById("estadoProduccion");

  // =======================
  // AUTH
  // =======================
  onAuthStateChanged(auth, async (user) => {
    if (!user) location.href = "index.html";

    await cargarDashboard();
    await cargarGraficaMensual();
    await cargarProductos();
    await cargarClientes();
  });

  // =======================
  // DASHBOARD
  // =======================
  async function cargarDashboard() {
    const snap = await getDocs(collection(db, "ventas"));

    let totalVentas = 0;
    let totalKg = 0;
    let pedidosMes = 0;

    let estados = { entrante: 0, "en proceso": 0, listo: 0, atrasado: 0 };

    const hoy = new Date();
    const mes = hoy.getMonth();
    const anio = hoy.getFullYear();

    snap.forEach(d => {
      const v = d.data();
      const fecha = v.fecha?.toDate ? v.fecha.toDate() : new Date(v.fecha);

      totalVentas += Number(v.total || 0);

      if (fecha.getMonth() === mes && fecha.getFullYear() === anio) {
        pedidosMes++;
      }

      if (estados[v.estado] !== undefined) estados[v.estado]++;

      if (Array.isArray(v.lineas)) {
        v.lineas.forEach(l => {
          totalKg += ((Number(l.peso) || 0) * (Number(l.cantidad) || 0)) / 1000;
        });
      }
    });

    kpiVentas.textContent = `₡${totalVentas.toLocaleString()}`;
    kpiKg.textContent = `${totalKg.toFixed(2)} kg`;
    kpiPedidos.textContent = pedidosMes;
    kpiEntrantes.textContent = estados.entrante;

    estadoProduccion.innerHTML = `
      <div class="estado-box entrante">Entrantes<br>${estados.entrante}</div>
      <div class="estado-box proceso">En Proceso<br>${estados["en proceso"]}</div>
      <div class="estado-box listo">Listos<br>${estados.listo}</div>
      <div class="estado-box atrasado">Atrasados<br>${estados.atrasado}</div>
    `;
  }

  // =======================
  // GRAFICA
  // =======================
  async function cargarGraficaMensual() {
    const snap = await getDocs(collection(db, "ventas"));

    const meses = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
    let ventas = Array(12).fill(0);
    let kilos = Array(12).fill(0);
    let pedidos = Array(12).fill(0);

    snap.forEach(d => {
      const v = d.data();
      if (!v.fecha) return;

      const f = v.fecha.toDate ? v.fecha.toDate() : new Date(v.fecha);
      const m = f.getMonth();

      ventas[m] += Number(v.total || 0);
      pedidos[m]++;

      if (Array.isArray(v.lineas)) {
        v.lineas.forEach(l => {
          kilos[m] += ((Number(l.peso)||0) * (Number(l.cantidad)||0)) / 1000;
        });
      }
    });

    const ctx = document.getElementById("graficaVentasMensuales");
    if (chartInstance) chartInstance.destroy();

    chartInstance = new Chart(ctx, {
      type: "bar",
      data: {
        labels: meses,
        datasets: [
          { label: "₡ Ventas", data: ventas },
          { label: "Kg", data: kilos },
          { label: "Pedidos", data: pedidos }
        ]
      }
    });
  }

  // =======================
  // PRODUCTOS
  // =======================
  async function cargarProductos() {
    const snap = await getDocs(collection(db, "productos"));
    tablaProductos.innerHTML = "";

    snap.forEach(d => {
      const p = d.data();
      tablaProductos.innerHTML += `
        <tr>
          <td>${p.codigo || ""}</td>
          <td>${p.nombre}</td>
          <td>${p.variedad || ""}</td>
          <td>${p.peso}</td>
          <td>₡${p.precio}</td>
          <td>
            <button onclick="editarProducto('${d.id}')">✏</button>
            <button onclick="eliminarProducto('${d.id}')">🗑</button>
          </td>
        </tr>
      `;
    });
  }

  window.editarProducto = async (id) => {
    const snap = await getDocs(collection(db, "productos"));
    snap.forEach(d => {
      if (d.id === id) {
        const p = d.data();
        codigo.value = p.codigo || "";
        nombre.value = p.nombre;
        variedad.value = p.variedad || "";
        peso.value = p.peso;
        precio.value = p.precio;
        precioIVA.value = p.precioIVA || 0;
        editProductoId = id;
      }
    });
  };

  window.eliminarProducto = async (id) => {
    if (confirm("Eliminar producto?")) {
      await deleteDoc(doc(db, "productos", id));
      cargarProductos();
    }
  };

  document.getElementById("btnAgregar").addEventListener("click", async () => {
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

    codigo.value = nombre.value = variedad.value = peso.value = precio.value = precioIVA.value = "";
    cargarProductos();
  });

  // =======================
  // CLIENTES
  // =======================
  async function cargarClientes() {
    const snap = await getDocs(collection(db, "clientes"));
    tablaClientes.innerHTML = "";

    snap.forEach(d => {
      const c = d.data();
      tablaClientes.innerHTML += `
        <tr>
          <td>${c.nombre}</td>
          <td>${c.telefono || ""}</td>
          <td>${c.direccion || ""}</td>
          <td>
            <button onclick="editarCliente('${d.id}')">✏</button>
            <button onclick="eliminarCliente('${d.id}')">🗑</button>
          </td>
        </tr>
      `;
    });
  }

  window.editarCliente = async (id) => {
    const snap = await getDocs(collection(db, "clientes"));
    snap.forEach(d => {
      if (d.id === id) {
        const c = d.data();
        clienteNombre.value = c.nombre;
        clienteTelefono.value = c.telefono || "";
        clienteDireccion.value = c.direccion || "";
        clienteUbicacion.value = c.ubicacion || "";
        vendedorSelect.value = c.vendedor || "";
        editClienteId = id;
      }
    });
  };

  window.eliminarCliente = async (id) => {
    if (confirm("Eliminar cliente?")) {
      await deleteDoc(doc(db, "clientes", id));
      cargarClientes();
    }
  };

  document.getElementById("btnAgregarCliente").addEventListener("click", async () => {
    const data = {
      nombre: clienteNombre.value,
      telefono: clienteTelefono.value,
      direccion: clienteDireccion.value,
      ubicacion: clienteUbicacion.value,
      vendedor: vendedorSelect.value
    };

    if (editClienteId) {
      await updateDoc(doc(db, "clientes", editClienteId), data);
      editClienteId = null;
    } else {
      await addDoc(collection(db, "clientes"), { ...data, fecha: Timestamp.now() });
    }

    clienteNombre.value = clienteTelefono.value = clienteDireccion.value = clienteUbicacion.value = "";
    cargarClientes();
  });

});
