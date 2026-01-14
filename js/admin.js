import { auth, db } from "./firebase.js";
import { 
  onAuthStateChanged, 
  signOut 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import { 
  collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc, getDocs 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// 🔒 PROTECCIÓN
onAuthStateChanged(auth, async (user) => {
  if (!user) location.href = "index.html";
  await cargarVendedores();
  cargarClientes();
});

// 🚪 LOGOUT
document.getElementById("btnLogout").addEventListener("click", async () => {
  await signOut(auth);
  location.href = "index.html";
});

// ==========================
// PRODUCTOS
// ==========================
const codigo = document.getElementById("codigo");
const nombre = document.getElementById("nombre");
const variedad = document.getElementById("variedad");
const peso = document.getElementById("peso");
const precio = document.getElementById("precio");
const precioIVA = document.getElementById("precioIVA");
const productosContainer = document.getElementById("productosContainer");

let editId = null;

// CALCULAR IVA 1%
precio.addEventListener("input", () => {
  precioIVA.value = (Number(precio.value) * 1.01).toFixed(2);
});

// AGREGAR / EDITAR PRODUCTO
document.getElementById("btnAgregar").addEventListener("click", async () => {
  if (!codigo.value || !nombre.value || !peso.value || !precio.value) 
    return alert("Complete todos los campos");

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

  // Limpiar inputs
  codigo.value = nombre.value = variedad.value = peso.value = precio.value = precioIVA.value = "";
});

// LISTAR PRODUCTOS
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

// FUNCIONES PRODUCTOS
window.editarProducto = async (id) => {
  const docSnap = await getDocs(doc(db, "productos", id));
  const p = (await doc(db, "productos", id).get()).data();

  codigo.value = p.codigo;
  nombre.value = p.nombre;
  variedad.value = p.variedad || "";
  peso.value = p.peso;
  precio.value = p.precio;
  precioIVA.value = p.precioIVA;

  editId = id;
};

window.eliminarProducto = async (id) => {
  if(confirm("¿Eliminar este producto?")) 
    await deleteDoc(doc(db, "productos", id));
};

// ==========================
// CLIENTES
// ==========================
const clienteNombre = document.getElementById("clienteNombre");
const clienteTelefono = document.getElementById("clienteTelefono");
const vendedorSelect = document.getElementById("vendedorSelect");
const clientesContainer = document.getElementById("clientesContainer");

let editClienteId = null;

// AGREGAR / EDITAR CLIENTE
document.getElementById("btnAgregarCliente").addEventListener("click", async () => {
  if (!clienteNombre.value || !vendedorSelect.value) return alert("Complete los campos");

  const data = {
    nombre: clienteNombre.value,
    telefono: clienteTelefono.value || null,
    vendedorId: vendedorSelect.value
  };

  if (editClienteId) {
    await updateDoc(doc(db, "clientes", editClienteId), data);
    editClienteId = null;
  } else {
    await addDoc(collection(db, "clientes"), data);
  }

  clienteNombre.value = clienteTelefono.value = "";
});

// CARGAR VENDEDORES EN SELECT
async function cargarVendedores() {
  const snap = await getDocs(collection(db, "usuarios"));
  vendedorSelect.innerHTML = "<option value=''>Seleccione vendedor</option>";
  snap.forEach(docSnap => {
    const u = docSnap.data();
    vendedorSelect.innerHTML += `<option value="${docSnap.id}">${u.nombre}</option>`;
  });
}

// LISTAR CLIENTES
function cargarClientes() {
  onSnapshot(collection(db, "clientes"), async (clientesSnap) => {
    clientesContainer.innerHTML = "";

    // Obtener todos los vendedores para mostrar nombre correcto
    const vendedoresSnap = await getDocs(collection(db, "usuarios"));
    const vendedoresMap = {};
    vendedoresSnap.forEach(vSnap => {
      const v = vSnap.data();
      vendedoresMap[vSnap.id] = v.nombre;
    });

    clientesSnap.forEach(docSnap => {
      const c = docSnap.data();
      const card = document.createElement("div");
      card.className = "card";
      card.innerHTML = `
        <p><strong>Nombre:</strong> ${c.nombre}</p>
        <p><strong>Teléfono:</strong> ${c.telefono || "-"}</p>
        <p><strong>Vendedor:</strong> ${vendedoresMap[c.vendedorId] || "Sin vendedor"}</p>
        <div class="acciones">
          <button class="btn-editar" onclick="editarCliente('${docSnap.id}')"><i class="fa fa-edit"></i></button>
          <button class="btn-eliminar" onclick="eliminarCliente('${docSnap.id}')"><i class="fa fa-trash"></i></button>
        </div>
      `;
      clientesContainer.appendChild(card);
    });
  });
}

// FUNCIONES CLIENTES
window.editarCliente = async (id) => {
  const cSnap = await getDocs(doc(db, "clientes", id));
  const c = (await doc(db, "clientes", id).get()).data();

  clienteNombre.value = c.nombre;
  clienteTelefono.value = c.telefono || "";
  vendedorSelect.value = c.vendedorId;

  editClienteId = id;
};

window.eliminarCliente = async (id) => {
  if(confirm("¿Eliminar este cliente?"))
    await deleteDoc(doc(db, "clientes", id));
};
