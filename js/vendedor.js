import { auth, db } from "./firebase.js";
import {
  collection, getDocs, addDoc, doc, getDoc, updateDoc, onSnapshot, deleteDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// =====================
// VARIABLES
// =====================
let carrito = [];
let pedidoClienteId = null;
let pedidoVendedorId = null;

// ELEMENTOS HTML
const productoSelect = document.getElementById("productoSelect");
const cantidadInput = document.getElementById("cantidadInput");
const carritoBody = document.getElementById("carritoBody");
const totalPedido = document.getElementById("totalPedido");
const clienteSelect = document.getElementById("clienteSelect");
const vendedorSelect = document.getElementById("vendedorSelect");
const pedidosContainer = document.getElementById("pedidosContainer");

const clienteNombre = document.getElementById("clienteNombre");
const clienteTelefono = document.getElementById("clienteTelefono");
const btnAgregarCliente = document.getElementById("btnAgregarCliente");

// =====================
// PROTECCIÓN DE RUTA
// =====================
onAuthStateChanged(auth, async user => {
  if(!user) location.href = "index.html";
  await cargarVendedores();
  await cargarClientes();
  await cargarProductos();
  cargarPedidos();
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
  productoSelect.innerHTML = "<option value=''>Seleccione producto</option>";
  const snap = await getDocs(collection(db, "productos"));
  snap.forEach(d => {
    const p = d.data();
    if(p.activo){
      const opt = document.createElement("option");
      opt.value = d.id;
      opt.textContent = `${p.nombre} - ₡${p.precio} (Stock: ${p.stock})`;
      opt.dataset.precio = p.precio;
      opt.dataset.stock = p.stock;
      opt.dataset.nombre = p.nombre;
      opt.dataset.peso = p.peso || 0;
      productoSelect.appendChild(opt);
    }
  });
}

// =====================
// CARGAR CLIENTES SIN REPETIDOS
// =====================
async function cargarClientes() {
  clienteSelect.innerHTML = "<option value=''>Seleccione cliente</option>";
  const snap = await getDocs(collection(db, "clientes"));

  const idsAgregados = new Set();

  snap.forEach(docSnap => {
    const c = docSnap.data();
    // Solo clientes del vendedor logueado
    if(!idsAgregados.has(docSnap.id)){
      const opt = document.createElement("option");
      opt.value = docSnap.id;
      opt.textContent = `${c.nombre} (${c.telefono || "-"})`;
      clienteSelect.appendChild(opt);
      idsAgregados.add(docSnap.id);
    }
  });
}

// =====================
// CARGAR VENDEDORES
// =====================
async function cargarVendedores() {
  vendedorSelect.innerHTML = "<option value=''>Seleccione vendedor</option>";
  const snap = await getDocs(collection(db, "usuarios"));
  snap.forEach(docSnap => {
    const u = docSnap.data();
    vendedorSelect.innerHTML += `<option value="${docSnap.id}">${u.nombre}</option>`;
  });
}

// =====================
// AGREGAR CLIENTE
// =====================
btnAgregarCliente.onclick = async () => {
  if(!clienteNombre.value || !vendedorSelect.value) return alert("Complete los campos");

  await addDoc(collection(db, "clientes"), {
    nombre: clienteNombre.value,
    telefono: clienteTelefono.value || null,
    vendedorId: vendedorSelect.value
  });

  clienteNombre.value = "";
  clienteTelefono.value = "";
  vendedorSelect.value = "";

  cargarClientes();
};

// =====================
// AGREGAR PRODUCTO AL CARRITO
// =====================
document.getElementById("agregarLineaBtn").onclick = () => {
  const clienteId = clienteSelect.value;
  const vendedorId = vendedorSelect.value;

  if(!clienteId || !vendedorId) return alert("Seleccione cliente y vendedor antes de agregar productos");

  // Bloquear cliente y vendedor si ya hay al menos un producto
  if(carrito.length === 0){
    pedidoClienteId = clienteId;
    pedidoVendedorId = vendedorId;
    clienteSelect.disabled = true;
    vendedorSelect.disabled = true;
  }

  const opt = productoSelect.selectedOptions[0];
  const cantidad = Number(cantidadInput.value);
  if(!opt || cantidad <= 0 || cantidad > Number(opt.dataset.stock)) 
    return alert("Cantidad inválida o stock insuficiente");

  const subtotal = cantidad * Number(opt.dataset.precio);

  carrito.push({
    productoId: opt.value,
    nombre: opt.dataset.nombre,
    precio: Number(opt.dataset.precio),
    cantidad,
    peso: Number(opt.dataset.peso),
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
  carrito.forEach((l,i) => {
    total += l.subtotal;
    carritoBody.innerHTML += `
      <tr>
        <td>${l.nombre}</td>
        <td>${l.cantidad}</td>
        <td>₡${l.subtotal}</td>
        <td>
          <button class="btn-eliminar" onclick="eliminarLinea(${i})">
            <i class="fa fa-trash"></i>
          </button>
        </td>
      </tr>
    `;
  });
  totalPedido.textContent = total;
}

window.eliminarLinea = (i) => {
  carrito.splice(i,1);
  renderCarrito();
  // Si se eliminan todos los productos desbloquea cliente y vendedor
  if(carrito.length === 0){
    clienteSelect.disabled = false;
    vendedorSelect.disabled = false;
    pedidoClienteId = null;
    pedidoVendedorId = null;
  }
};

// =====================
// CONFIRMAR PEDIDO
// =====================
document.getElementById("confirmarVentaBtn").onclick = async () => {
  if(!pedidoClienteId || !pedidoVendedorId) return alert("No hay cliente o vendedor seleccionado");
  if(carrito.length === 0) return alert("Carrito vacío");

  const clienteDoc = await getDoc(doc(db,"clientes",pedidoClienteId));
  const clienteData = clienteDoc.data();

  const total = carrito.reduce((s,l) => s + l.subtotal, 0);

  await addDoc(collection(db,"ventas"),{
    vendedorId: pedidoVendedorId,
    cliente: {id:pedidoClienteId, nombre:clienteData.nombre, telefono:clienteData.telefono || null},
    fecha: new Date(),
    total,
    lineas: carrito
  });

  // Actualizar stock
  for(const l of carrito){
    const ref = doc(db,"productos",l.productoId);
    const snap = await getDoc(ref);
    await updateDoc(ref,{stock: snap.data().stock - l.cantidad});
  }

  // Limpiar carrito y desbloquear cliente y vendedor
  carrito = [];
  renderCarrito();
  clienteSelect.disabled = false;
  vendedorSelect.disabled = false;
  clienteSelect.value = "";
  vendedorSelect.value = "";
  pedidoClienteId = null;
  pedidoVendedorId = null;

  alert("Pedido registrado");
  cargarPedidos();
};

// =====================
// CARGAR PEDIDOS
// =====================
function cargarPedidos() {
  pedidosContainer.innerHTML = "";
  onSnapshot(collection(db,"ventas"), snap => {
    pedidosContainer.innerHTML = "";
    snap.forEach(docSnap => {
      const venta = docSnap.data();
      if(venta.vendedorId !== auth.currentUser.uid) return;

      const card = document.createElement("div");
      card.className = "card";

      const lineasHTML = venta.lineas.map(l => `<li>${l.nombre} x ${l.cantidad} = ₡${l.subtotal}</li>`).join("");

      card.innerHTML = `
        <p><strong>Cliente:</strong> ${venta.cliente.nombre}</p>
        <p><strong>Teléfono:</strong> ${venta.cliente.telefono || "-"}</p>
        <p><strong>Total:</strong> ₡${venta.total}</p>
        <ul>${lineasHTML}</ul>
        <button class="btn-eliminar" onclick="eliminarPedido('${docSnap.id}')">
          <i class="fa fa-trash"></i> Eliminar pedido
        </button>
      `;

      pedidosContainer.appendChild(card);
    });
  });
}

// =====================
// ELIMINAR PEDIDO
// =====================
window.eliminarPedido = async (id) => {
  if(confirm("Eliminar pedido?")){
    await deleteDoc(doc(db,"ventas",id));
  }
};
