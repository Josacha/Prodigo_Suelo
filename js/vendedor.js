import { auth, db } from "./firebase.js";
import {
  collection, getDocs, addDoc, doc, getDoc, updateDoc, deleteDoc, onSnapshot, Timestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// ================== VARIABLES ==================
let carrito = [];
let vendedorId = null;

const productoSelect = document.getElementById("productoSelect");
const cantidadInput = document.getElementById("cantidadInput");
const carritoBody = document.getElementById("carritoBody");
const totalPedido = document.getElementById("totalPedido");
const clienteSelect = document.getElementById("clienteSelect");
const pedidosContainer = document.getElementById("pedidosContainer");
const diasConsignacionInput = document.getElementById("diasConsignacion");

const filtroCliente = document.getElementById("filtroCliente");
const btnBuscarPedidos = document.getElementById("btnBuscarPedidos");
const resultadosPedidos = document.getElementById("resultadosPedidos");

// ================== AUTENTICACIÓN ==================
onAuthStateChanged(auth, async user => {
  if (!user) location.href = "index.html";
  vendedorId = user.uid;
  await cargarProductos();
  await cargarClientes();
  cargarPedidos();
  cargarClientesFiltro();
  
  // ACTIVAR BUSCADORES
  configurarBuscadorCoincidencia("buscarClienteInput", "clienteSelect");
  configurarBuscadorCoincidencia("buscarProductoInput", "productoSelect");
});

document.getElementById("logoutBtn")?.addEventListener("click", async () => {
  await signOut(auth);
  location.href = "index.html";
});

// ================== CARGAR PRODUCTOS ==================
async function cargarProductos() {
  productoSelect.innerHTML = "";
  const snap = await getDocs(collection(db, "productos"));
  snap.forEach(d => {
    const p = d.data();
    if (p.activo) {
      const opt = document.createElement("option");
      opt.value = d.id;
      opt.textContent = `${p.peso}g - ${p.nombre} (${p.variedad}) - ₡${p.precio}`;
      opt.dataset.precio = p.precio;
      opt.dataset.nombre = p.nombre;
      opt.dataset.peso = p.peso;
      opt.dataset.variedad = p.variedad;
      productoSelect.appendChild(opt);
    }
  });
}

// ================== CARGAR CLIENTES ==================
async function cargarClientes() {
  clienteSelect.innerHTML = "<option value=''>Seleccione cliente</option>";
  const snap = await getDocs(collection(db, "clientes"));
  snap.forEach(docSnap => {
    const c = docSnap.data();
    if (c.vendedorId === vendedorId) {
      const opt = document.createElement("option");
      opt.value = docSnap.id;
      opt.textContent = `${c.nombre} (${c.telefono || "-"})`;
      clienteSelect.appendChild(opt);
    }
  });
}

// ================== CARGAR CLIENTES FILTRO ==================
async function cargarClientesFiltro() {
  filtroCliente.innerHTML = "<option value=''>Todos los clientes</option>";
  const snap = await getDocs(collection(db, "clientes"));
  snap.forEach(docSnap => {
    const c = docSnap.data();
    if (c.vendedorId === vendedorId) {
      const opt = document.createElement("option");
      opt.value = docSnap.id;
      opt.textContent = `${c.nombre} (${c.telefono || "-"})`;
      filtroCliente.appendChild(opt);
    }
  });
}

// ================== AGREGAR AL CARRITO ==================
document.getElementById("agregarLineaBtn").onclick = () => {
  const opt = productoSelect.selectedOptions[0];
  const cantidad = Number(cantidadInput.value);
  if (!opt || cantidad <= 0) return alert("Cantidad inválida");

  const indexExistente = carrito.findIndex(l => l.productoId === opt.value);
  if (indexExistente >= 0) {
    carrito[indexExistente].cantidad += cantidad;
    carrito[indexExistente].subtotal = carrito[indexExistente].cantidad * carrito[indexExistente].precio;
  } else {
    const subtotal = cantidad * Number(opt.dataset.precio);
    carrito.push({
      productoId: opt.value,
      nombre: opt.dataset.nombre,
      precio: Number(opt.dataset.precio),
      peso: Number(opt.dataset.peso),
      cantidad,
      subtotal
    });
  }

  cantidadInput.value = "";
  renderCarrito();
  clienteSelect.disabled = true;
  document.getElementById("buscarClienteInput").disabled = true;
};

function renderCarrito() {
  carritoBody.innerHTML = "";
  let total = 0;
  carrito.forEach((l, i) => {
    total += l.subtotal;
    carritoBody.innerHTML += `
      <tr>
        <td data-label="Producto">${l.nombre}</td>
        <td data-label="Cantidad">${l.cantidad}</td>
        <td data-label="Subtotal">₡${l.subtotal.toLocaleString()}</td>
        <td><button class="btn-eliminar" onclick="eliminarLinea(${i})">✕</button></td>
      </tr>
    `;
  });
  totalPedido.textContent = total.toLocaleString();
}

window.eliminarLinea = (i) => {
  carrito.splice(i, 1);
  renderCarrito();
  if (carrito.length === 0) {
    clienteSelect.disabled = false;
    document.getElementById("buscarClienteInput").disabled = false;
  }
};

// ================== CONFIRMAR VENTA ==================
document.getElementById("confirmarVentaBtn").onclick = async () => {
  const clienteId = clienteSelect.value;
  if (!clienteId) return alert("Seleccione un cliente");
  if (carrito.length === 0) return alert("Carrito vacío");

  const diasConsignacion = Number(diasConsignacionInput.value || 0);
  const fechaVencimiento = diasConsignacion > 0 ? new Date(Date.now() + diasConsignacion * 24 * 60 * 60 * 1000) : null;

  const clienteDoc = await getDoc(doc(db, "clientes", clienteId));
  const clienteData = clienteDoc.data();
  const total = carrito.reduce((s, l) => s + l.subtotal, 0);

  const nuevaVenta = {
    vendedorId,
    cliente: { id: clienteId, nombre: clienteData.nombre, telefono: clienteData.telefono || null },
    fecha: new Date(),
    total,
    lineas: [...carrito], 
    estado: "entrante",
    estadoPago: "pendiente",
    consignacion: diasConsignacion > 0 ? { dias: diasConsignacion, vencimiento: fechaVencimiento, estado: "pendiente de pago" } : null
  };

  const ventaRef = await addDoc(collection(db, "ventas"), nuevaVenta);
  imprimirTicket({ ...nuevaVenta, id: ventaRef.id });

  carrito = [];
  renderCarrito();
  clienteSelect.value = "";
  clienteSelect.disabled = false;
  document.getElementById("buscarClienteInput").disabled = false;
  document.getElementById("buscarClienteInput").value = "";
  document.getElementById("buscarProductoInput").value = "";
  diasConsignacionInput.value = "";

  alert("Pedido registrado con éxito");
};

// ================== CARGAR PEDIDOS ==================
function cargarPedidos() {
  onSnapshot(collection(db, "ventas"), snap => {
    pedidosContainer.innerHTML = "";
    snap.forEach(docSnap => {
      const venta = docSnap.data();
      const pedidoId = docSnap.id;
      if (venta.vendedorId !== vendedorId) return;
      if (venta.estado === 'entregado' && venta.estadoPago === 'pagado') return;

      const card = document.createElement("div");
      card.className = `card estado-${venta.estado.replace(' ', '-')}`;
      card.innerHTML = `
        <p><strong>Cliente:</strong> ${venta.cliente.nombre}</p>
        <p><strong>Total:</strong> ₡${venta.total.toLocaleString()}</p>
        <button onclick="actualizarEstadoVendedor('${pedidoId}')">Actualizar</button>
        <button style="background:#444" onclick='imprimirTicket(${JSON.stringify({ ...venta, id: pedidoId })})'>Ticket</button>
      `;
      pedidosContainer.appendChild(card);
    });
  });
}

// ================== LÓGICA DE BÚSQUEDA (MEJORA) ==================
function configurarBuscadorCoincidencia(inputId, selectId) {
  const input = document.getElementById(inputId);
  const select = document.getElementById(selectId);
  if (!input || !select) return;

  input.addEventListener("input", () => {
    const filtro = input.value.toLowerCase();
    const opciones = select.options;
    let primeraEncontrada = -1;

    for (let i = 0; i < opciones.length; i++) {
      const texto = opciones[i].text.toLowerCase();
      const coincide = texto.includes(filtro);
      opciones[i].style.display = coincide ? "block" : "none";
      if (coincide && primeraEncontrada === -1) primeraEncontrada = i;
    }
    if (primeraEncontrada !== -1) select.selectedIndex = primeraEncontrada;
  });
}

// ================== TICKET Y OTROS (Se mantienen igual) ==================
window.imprimirTicket = (venta) => {
  // Lógica de impresión proporcionada anteriormente...
  console.log("Imprimiendo ticket para:", venta.id);
  // (Aquí iría el resto de tu función imprimirTicket intacta)
};
