import { auth, db } from "./firebase.js";
import {
  collection, getDocs, addDoc, doc, getDoc, updateDoc, deleteDoc, query, where, Timestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// =====================
// VARIABLES
// =====================
let editId = null;
let carrito = []; // Solo si quieres usarlo para estadísticas o ventas

const codigo = document.getElementById("codigo");
const nombre = document.getElementById("nombre");
const variedad = document.getElementById("variedad");
const peso = document.getElementById("peso");
const precio = document.getElementById("precio");
const precioIVA = document.getElementById("precioIVA");
const productosContainer = document.getElementById("productosContainer");

const clienteNombre = document.getElementById("clienteNombre");
const clienteTelefono = document.getElementById("clienteTelefono");
const vendedorSelect = document.getElementById("vendedorSelect");
const clientesContainer = document.getElementById("clientesContainer");

const fechaInicioInput = document.getElementById("fechaInicio");
const fechaFinInput = document.getElementById("fechaFin");
const estadisticasContainer = document.getElementById("estadisticasContainer");

let editClienteId = null;

const clienteDireccion = document.getElementById("clienteDireccion");
const clienteUbicacion = document.getElementById("clienteUbicacion");


// =====================
// PROTECCIÓN
// =====================
onAuthStateChanged(auth, async (user) => {
  if (!user) location.href = "index.html";
  await cargarVendedores();
  cargarClientes();
  listarProductos();
cargarGraficaMensual();
    cargarDashboard(); 


  
});

// =====================
// LOGOUT
// =====================
document.getElementById("btnLogout").onclick = async () => {
  await signOut(auth);
  location.href = "index.html";
};

// =====================
// Ubicacion
// =====================

window.obtenerUbicacion = () => {
  if (!navigator.geolocation) {
    alert("La geolocalización no está disponible");
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const lat = pos.coords.latitude.toFixed(6);
      const lng = pos.coords.longitude.toFixed(6);
      document.getElementById("clienteUbicacion").value = `${lat}, ${lng}`;
    },
    () => {
      alert("No se pudo obtener la ubicación");
    }
  );
};


// =====================
// CALCULAR IVA
// =====================
precio.addEventListener("input", () => {
  precioIVA.value = (Number(precio.value) * 1.01).toFixed(2);
});

// =====================
// AGREGAR / EDITAR PRODUCTO
// =====================
document.getElementById("btnAgregar").onclick = async () => {
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
};

// =====================
// LISTAR PRODUCTOS
// =====================
async function listarProductos() {
  const snap = await getDocs(collection(db, "productos"));
  productosContainer.innerHTML = "";
  snap.forEach(docSnap => {
    const p = docSnap.data();
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <p><strong>Código:</strong> ${p.codigo}</p>
      <p><strong>Nombre:</strong> ${p.nombre}</p>
      <p><strong>Variedad:</strong> ${p.variedad || "-"}</p>
      <p><strong>Peso:</strong> ${p.peso} g</p>
      <p><strong>Precio:</strong> ₡${p.precio}</p>
      <p><strong>Precio c/IVA:</strong> ₡${p.precioIVA}</p>
      <div class="acciones">
        <button class="btn-editar" onclick="editarProducto('${docSnap.id}')"><i class="fa fa-edit"></i></button>
        <button class="btn-eliminar" onclick="eliminarProducto('${docSnap.id}')"><i class="fa fa-trash"></i></button>
      </div>
    `;
    productosContainer.appendChild(card);
  });
}

window.editarProducto = async (id) => {
  const docSnap = await getDoc(doc(db, "productos", id));
  const p = docSnap.data();
  codigo.value = p.codigo;
  nombre.value = p.nombre;
  variedad.value = p.variedad || "";
  peso.value = p.peso;
  precio.value = p.precio;
  precioIVA.value = p.precioIVA;
  editId = id;
};

window.eliminarProducto = async (id) => {
  if(confirm("¿Eliminar este producto?")) await deleteDoc(doc(db, "productos", id));
};

// =====================
// CARGAR VENDEDORES
// =====================
async function cargarVendedores() {
  const snap = await getDocs(collection(db, "usuarios"));
  vendedorSelect.innerHTML = "<option value=''>Seleccione vendedor</option>";
  snap.forEach(docSnap => {
    const u = docSnap.data();
    vendedorSelect.innerHTML += `<option value="${docSnap.id}">${u.nombre}</option>`;
  });
}

// =====================
// AGREGAR CLIENTE
// =====================
document.getElementById("btnAgregarCliente").onclick = async () => {
  if (!clienteNombre.value || !vendedorSelect.value) {
    return alert("Complete los campos obligatorios");
  }

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
    await addDoc(collection(db, "clientes"), {
      ...data,
      fecha: Timestamp.now()
    });
  }

  clienteNombre.value = "";
  clienteTelefono.value = "";
  clienteDireccion.value = "";
  clienteUbicacion.value = "";
  vendedorSelect.value = "";

  cargarClientes();
};






// =====================
// LISTAR CLIENTES
// =====================
async function cargarClientes() {
  const snap = await getDocs(collection(db, "clientes"));
  clientesContainer.innerHTML = "";
  snap.forEach(docSnap => {
    const c = docSnap.data();
    const vendedor = c.vendedorId;
    const vendedorName = vendedorSelect.querySelector(`option[value="${vendedor}"]`)?.text || "N/A";
    const card = document.createElement("div");
    card.className = "card";
  card.innerHTML = `
  <p><strong>Nombre:</strong> ${c.nombre}</p>
  <p><strong>Teléfono:</strong> ${c.telefono || "-"}</p>
  <p><strong>Dirección:</strong> ${c.direccion || "-"}</p>
  <p><strong>Ubicación:</strong> ${c.ubicacion || "-"}</p>
  <p><strong>Vendedor:</strong> ${vendedorName}</p>

  <div class="acciones">
    <button class="btn-editar" onclick="editarCliente('${docSnap.id}')">
      <i class="fa fa-edit"></i>
    </button>
    <button class="btn-eliminar" onclick="eliminarCliente('${docSnap.id}')">
      <i class="fa fa-trash"></i>
    </button>
  </div>
`;


    clientesContainer.appendChild(card);
  });
}

// =====================
// EDITAR CLIENTES
// =====================

window.editarCliente = async (id) => {
  const docSnap = await getDoc(doc(db, "clientes", id));
  if (!docSnap.exists()) return;

  const c = docSnap.data();

  clienteNombre.value = c.nombre || "";
  clienteTelefono.value = c.telefono || "";
  clienteDireccion.value = c.direccion || "";
  clienteUbicacion.value = c.ubicacion || "";
  vendedorSelect.value = c.vendedorId || "";

  editClienteId = id;

  window.scrollTo({ top: 0, behavior: "smooth" });
};



// =====================
// ELIMINAR CLIENTES
// =====================

window.eliminarCliente = async (id) => {
  if (!confirm("¿Eliminar este cliente?")) return;
  await deleteDoc(doc(db, "clientes", id));
  cargarClientes();
};

// =====================
// Graficos
// =====================
async function cargarGraficaMensual() {
  const snap = await getDocs(collection(db, "ventas"));

  const meses = [
    "Enero","Febrero","Marzo","Abril","Mayo","Junio",
    "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"
  ];

  let ventasPorMes = Array(12).fill(0);
  let kgPorMes = Array(12).fill(0);
  let pedidosPorMes = Array(12).fill(0);

  snap.forEach(docSnap => {
    const v = docSnap.data();
    if (!v.fecha) return;

    const fecha = v.fecha.toDate ? v.fecha.toDate() : new Date(v.fecha);
    const mes = fecha.getMonth(); // 0–11

    pedidosPorMes[mes]++;

    // Dinero
    ventasPorMes[mes] += Number(v.total || 0);

    // Kilogramos
    if (Array.isArray(v.lineas)) {
      v.lineas.forEach(l => {
        const peso = Number(l.peso || 0); // gramos
        const cantidad = Number(l.cantidad || 0);
        kgPorMes[mes] += (peso * cantidad) / 1000;
      });
    }
  });

  renderGraficaMensual(meses, ventasPorMes, kgPorMes, pedidosPorMes);
}


function renderGraficaMensual(meses, ventas, kilos, pedidos) {
  const ctx = document.getElementById("graficaVentasMensuales").getContext("2d");

  new Chart(ctx, {
    type: "bar",
    data: {
      labels: meses,
      datasets: [
        {
          label: "₡ Ventas",
          data: ventas,
          backgroundColor: "rgba(75,192,192,0.6)"
        },
        {
          label: "Kg vendidos",
          data: kilos,
          backgroundColor: "rgba(255,159,64,0.6)"
        },
        {
          label: "Pedidos",
          data: pedidos,
          backgroundColor: "rgba(153,102,255,0.6)"
        }
      ]
    },
    options: {
      responsive: true,
      scales: {
        y: { beginAtZero: true }
      }
    }
  });
}


// =====================
// DASHBOARD
// =====================
async function cargarDashboard() {
  const snap = await getDocs(collection(db, "ventas"));

  let totalVentas = 0;
  let totalKg = 0;
  let pedidosMes = 0;

  let estados = {
    entrante: 0,
    "en proceso": 0,
    listo: 0,
    atrasado: 0
  };

  const hoy = new Date();
  const mesActual = hoy.getMonth();
  const anioActual = hoy.getFullYear();

  snap.forEach(docSnap => {
    const v = docSnap.data();
    const fecha = v.fecha.toDate ? v.fecha.toDate() : new Date(v.fecha);

    totalVentas += Number(v.total || 0);

    if (fecha.getMonth() === mesActual && fecha.getFullYear() === anioActual) {
      pedidosMes++;
    }

    estados[v.estado] = (estados[v.estado] || 0) + 1;

    if (Array.isArray(v.lineas)) {
      v.lineas.forEach(l => {
        totalKg += (Number(l.peso || 0) * Number(l.cantidad || 0)) / 1000;
      });
    }
  });

  // KPIs
  document.getElementById("kpiVentas").textContent = `₡${totalVentas.toLocaleString()}`;
  document.getElementById("kpiKg").textContent = `${totalKg.toFixed(2)} kg`;
  document.getElementById("kpiPedidos").textContent = pedidosMes;
  document.getElementById("kpiEntrantes").textContent = estados.entrante || 0;

  // Producción
  document.getElementById("estadoProduccion").innerHTML = `
    <div class="estado-box entrante">Entrantes<br>${estados.entrante}</div>
    <div class="estado-box proceso">En Proceso<br>${estados["en proceso"]}</div>
    <div class="estado-box listo">Listos<br>${estados.listo}</div>
    <div class="estado-box atrasado">Atrasados<br>${estados.atrasado}</div>
  `;
}




// =====================
// ESTADÍSTICAS POR RANGO DE FECHAS
// =====================
document.getElementById("btnFiltrarEstadisticas").onclick = async () => {
  const inicio = fechaInicioInput.value;
  const fin = fechaFinInput.value;

  if (!inicio || !fin) {
    alert("Seleccione ambas fechas");
    return;
  }

  const q = query(
    collection(db, "ventas"),
    where("fecha", ">=", Timestamp.fromDate(new Date(inicio))),
    where(
      "fecha",
      "<=",
      Timestamp.fromDate(new Date(new Date(fin).setHours(23, 59, 59)))
    )
  );

  const snap = await getDocs(q);

  let totalPedidos = snap.size;
  let totalKg = 0;
  let totalDinero = 0;

  snap.forEach(docSnap => {
    const v = docSnap.data();

    // ✔️ Seguridad: validar lineas
    if (Array.isArray(v.lineas)) {
  v.lineas.forEach(l => {
  const cantidad = Number(l.cantidad);

  // peso viene en gramos
  const pesoGramos = Number(l.peso || 0);

  if (!isNaN(cantidad) && pesoGramos > 0) {
    totalKg += (pesoGramos * cantidad) / 1000;
  }
});


    }

    const totalVenta = Number(v.total);
    if (!isNaN(totalVenta)) {
      totalDinero += totalVenta;
    }
  });

  estadisticasContainer.innerHTML = `
    <p><strong>Total pedidos:</strong> ${totalPedidos}</p>
    <p><strong>Total Kilogramos de café vendidos:</strong> ${totalKg.toFixed(2)} kg</p>
    <p><strong>Total en dinero:</strong> ₡${totalDinero.toLocaleString()}</p>
  `;
};











