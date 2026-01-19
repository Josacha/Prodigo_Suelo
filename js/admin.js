/******************************
 * IMPORTS FIREBASE
 ******************************/
import { db } from "./firebase.js";
import {
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  getDoc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/******************************
 * ELEMENTOS DOM
 ******************************/
const clientesContainer = document.getElementById("clientesContainer");
const buscarCliente = document.getElementById("buscarCliente");

/******************************
 * CARGAR CLIENTES
 ******************************/
async function cargarClientes() {
  if (!clientesContainer) return;

  clientesContainer.innerHTML = "";

  const snap = await getDocs(collection(db, "clientes"));

  snap.forEach(docSnap => {
    const c = docSnap.data();

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${c.nombre || "-"}</td>
      <td>${c.telefono || "-"}</td>
      <td>${c.direccion || "-"}</td>
      <td>
        ${
          c.lat && c.lng
            ? `<button onclick="abrirMapa(${c.lat}, ${c.lng})">📍</button>`
            : "-"
        }
      </td>
      <td>${c.vendedor || "-"}</td>
      <td>
        <button onclick="editarCliente('${docSnap.id}')">✏️</button>
        <button onclick="eliminarCliente('${docSnap.id}')">🗑️</button>
      </td>
    `;
    clientesContainer.appendChild(tr);
  });

  activarBuscadorClientes();
}

/******************************
 * BUSCADOR EN TIEMPO REAL
 ******************************/
function activarBuscadorClientes() {
  if (!buscarCliente) return;

  buscarCliente.addEventListener("input", () => {
    const filtro = buscarCliente.value.toLowerCase();

    document.querySelectorAll("#clientesContainer tr").forEach(tr => {
      tr.style.display = tr.innerText.toLowerCase().includes(filtro)
        ? ""
        : "none";
    });
  });
}

/******************************
 * ABRIR MAPS / WAZE
 ******************************/
window.abrirMapa = function (lat, lng) {
  const url = `https://www.google.com/maps?q=${lat},${lng}`;
  window.open(url, "_blank");
};

/******************************
 * EDITAR CLIENTE
 ******************************/
window.editarCliente = async function (id) {
  const ref = doc(db, "clientes", id);
  const snap = await getDoc(ref);

  if (!snap.exists()) return;

  const c = snap.data();

  const nombre = prompt("Nombre:", c.nombre);
  if (nombre === null) return;

  const telefono = prompt("Teléfono:", c.telefono || "");
  const direccion = prompt("Dirección:", c.direccion || "");

  await updateDoc(ref, {
    nombre,
    telefono,
    direccion
  });

  cargarClientes();
};

/******************************
 * ELIMINAR CLIENTE
 ******************************/
window.eliminarCliente = async function (id) {
  if (!confirm("¿Eliminar este cliente?")) return;

  await deleteDoc(doc(db, "clientes", id));
  cargarClientes();
};

/******************************
 * INIT
 ******************************/
document.addEventListener("DOMContentLoaded", () => {
  cargarClientes();
});
