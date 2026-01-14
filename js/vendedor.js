// =====================
// IMPORTS
// =====================
import { auth, db } from "./firebase.js";

import {
  collection,
  getDocs,
  addDoc,
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  Timestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// =====================
// VARIABLES
// =====================
let carrito = [];

const productoSelect = document.getElementById("productoSelect");
const cantidadInput = document.getElementById("cantidadInput");
const carritoBody = document.getElementById("carritoBody");
const totalPedido = document.getElementById("totalPedido");

const clienteNombreInput = document.getElementById("clienteNombre");
const clienteTelefonoInput = document.getElementById("clienteTelefono");

const pedidosBody = document.getElementById("pedidosBody");

// =====================
// PROTECCIÓN DE PÁGINA
// =====================
onAuthStateChanged(auth, async user => {
  if (!user) location.href = "index.html";
  await cargarProductos();
  await cargarPedidos();
});

// =====================
// LOGOUT
// =====================
document.getElementById("logoutBtn").onclick = async () => {
  await signOut(auth);
  location.href = "index.html";
};

// =====================
// CARGAR PRODUCTOS
// =====================
async function cargarProductos() {
  productoSelect.innerHTML = "";

  const q = query(collection(db, "productos"), where("activo", "==", true));
  const snap = await getDocs(q);

  snap.forEach(d => {
    const p = d.data();
    const opt = document.createElement("option");
    opt.value = d.id;
    opt.textContent = `${p.nombre} - ₡${p.precio} (Stock: ${p.stock})`;
    opt.dataset.precio = p.precio;
    opt.dataset.stock = p.stock;
    opt.dataset.nombre = p.nombre;
    productoSelect.appendChild(opt);
  });
}

// =====================
// AGREGAR LÍNEA AL CARRITO
// =====================
document.getElementById("agregarLineaBtn").onclick = () => {
  const opt = productoSelect.selectedOptions[0];
  const cantidad = Number(cantidadInput.value);

  if (!opt || cantidad <= 0) return alert("Datos inválidos");
  if (cantidad > opt.dataset.stock) return alert("Stock insuficiente");

  const subtotal = cantidad * opt.dataset.precio;

  carrito.push({
    productoId: opt.value,
    nombre: opt.dataset.nombre,
    precio: Number(opt.dataset.precio),
    cantidad,
    subtotal
  });

  cantidadInput.value = "";
  renderCarrito();
};

// =====================
// RENDER CARRITO
// =====================
function renderCarrito() {
  carritoBody.innerHTML = "";
  let total = 0;

  carrito.forEach((l, index) => {
    total += l.subtotal;
    carritoBody.innerHTML += `
      <tr>
        <td>${l.nombre}</td>
        <td>${l.cantidad}</td>
        <td>₡${l.subtotal}</td>
        <td>
          <button class="btn-eliminar" onclick="eliminarDelCarrito(${index})">
            <i class="fa fa-trash"></i>
          </button>
        </td>
      </tr>
    `;
  });

  totalPedido.textContent = total;
}

// =====================
// ELIMINAR PRODUCTO DEL CARRITO
// =====================
window.eliminarDelCarrito = (index) => {
  carrito.splice(index, 1);
  renderCarrito();
};

// =====================
// CONFIRMAR PEDIDO
// =====================
document.getElementById("confirmarVentaBtn").onclick = async () => {
  const clienteNombre = clienteNombreInput.value.trim();
  const clienteTelefono = clienteTelefonoInput.value.trim();

  if (!clienteNombre) return alert("Ingrese cliente");
  if (carrito.length === 0) return alert("Pedido vacío");

  const total = carrito.reduce((s, l) => s + l.subtotal, 0);

  // GUARDAR VENTA
  const ventaRef = await addDoc(collection(db, "ventas"), {
    vendedorId: auth.currentUser.uid,
    cliente: {
      nombre: clienteNombre,
      telefono: clienteTelefono || null
    },
    fecha: Timestamp.now(),
    total,
    lineas: carrito
  });

  // ACTUALIZAR STOCK
  for (const l of carrito) {
    const ref = doc(db, "productos", l.productoId);
    const snap = await getDoc(ref);
    await updateDoc(ref, {
      stock: snap.data().stock - l.cantidad
    });
  }

  carrito = [];
  renderCarrito();
  clienteNombreInput.value = "";
  clienteTelefonoInput.value = "";

  alert("Pedido registrado");

  // Recargar tabla de pedidos
  await cargarPedidos();
};

// =====================
// CARGAR PEDIDOS REALIZADOS
// =====================
async function cargarPedidos() {
  pedidosBody.innerHTML = "";

  const q = query(collection(db, "ventas"), where("vendedorId", "==", auth.currentUser.uid));
  const snap = await getDocs(q);

  snap.forEach(docSnap => {
    const venta = docSnap.data();
    const id = docSnap.id;
    const fecha = venta.fecha.toDate().toLocaleString();
    const lineas = venta.lineas.map(l => `${l.nombre} x${l.cantidad}`).join(", ");

    pedidosBody.innerHTML += `
      <tr>
        <td>${venta.cliente.nombre}</td>
        <td>${fecha}</td>
        <td>₡${venta.total}</td>
        <td>${lineas}</td>
        <td>
          <button class="btn-eliminar" onclick="eliminarPedido('${id}')">
            <i class="fa fa-trash"></i>
          </button>
        </td>
      </tr>
    `;
  });
}

// =====================
// ELIMINAR PEDIDO COMPLETO
// =====================
window.eliminarPedido = async (id) => {
  if (confirm("¿Desea eliminar este pedido?")) {
    await deleteDoc(doc(db, "ventas", id));
    await cargarPedidos();
  }
};
