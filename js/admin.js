import { auth, db } from "./firebase.js";
import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  Timestamp,
  doc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// =====================
// VARIABLES
// =====================

// Productos
const codigo = document.getElementById("codigo");
const nombre = document.getElementById("nombre");
const variedad = document.getElementById("variedad");
const peso = document.getElementById("peso");
const precio = document.getElementById("precio");
const precioIVA = document.getElementById("precioIVA");
const productosContainer = document.getElementById("productosContainer");
let editId = null;

// Clientes
const clienteNombre = document.getElementById("clienteNombre");
const clienteTelefono = document.getElementById("clienteTelefono");
const vendedorSelect = document.getElementById("vendedorSelect");
const clientesContainer = document.getElementById("clientesContainer");

// Estadísticas
const semanaSelect = document.getElementById("semanaSelect");
const totalPedidos = document.getElementById("totalPedidos");
const totalGramos = document.getElementById("totalGramos");
const totalDinero = document.getElementById("totalDinero");
const pedidosSemana = document.getElementById("pedidosSemana");

let ventasData = [];

// =====================
// PROTECCIÓN
// =====================
onAuthStateChanged(auth, async (user) => {
  if (!user) location.href = "index.html";
  await cargarVendedores();
  cargarClientes();
  cargarVentas();
});

// =====================
// LOGOUT
// =====================
document.getElementById("btnLogout").addEventListener("click", async () => {
  await signOut(auth);
  location.href = "index.html";
});

// =====================
// PRODUCTOS
// =====================

// Calcular IVA 1%
precio.addEventListener("input", () => {
  precioIVA.value = (Number(precio.value) * 1.01).toFixed(2);
});

// Agregar / Editar Producto
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

// Listar Productos
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
// CLIENTES
// =====================
document.getElementById("btnAgregarCliente").addEventListener("click", async () => {
  if (!clienteNombre.value || !vendedorSelect.value) return alert("Complete los campos");

  await addDoc(collection(db, "clientes"), {
    nombre: clienteNombre.value,
    telefono: clienteTelefono.value || null,
    vendedorId: vendedorSelect.value
  });

  clienteNombre.value = clienteTelefono.value = "";
});

// Cargar Vendedores
async function cargarVendedores() {
  const snap = await getDocs(collection(db, "usuarios"));
  vendedorSelect.innerHTML = "<option value=''>Seleccione vendedor</option>";
  snap.forEach(docSnap => {
    const u = docSnap.data();
    vendedorSelect.innerHTML += `<option value="${docSnap.id}">${u.nombre}</option>`;
  });
}

// Listar Clientes
function cargarClientes() {
  onSnapshot(collection(db, "clientes"), async (snap) => {
    clientesContainer.innerHTML = "";
    snap.forEach(docSnap => {
      const c = docSnap.data();
      const card = document.createElement("div");
      card.className = "card";
      const vendedorNombre = vendedorSelect.querySelector(`option[value="${c.vendedorId}"]`)?.textContent || "Desconocido";
      card.innerHTML = `
        <p><strong>Nombre:</strong> ${c.nombre}</p>
        <p><strong>Teléfono:</strong> ${c.telefono || "-"}</p>
        <p><strong>Vendedor:</strong> ${vendedorNombre}</p>
      `;
      clientesContainer.appendChild(card);
    });
  });
}

// =====================
// ESTADÍSTICAS SEMANALES
// =====================
async function cargarVentas() {
  const snap = await getDocs(collection(db, "ventas"));
  ventasData = [];

  snap.forEach(docSnap => {
    const v = docSnap.data();
    v.id = docSnap.id;
    v.fecha = v.fecha.toDate ? v.fecha.toDate() : new Date(v.fecha.seconds*1000);
    ventasData.push(v);
  });

  cargarSemanas();
  filtrarSemana();
}

// Obtener número de semana
function getWeekNumber(date) {
  const d = new Date(date.getTime());
  d.setHours(0,0,0,0);
  d.setDate(d.getDate() + 4 - (d.getDay()||7));
  const yearStart = new Date(d.getFullYear(),0,1);
  const weekNo = Math.ceil((((d - yearStart)/86400000)+1)/7);
  return { week: weekNo, year: d.getFullYear() };
}

// Cargar semanas al select
function cargarSemanas() {
  const semanas = {};
  ventasData.forEach(v=>{
    const w = getWeekNumber(v.fecha);
    const key = `${w.year}-W${w.week}`;
    if(!semanas[key]) semanas[key] = true;
  });

  semanaSelect.innerHTML = "";
  Object.keys(semanas).sort().reverse().forEach(key=>{
    const opt = document.createElement("option");
    opt.value = key;
    opt.textContent = key;
    semanaSelect.appendChild(opt);
  });
}

// Filtrar semana y mostrar totales
semanaSelect.addEventListener("change", filtrarSemana);

function filtrarSemana() {
  const selected = semanaSelect.value;
  if(!selected) return;

  let totalP = 0;
  let totalG = 0;
  let totalD = 0;

  pedidosSemana.innerHTML = "";

  ventasData.forEach(v=>{
    const w = getWeekNumber(v.fecha);
    const key = `${w.year}-W${w.week}`;
    if(key === selected){
      totalP += 1;
      v.lineas.forEach(l=>{
        totalG += l.peso || 0; 
      });
      totalD += v.total;

      const card = document.createElement("div");
      card.className = "card";
      const lineasHTML = v.lineas.map(l=>`<li>${l.nombre} x ${l.cantidad} = ₡${l.subtotal}</li>`).join("");
      card.innerHTML = `
        <p><strong>Cliente:</strong> ${v.cliente.nombre}</p>
        <p><strong>Fecha:</strong> ${v.fecha.toLocaleDateString()}</p>
        <ul>${lineasHTML}</ul>
        <p><strong>Total:</strong> ₡${v.total}</p>
      `;
      pedidosSemana.appendChild(card);
    }
  });

  totalPedidos.textContent = totalP;
  totalGramos.textContent = totalG;
  totalDinero.textContent = totalD;
}

// Inicializar
cargarVentas();
