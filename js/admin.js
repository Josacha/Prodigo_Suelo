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

// =====================
// PROTECCIÓN
// =====================
onAuthStateChanged(auth, async (user) => {
  if (!user) location.href = "index.html";
  await cargarVendedores();
  cargarClientes();
  listarProductos();
});

// =====================
// LOGOUT
// =====================
document.getElementById("btnLogout").onclick = async () => {
  await signOut(auth);
  location.href = "index.html";
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
  if (!clienteNombre.value || !vendedorSelect.value) return alert("Complete los campos");

  await addDoc(collection(db, "clientes"), {
    nombre: clienteNombre.value,
    telefono: clienteTelefono.value || null,
    vendedorId: vendedorSelect.value
  });

  clienteNombre.value = clienteTelefono.value = "";
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
      <p><strong>Vendedor:</strong> ${vendedorName}</p>
    `;
    clientesContainer.appendChild(card);
  });
}

// =====================
// ESTADÍSTICAS POR RANGO DE FECHAS
// =====================
document.getElementById("btnFiltrarEstadisticas").onclick = async () => {
  const inicio = fechaInicioInput.value;
  const fin = fechaFinInput.value;
  if (!inicio || !fin) return alert("Seleccione ambas fechas");

  const q = query(
    collection(db, "ventas"),
    where("fecha", ">=", Timestamp.fromDate(new Date(inicio))),
    where("fecha", "<=", Timestamp.fromDate(new Date(new Date(fin).setHours(23,59,59))))
  );

  const snap = await getDocs(q);

  let totalPedidos = snap.size;
  let totalGramos = 0;
  let totalDinero = 0;

  snap.forEach(docSnap => {
    const v = docSnap.data();
    v.lineas.forEach(l => {
      totalGramos += l.peso * l.cantidad;
    });
    totalDinero += v.total;
  });

  estadisticasContainer.innerHTML = `
    <p><strong>Total pedidos:</strong> ${totalPedidos}</p>
    <p><strong>Total gramos de café vendidos:</strong> ${totalGramos}</p>
    <p><strong>Total en dinero:</strong> ₡${totalDinero}</p>
  `;
};
