// ================================
// FIREBASE IMPORTS
// ================================
import { auth, db } from "./firebase.js";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDoc,
  query,
  where,
  Timestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// ================================
// AUTH
// ================================
onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "login.html";
  }
});

document.getElementById("btnLogout").addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "login.html";
});

// ================================
// VARIABLES
// ================================
let editProductoId = null;
let editClienteId = null;

const productosBody = document.getElementById("productosBody");
const clientesContainer = document.getElementById("clientesContainer");

// ================================
// PRODUCTOS
// ================================
async function cargarProductos(filtro = "") {
  productosBody.innerHTML = "";

  const snap = await getDocs(collection(db, "productos"));

  snap.forEach((docu) => {
    const p = docu.data();
    const texto = `${p.nombre} ${p.variedad} ${p.peso}`.toLowerCase();
    if (!texto.includes(filtro.toLowerCase())) return;

    const kilos = (p.peso / 1000).toFixed(2);

    productosBody.innerHTML += `
      <tr>
        <td>${p.codigo}</td>
        <td>${p.nombre}</td>
        <td>${p.variedad || ""}</td>
        <td>${p.peso}</td>
        <td>${kilos}</td>
        <td>₡${p.precio}</td>
        <td>₡${p.precioIVA}</td>
        <td>
          <button onclick="editarProducto('${docu.id}')">✏️</button>
          <button onclick="eliminarProducto('${docu.id}')">🗑️</button>
        </td>
      </tr>
    `;
  });
}

window.editarProducto = async (id) => {
  const ref = doc(db, "productos", id);
  const snap = await getDoc(ref);
  const p = snap.data();

  editProductoId = id;
  codigo.value = p.codigo;
  nombre.value = p.nombre;
  variedad.value = p.variedad;
  peso.value = p.peso;
  precio.value = p.precio;
  precioIVA.value = p.precioIVA;
};

window.eliminarProducto = async (id) => {
  if (confirm("¿Eliminar producto?")) {
    await deleteDoc(doc(db, "productos", id));
    cargarProductos();
    cargarDashboard();
  }
};

btnAgregar.addEventListener("click", async () => {
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

  cargarProductos();
  cargarDashboard();
});

// precio IVA automático
precio.addEventListener("input", () => {
  precioIVA.value = Math.round(precio.value * 1.01);
});

// buscador productos
buscarProducto.addEventListener("input", e => cargarProductos(e.target.value));

// ================================
// CLIENTES
// ================================
async function cargarClientes(filtro = "") {
  clientesContainer.innerHTML = "";
  const snap = await getDocs(collection(db, "clientes"));

  snap.forEach(docu => {
    const c = docu.data();
    const texto = `${c.nombre} ${c.telefono} ${c.vendedor}`.toLowerCase();
    if (!texto.includes(filtro.toLowerCase())) return;

    const maps = `https://www.google.com/maps?q=${c.ubicacion}`;

    clientesContainer.innerHTML += `
      <tr>
        <td>${c.nombre}</td>
        <td>${c.telefono}</td>
        <td>${c.direccion}</td>
        <td><a href="${maps}" target="_blank">🗺</a></td>
        <td>${c.vendedor}</td>
        <td>
          <button onclick="editarCliente('${docu.id}')">✏️</button>
          <button onclick="eliminarCliente('${docu.id}')">🗑️</button>
        </td>
      </tr>
    `;
  });
}

window.editarCliente = async (id) => {
  const snap = await getDoc(doc(db, "clientes", id));
  const c = snap.data();

  editClienteId = id;
  clienteNombre.value = c.nombre;
  clienteTelefono.value = c.telefono;
  clienteDireccion.value = c.direccion;
  clienteUbicacion.value = c.ubicacion;
  vendedorSelect.value = c.vendedor;
};

window.eliminarCliente = async (id) => {
  if (confirm("¿Eliminar cliente?")) {
    await deleteDoc(doc(db, "clientes", id));
    cargarClientes();
  }
};

btnAgregarCliente.addEventListener("click", async () => {
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
    await addDoc(collection(db, "clientes"), data);
  }

  cargarClientes();
});

buscarCliente.addEventListener("input", e => cargarClientes(e.target.value));

// ================================
// GEOLOCALIZACIÓN
// ================================
window.obtenerUbicacion = () => {
  navigator.geolocation.getCurrentPosition(pos => {
    clienteUbicacion.value = `${pos.coords.latitude},${pos.coords.longitude}`;
  });
};

// ================================
// DASHBOARD
// ================================
let chart;

async function cargarDashboard() {
  let totalVentas = 0;
  let totalKg = 0;
  let pedidosMes = 0;
  let entrantes = 0;
  const ventasPorMes = {};

  const snap = await getDocs(collection(db, "ventas"));

  snap.forEach(docu => {
    const v = docu.data();
    totalVentas += v.total;
    totalKg += v.kilos;
    pedidosMes++;
    if (v.estado === "pendiente") entrantes++;

    const mes = v.fecha.toDate().toLocaleString("es-CR", { month: "short" });
    ventasPorMes[mes] = (ventasPorMes[mes] || 0) + v.total;
  });

  kpiVentas.textContent = `₡${totalVentas.toLocaleString()}`;
  kpiKg.textContent = `${totalKg.toFixed(2)} kg`;
  kpiPedidos.textContent = pedidosMes;
  kpiEntrantes.textContent = entrantes;

  const labels = Object.keys(ventasPorMes);
  const data = Object.values(ventasPorMes);

  if (chart) chart.destroy();
  chart = new Chart(graficaVentasMensuales, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Ventas",
        data
      }]
    }
  });
}

// ================================
// INIT
// ================================
cargarProductos();
cargarClientes();
cargarDashboard();
