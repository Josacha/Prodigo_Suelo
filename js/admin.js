/********************************
 * FIREBASE
 ********************************/
import { db } from "./firebase.js";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/********************************
 * VARIABLES EDICIÓN
 ********************************/
let editIdProducto = null;
let editIdCliente = null;

/********************************
 * FORMULARIOS PRODUCTOS
 ********************************/
const prodNombre = document.getElementById("prodNombre");
const prodVariedad = document.getElementById("prodVariedad");
const prodPeso = document.getElementById("prodPeso");
const prodPrecio = document.getElementById("prodPrecio");
const btnGuardarProducto = document.getElementById("btnGuardarProducto");

/********************************
 * FORMULARIOS CLIENTES
 ********************************/
const cliNombre = document.getElementById("cliNombre");
const cliTelefono = document.getElementById("cliTelefono");
const cliDireccion = document.getElementById("cliDireccion");
const cliLat = document.getElementById("cliLat");
const cliLng = document.getElementById("cliLng");
const btnGuardarCliente = document.getElementById("btnGuardarCliente");

/********************************
 * TABLAS
 ********************************/
const productosBody = document.getElementById("productosContainer");
const clientesBody = document.getElementById("clientesContainer");

/********************************
 * GUARDAR / ACTUALIZAR PRODUCTO
 ********************************/
btnGuardarProducto.addEventListener("click", async () => {
  const data = {
    nombre: prodNombre.value,
    variedad: prodVariedad.value,
    peso: Number(prodPeso.value),
    precio: Number(prodPrecio.value)
  };

  if (!data.nombre || !data.precio) {
    alert("Complete los datos");
    return;
  }

  if (editIdProducto) {
    await updateDoc(doc(db, "productos", editIdProducto), data);
    editIdProducto = null;
    btnGuardarProducto.textContent = "Guardar Producto";
  } else {
    await addDoc(collection(db, "productos"), data);
  }

  limpiarProducto();
  cargarProductos();
});

/********************************
 * GUARDAR / ACTUALIZAR CLIENTE
 ********************************/
btnGuardarCliente.addEventListener("click", async () => {
  const data = {
    nombre: cliNombre.value,
    telefono: cliTelefono.value,
    direccion: cliDireccion.value,
    lat: cliLat.value ? Number(cliLat.value) : null,
    lng: cliLng.value ? Number(cliLng.value) : null
  };

  if (!data.nombre) {
    alert("Nombre requerido");
    return;
  }

  if (editIdCliente) {
    await updateDoc(doc(db, "clientes", editIdCliente), data);
    editIdCliente = null;
    btnGuardarCliente.textContent = "Guardar Cliente";
  } else {
    await addDoc(collection(db, "clientes"), data);
  }

  limpiarCliente();
  cargarClientes();
});

/********************************
 * CARGAR PRODUCTOS
 ********************************/
async function cargarProductos() {
  productosBody.innerHTML = "";
  const snap = await getDocs(collection(db, "productos"));

  snap.forEach(d => {
    const p = d.data();
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${p.nombre}</td>
      <td>${p.variedad}</td>
      <td>${p.peso} g</td>
      <td>₡${p.precio}</td>
      <td>
        <button onclick="editarProducto('${d.id}', ${JSON.stringify(p).replace(/"/g, '&quot;')})">✏️</button>
        <button onclick="eliminarProducto('${d.id}')">🗑️</button>
      </td>
    `;
    productosBody.appendChild(tr);
  });
}

/********************************
 * CARGAR CLIENTES
 ********************************/
async function cargarClientes() {
  clientesBody.innerHTML = "";
  const snap = await getDocs(collection(db, "clientes"));

  snap.forEach(d => {
    const c = d.data();
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${c.nombre}</td>
      <td>${c.telefono || "-"}</td>
      <td>${c.direccion || "-"}</td>
      <td>
        ${c.lat && c.lng ? `<button onclick="abrirMapa(${c.lat},${c.lng})">📍</button>` : "-"}
      </td>
      <td>
        <button onclick="editarCliente('${d.id}', ${JSON.stringify(c).replace(/"/g, '&quot;')})">✏️</button>
        <button onclick="eliminarCliente('${d.id}')">🗑️</button>
      </td>
    `;
    clientesBody.appendChild(tr);
  });
}

/********************************
 * EDITAR PRODUCTO (CARGA FORM)
 ********************************/
window.editarProducto = (id, p) => {
  editIdProducto = id;
  prodNombre.value = p.nombre;
  prodVariedad.value = p.variedad;
  prodPeso.value = p.peso;
  prodPrecio.value = p.precio;
  btnGuardarProducto.textContent = "Actualizar Producto";
};

/********************************
 * EDITAR CLIENTE (CARGA FORM)
 ********************************/
window.editarCliente = (id, c) => {
  editIdCliente = id;
  cliNombre.value = c.nombre;
  cliTelefono.value = c.telefono || "";
  cliDireccion.value = c.direccion || "";
  cliLat.value = c.lat || "";
  cliLng.value = c.lng || "";
  btnGuardarCliente.textContent = "Actualizar Cliente";
};

/********************************
 * ELIMINAR
 ********************************/
window.eliminarProducto = async id => {
  if (confirm("¿Eliminar producto?")) {
    await deleteDoc(doc(db, "productos", id));
    cargarProductos();
  }
};

window.eliminarCliente = async id => {
  if (confirm("¿Eliminar cliente?")) {
    await deleteDoc(doc(db, "clientes", id));
    cargarClientes();
  }
};

/********************************
 * MAPA
 ********************************/
window.abrirMapa = (lat, lng) => {
  window.open(`https://www.google.com/maps?q=${lat},${lng}`, "_blank");
};

/********************************
 * LIMPIAR FORMULARIOS
 ********************************/
function limpiarProducto() {
  prodNombre.value = "";
  prodVariedad.value = "";
  prodPeso.value = "";
  prodPrecio.value = "";
}

function limpiarCliente() {
  cliNombre.value = "";
  cliTelefono.value = "";
  cliDireccion.value = "";
  cliLat.value = "";
  cliLng.value = "";
}

/********************************
 * INIT
 ********************************/
document.addEventListener("DOMContentLoaded", () => {
  cargarProductos();
  cargarClientes();
});
