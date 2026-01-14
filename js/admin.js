import { auth, db } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// 🔒 PROTECCIÓN
onAuthStateChanged(auth, (user) => {
  if (!user) location.href = "index.html";
  cargarVendedores();
  cargarClientes();
  cargarEstadisticasDefault();
});

// 🚪 LOGOUT
document.getElementById("btnLogout").addEventListener("click", async () => {
  await signOut(auth);
  location.href = "index.html";
});

// =======================
// PRODUCTOS
// =======================
const codigo = document.getElementById("codigo");
const nombre = document.getElementById("nombre");
const variedad = document.getElementById("variedad");
const peso = document.getElementById("peso");
const precio = document.getElementById("precio");
const precioIVA = document.getElementById("precioIVA");
const productosContainer = document.getElementById("productosContainer");

let editId = null;

// Calcular IVA
precio.addEventListener("input", () => {
  precioIVA.value = (Number(precio.value) * 1.01).toFixed(2);
});

// Agregar / Editar producto
document.getElementById("btnAgregar").addEventListener("click", async () => {
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
});

// Listar productos
onSnapshot(collection(db, "productos"), (snap) => {
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
});

window.editarProducto = async (id) => {
  const pDoc = await getDocs(collection(db, "productos"));
  const pSnap = doc(db, "productos", id);
  const p = (await pSnap.get()).data();

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

// =======================
// CLIENTES
// =======================
const clienteNombre = document.getElementById("clienteNombre");
const clienteTelefono = document.getElementById("clienteTelefono");
const vendedorSelect = document.getElementById("vendedorSelect");
const clientesContainer = document.getElementById("clientesContainer");

document.getElementById("btnAgregarCliente").addEventListener("click", async () => {
  if (!clienteNombre.value || !vendedorSelect.value) return alert("Complete los campos");

  await addDoc(collection(db, "clientes"), {
    nombre: clienteNombre.value,
    telefono: clienteTelefono.value || null,
    vendedorId: vendedorSelect.value
  });

  clienteNombre.value = clienteTelefono.value = "";
});

async function cargarVendedores() {
  const snap = await getDocs(collection(db, "usuarios"));
  vendedorSelect.innerHTML = "<option value=''>Seleccione vendedor</option>";
  snap.forEach(docSnap => {
    const u = docSnap.data();
    vendedorSelect.innerHTML += `<option value="${docSnap.id}">${u.nombre}</option>`;
  });
}

function cargarClientes() {
  onSnapshot(collection(db, "clientes"), async (snap) => {
    clientesContainer.innerHTML = "";
    snap.forEach(async docSnap => {
      const c = docSnap.data();
      let vendedorNombre = "N/A";

      // Obtener nombre del vendedor
      if (c.vendedorId) {
        const vSnap = await getDocs(collection(db, "usuarios"));
        vSnap.forEach(vDoc => {
          if (vDoc.id === c.vendedorId) vendedorNombre = vDoc.data().nombre;
        });
      }

      const card = document.createElement("div");
      card.className = "card";
      card.innerHTML = `
        <p><strong>Nombre:</strong> ${c.nombre}</p>
        <p><strong>Teléfono:</strong> ${c.telefono || "-"}</p>
        <p><strong>Vendedor:</strong> ${vendedorNombre}</p>
      `;
      clientesContainer.appendChild(card);
    });
  });
}

// =======================
// ESTADÍSTICAS
// =======================
const fechaInicioEl = document.getElementById("fechaInicio");
const fechaFinEl = document.getElementById("fechaFin");
const btnFiltrar = document.getElementById("btnFiltrarEstadisticas");

const totalPedidosEl = document.getElementById("totalPedidos");
const totalGramosEl = document.getElementById("totalGramos");
const totalDineroEl = document.getElementById("totalDinero");

async function cargarEstadisticas(fechaInicio = null, fechaFin = null) {
  const ventasSnap = await getDocs(collection(db, "ventas"));

  let totalPedidos = 0;
  let totalGramos = 0;
  let totalDinero = 0;

  ventasSnap.forEach(docSnap => {
    const v = docSnap.data();
    const fecha = v.fecha?.toDate ? v.fecha.toDate() : new Date();

    if ((!fechaInicio || fecha >= fechaInicio) && (!fechaFin || fecha <= fechaFin)) {
      totalPedidos += 1;

      if (v.lineas && Array.isArray(v.lineas)) {
        v.lineas.forEach(l => {
          if (l.peso) totalGramos += l.peso * l.cantidad;
        });
      }

      totalDinero += v.total || 0;
    }
  });

  totalPedidosEl.textContent = totalPedidos;
  totalGramosEl.textContent = totalGramos.toFixed(0);
  totalDineroEl.textContent = totalDinero.toFixed(2);
}

btnFiltrar.addEventListener("click", () => {
  const inicio = fechaInicioEl.value ? new Date(fechaInicioEl.value) : null;
  const fin = fechaFinEl.value ? new Date(fechaFinEl.value) : null;
  if (fin) fin.setHours(23, 59, 59, 999);
  cargarEstadisticas(inicio, fin);
});

function cargarEstadisticasDefault() {
  const hoy = new Date();
  const hace7Dias = new Date();
  hace7Dias.setDate(hoy.getDate() - 7);
  fechaInicioEl.valueAsDate = hace7Dias;
  fechaFinEl.valueAsDate = hoy;
  cargarEstadisticas(hace7Dias, hoy);
}

// Actualizar estadísticas en tiempo real
onSnapshot(collection(db, "ventas"), () => {
  const inicio = fechaInicioEl.value ? new Date(fechaInicioEl.value) : null;
  const fin = fechaFinEl.value ? new Date(fechaFinEl.value) : null;
  if (fin) fin.setHours(23, 59, 59, 999);
  cargarEstadisticas(inicio, fin);
});
