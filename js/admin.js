import { auth, db } from "./firebase.js";
import {
  collection, getDocs, addDoc, doc, getDoc,
  updateDoc, deleteDoc, Timestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

let editProductoId = null;
let editClienteId = null;
let chartInstance = null;

let productosCache = [];
let clientesCache = [];

document.addEventListener("DOMContentLoaded", () => {

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
  // LOGOUT
  // =======================
  document.getElementById("btnLogout")?.addEventListener("click", async () => {
    await signOut(auth);
    location.href = "index.html";
  });

});

/* =====================================================
   DASHBOARD
===================================================== */

async function cargarDashboard() {
  const snap = await getDocs(collection(db, "ventas"));

  let totalVentas = 0;
  let totalKg = 0;
  let pedidosMes = 0;

  const estados = {
    entrante: 0,
    "en proceso": 0,
    listo: 0,
    atrasado: 0
  };

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
        totalKg += (Number(l.peso) * Number(l.cantidad)) / 1000;
      });
    }
  });

  document.getElementById("kpiVentas").textContent = `₡${totalVentas.toLocaleString()}`;
  document.getElementById("kpiKg").textContent = `${totalKg.toFixed(2)} kg`;
  document.getElementById("kpiPedidos").textContent = pedidosMes;
  document.getElementById("kpiEntrantes").textContent = estados.entrante;

  document.getElementById("estadoProduccion").innerHTML = `
    <div class="estado-box entrante">Entrantes<br>${estados.entrante}</div>
    <div class="estado-box proceso">En proceso<br>${estados["en proceso"]}</div>
    <div class="estado-box listo">Listos<br>${estados.listo}</div>
    <div class="estado-box atrasado">Atrasados<br>${estados.atrasado}</div>
  `;
}

/* =====================================================
   GRÁFICA MENSUAL
===================================================== */

async function cargarGraficaMensual() {
  const snap = await getDocs(collection(db, "ventas"));

  const meses = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
  const ventas = Array(12).fill(0);
  const kg = Array(12).fill(0);
  const pedidos = Array(12).fill(0);

  snap.forEach(d => {
    const v = d.data();
    if (!v.fecha) return;

    const f = v.fecha.toDate();
    const m = f.getMonth();

    ventas[m] += Number(v.total || 0);
    pedidos[m]++;

    if (Array.isArray(v.lineas)) {
      v.lineas.forEach(l => {
        kg[m] += (Number(l.peso) * Number(l.cantidad)) / 1000;
      });
    }
  });

  const ctx = document.getElementById("graficaVentasMensuales");
  if (!ctx) return;

  if (chartInstance) chartInstance.destroy();

  chartInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels: meses,
      datasets: [
        { label: "₡ Ventas", data: ventas },
        { label: "Kg vendidos", data: kg },
        { label: "Pedidos", data: pedidos }
      ]
    },
    options: {
      responsive: true,
      scales: { y: { beginAtZero: true } }
    }
  });
}

/* =====================================================
   PRODUCTOS
===================================================== */

async function cargarProductos() {
  productosCache = [];
  const snap = await getDocs(collection(db, "productos"));
  snap.forEach(d => productosCache.push({ id: d.id, ...d.data() }));
  renderProductos(productosCache);
}

function renderProductos(lista) {
  const body = document.getElementById("productosBody");
  body.innerHTML = "";

  lista.forEach(p => {
    body.innerHTML += `
      <tr>
        <td>${p.codigo || ""}</td>
        <td>${p.nombre}</td>
        <td>${p.variedad || ""}</td>
        <td>${p.peso}</td>
        <td>${(p.peso / 1000).toFixed(2)}</td>
        <td>₡${Number(p.precio).toLocaleString()}</td>
        <td>₡${Number(p.precioIVA).toLocaleString()}</td>
        <td>
          <button onclick="editarProducto('${p.id}')">✏️</button>
          <button onclick="eliminarProducto('${p.id}')">🗑</button>
        </td>
      </tr>
    `;
  });
}

document.getElementById("buscarProducto")?.addEventListener("input", e => {
  const t = e.target.value.toLowerCase();
  renderProductos(productosCache.filter(p =>
    `${p.nombre} ${p.variedad} ${p.peso}`.toLowerCase().includes(t)
  ));
});

window.editarProducto = async (id) => {
  const snap = await getDoc(doc(db, "productos", id));
  if (!snap.exists()) return;

  const p = snap.data();
  editProductoId = id;

  codigo.value = p.codigo || "";
  nombre.value = p.nombre;
  variedad.value = p.variedad || "";
  peso.value = p.peso;
  precio.value = p.precio;
  precioIVA.value = p.precioIVA;
};

window.eliminarProducto = async (id) => {
  if (!confirm("¿Eliminar producto?")) return;
  await deleteDoc(doc(db, "productos", id));
  cargarProductos();
};

/* =====================================================
   CLIENTES
===================================================== */

async function cargarClientes() {
  clientesCache = [];
  const snap = await getDocs(collection(db, "clientes"));
  snap.forEach(d => clientesCache.push({ id: d.id, ...d.data() }));
  renderClientes(clientesCache);
}

function renderClientes(lista) {
  const body = document.getElementById("clientesContainer");
  body.innerHTML = "";

  lista.forEach(c => {
    body.innerHTML += `
      <tr>
        <td>${c.nombre}</td>
        <td>${c.telefono}</td>
        <td>${c.direccion || ""}</td>
        <td>
          ${c.ubicacion ? `<a href="https://www.google.com/maps?q=${c.ubicacion}" target="_blank">📍</a>` : ""}
        </td>
        <td>${c.vendedor || ""}</td>
        <td>
          <button onclick="editarCliente('${c.id}')">✏️</button>
          <button onclick="eliminarCliente('${c.id}')">🗑</button>
        </td>
      </tr>
    `;
  });
}

document.getElementById("buscarCliente")?.addEventListener("input", e => {
  const t = e.target.value.toLowerCase();
  renderClientes(clientesCache.filter(c =>
    `${c.nombre} ${c.telefono} ${c.vendedor}`.toLowerCase().includes(t)
  ));
});

window.editarCliente = async (id) => {
  const snap = await getDoc(doc(db, "clientes", id));
  if (!snap.exists()) return;

  const c = snap.data();
  editClienteId = id;

  clienteNombre.value = c.nombre;
  clienteTelefono.value = c.telefono;
  clienteDireccion.value = c.direccion || "";
  clienteUbicacion.value = c.ubicacion || "";
};

window.eliminarCliente = async (id) => {
  if (!confirm("¿Eliminar cliente?")) return;
  await deleteDoc(doc(db, "clientes", id));
  cargarClientes();
};
