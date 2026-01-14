import { auth, db } from "./firebase.js";
import {
  collection,
  getDocs,
  addDoc,
  doc,
  getDoc,
  updateDoc,
  query,
  where,
  Timestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// =====================
// VARIABLES
// =====================
let carrito = [];

const productoSelect = document.getElementById("productoSelect");
const cantidadInput = document.getElementById("cantidadInput");
const carritoBody = document.getElementById("carritoBody");
const totalPedido = document.getElementById("totalPedido");

const clienteSelect = document.getElementById("clienteSelect");

// =====================
// PROTECCIÓN
// =====================
onAuthStateChanged(auth, async user => {
  if (!user) location.href = "index.html";
  await cargarProductos();
  await cargarClientesVendedor();
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
// CARGAR CLIENTES DEL VENDEDOR
// =====================
async function cargarClientesVendedor() {
  clienteSelect.innerHTML = "<option value=''>Seleccione cliente</option>";

  const q = query(
    collection(db, "clientes"),
    where("vendedorId", "==", auth.currentUser.uid)
  );

  const snap = await getDocs(q);
  snap.forEach(docSnap => {
    const c = docSnap.data();
    const opt = document.createElement("option");
    opt.value = docSnap.id;
    opt.textContent = `${c.nombre} (${c.telefono || "-"})`;
    clienteSelect.appendChild(opt);
  });
}

// =====================
// AGREGAR PRODUCTO AL CARRITO
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
          <button class="btn-eliminar" onclick="eliminarLinea(${index})">
            <i class="fa fa-trash"></i>
          </button>
        </td>
      </tr>
    `;
  });

  totalPedido.textContent = total;
}

// =====================
// ELIMINAR LÍNEA DEL CARRITO
// =====================
window.eliminarLinea = (index) => {
  carrito.splice(index, 1);
  renderCarrito();
};

// =====================
// CONFIRMAR PEDIDO
// =====================
document.getElementById("confirmarVentaBtn").onclick = async () => {
  const clienteId = clienteSelect.value;
  if (!clienteId) return alert("Seleccione un cliente");
  if (carrito.length === 0) return alert("El carrito está vacío");

  const clienteDoc = await getDoc(doc(db, "clientes", clienteId));
  const clienteData = clienteDoc.data();

  const total = carrito.reduce((s, l) => s + l.subtotal, 0);

  // GUARDAR VENTA
  await addDoc(collection(db, "ventas"), {
    vendedorId: auth.currentUser.uid,
    cliente: {
      id: clienteId,
      nombre: clienteData.nombre,
      telefono: clienteData.telefono || null
    },
    fecha: Timestamp.now(),
    total,
    lineas: carrito
  });

  // ACTUALIZAR STOCK
  for (const l of carrito) {
    const ref = doc(db, "productos", l.productoId);
    const snap = await getDoc(ref);
    await updateDoc(ref, { stock: snap.data().stock - l.cantidad });
  }

  carrito = [];
  renderCarrito();
  clienteSelect.value = "";
  alert("Pedido registrado");
};
