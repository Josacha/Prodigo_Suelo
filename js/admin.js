import { auth, db } from "./firebase.js";
import { 
  onAuthStateChanged, signOut 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  collection, addDoc, onSnapshot, doc, updateDoc, getDocs
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// 🔒 PROTECCIÓN
onAuthStateChanged(auth, (user) => {
  if (!user) location.href = "index.html";
  cargarVendedores();
  cargarClientes();
});

// 🚪 LOGOUT
document.getElementById("btnLogout").addEventListener("click", async () => {
  await signOut(auth);
  location.href = "index.html";
});

// ELEMENTOS PRODUCTO
const codigo = document.getElementById("codigo");
const nombre = document.getElementById("nombre");
const variedad = document.getElementById("variedad");
const peso = document.getElementById("peso");
const precio = document.getElementById("precio");
const precioIVA = document.getElementById("precioIVA");
const tablaProductos = document.getElementById("tablaProductos");

let editId = null; // Para editar producto

// ===================== CALCULAR IVA =====================
precio.addEventListener("input", () => {
  const base = Number(precio.value) || 0;
  precioIVA.value = (base * 1.01).toFixed(2); // IVA 1%
});

// ===================== AGREGAR / EDITAR PRODUCTO =====================
document.getElementById("btnAgregar").addEventListener("click", async () => {
  if (!codigo.value || !nombre.value || !precio.value || !peso.value) {
    return alert("Complete todos los campos obligatorios");
  }

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
    // EDITAR
    await updateDoc(doc(db, "productos", editId), data);
    editId = null;
  } else {
    // AGREGAR
    await addDoc(collection(db, "productos"), data);
  }

  // LIMPIAR FORM
  codigo.value = nombre.value = variedad.value = peso.value = precio.value = precioIVA.value = "";
});

// ===================== LISTAR PRODUCTOS =====================
onSnapshot(collection(db, "productos"), (snap) => {
  tablaProductos.innerHTML = "";
  snap.forEach(docSnap => {
    const p = docSnap.data();
    tablaProductos.innerHTML += `
      <tr>
        <td>${p.codigo}</td>
        <td>${p.nombre}</td>
        <td>${p.variedad || ""}</td>
        <td>${p.peso}</td>
        <td>₡${p.precio}</td>
        <td>₡${p.precioIVA}</td>
        <td>
          <button class="btn-eliminar" onclick="editarProducto('${docSnap.id}')">
            <i class="fa fa-edit"></i>
          </button>
        </td>
      </tr>
    `;
  });
});

// ===================== EDITAR PRODUCTO =====================
window.editarProducto = async (id) => {
  const docSnap = await getDocs(doc(db, "productos", id));
  const p = (await doc(db, "productos", id).get()).data(); // obtener datos

  codigo.value = p.codigo;
  nombre.value = p.nombre;
  variedad.value = p.variedad || "";
  peso.value = p.peso;
  precio.value = p.precio;
  precioIVA.value = p.precioIVA;

  editId = id;
};

// ===================== AGREGAR CLIENTES =====================
const clienteNombre = document.getElementById("clienteNombre");
const clienteTelefono = document.getElementById("clienteTelefono");
const vendedorSelect = document.getElementById("vendedorSelect");
const tablaClientes = document.getElementById("tablaClientes");

document.getElementById("btnAgregarCliente").addEventListener("click", async () => {
  if (!clienteNombre.value || !vendedorSelect.value) return alert("Complete los campos");

  await addDoc(collection(db, "clientes"), {
    nombre: clienteNombre.value,
    telefono: clienteTelefono.value || null,
    vendedorId: vendedorSelect.value
  });

  clienteNombre.value = clienteTelefono.value = "";
});

// ===================== CARGAR VENDEDORES =====================
async function cargarVendedores() {
  const snap = await getDocs(collection(db, "usuarios"));
  vendedorSelect.innerHTML = "<option value=''>Seleccione vendedor</option>";
  snap.forEach(docSnap => {
    const u = docSnap.data();
    vendedorSelect.innerHTML += `<option value="${docSnap.id}">${u.nombre}</option>`;
  });
}

// ===================== CARGAR CLIENTES =====================
function cargarClientes() {
  onSnapshot(collection(db, "clientes"), async (snap) => {
    tablaClientes.innerHTML = "";
    snap.forEach(async docSnap => {
      const c = docSnap.data();
      const vendedorDoc = await getDocs(doc(db, "usuarios", c.vendedorId));
      tablaClientes.innerHTML += `
        <tr>
          <td>${c.nombre}</td>
          <td>${c.telefono || ""}</td>
          <td>${vendedorSelect.options[vendedorSelect.selectedIndex]?.text || ""}</td>
        </tr>
      `;
    });
  });
}
