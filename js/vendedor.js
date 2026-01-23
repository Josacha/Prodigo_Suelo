import { auth, db } from "./firebase.js";
import {
  collection, getDocs, addDoc, doc, getDoc, updateDoc, deleteDoc, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// ================== VARIABLES (Tus variables originales) ==================
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
const fechaInicioFiltro = document.getElementById("fechaInicioFiltro");
const fechaFinFiltro = document.getElementById("fechaFinFiltro");
const btnBuscarPedidos = document.getElementById("btnBuscarPedidos");
const resultadosPedidos = document.getElementById("resultadosPedidos");

// ================== AUTENTICACIÓN (Tus funciones originales) ==================
onAuthStateChanged(auth, async user => {
  if (!user) location.href = "index.html";
  vendedorId = user.uid;
  await cargarProductos();
  await cargarClientes();
  cargarPedidos();
  cargarClientesFiltro();
});

document.getElementById("logoutBtn")?.addEventListener("click", async () => {
  await signOut(auth);
  location.href = "index.html";
});

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

async function cargarClientes() {
  clienteSelect.innerHTML = "<option value=''>Seleccione cliente</option>";
  const snap = await getDocs(collection(db, "clientes"));
  const agregados = new Set();
  snap.forEach(docSnap => {
    const c = docSnap.data();
    if (c.vendedorId === vendedorId && !agregados.has(docSnap.id)) {
      const opt = document.createElement("option");
      opt.value = docSnap.id;
      opt.textContent = `${c.nombre} (${c.telefono || "-"})`;
      clienteSelect.appendChild(opt);
      agregados.add(docSnap.id);
    }
  });
}

async function cargarClientesFiltro() {
  filtroCliente.innerHTML = "<option value=''>Todos los clientes</option>";
  const snap = await getDocs(collection(db, "clientes"));
  const agregados = new Set();
  snap.forEach(docSnap => {
    const c = docSnap.data();
    if (c.vendedorId === vendedorId && !agregados.has(docSnap.id)) {
      const opt = document.createElement("option");
      opt.value = docSnap.id;
      opt.textContent = `${c.nombre} (${c.telefono || "-"})`;
      filtroCliente.appendChild(opt);
      agregados.add(docSnap.id);
    }
  });
}

// ================== CARRITO (Tus funciones originales) ==================
document.getElementById("agregarLineaBtn").onclick = () => {
  const opt = productoSelect.selectedOptions[0];
  const cantidad = Number(cantidadInput.value);
  if (!opt || cantidad <= 0) return alert("Cantidad inválida");

  const indexExistente = carrito.findIndex(l => l.productoId === opt.value);
  if (indexExistente >= 0) {
    carrito[indexExistente].cantidad += cantidad;
    carrito[indexExistente].subtotal = carrito[indexExistente].cantidad * carrito[indexExistente].precio;
  } else {
    carrito.push({
      productoId: opt.value,
      nombre: opt.dataset.nombre,
      precio: Number(opt.dataset.precio),
      peso: Number(opt.dataset.peso),
      cantidad,
      subtotal: cantidad * Number(opt.dataset.precio)
    });
  }
  cantidadInput.value = "";
  renderCarrito();
  clienteSelect.disabled = true;
};

function renderCarrito() {
  carritoBody.innerHTML = "";
  let total = 0;
  carrito.forEach((l, i) => {
    total += l.subtotal;
    carritoBody.innerHTML += `<tr><td>${l.nombre}</td><td>${l.cantidad}</td><td>₡${l.subtotal}</td><td><button onclick="eliminarLinea(${i})">X</button></td></tr>`;
  });
  totalPedido.textContent = total;
}

window.eliminarLinea = (i) => {
  carrito.splice(i, 1);
  renderCarrito();
  if (carrito.length === 0) clienteSelect.disabled = false;
};

// ================== CONFIRMAR VENTA (Tu lógica original intacta) ==================
document.getElementById("confirmarVentaBtn").onclick = async () => {
  const clienteId = clienteSelect.value;
  if (!clienteId) return alert("Seleccione un cliente");
  if (carrito.length === 0) return alert("Carrito vacío");

  const diasConsignacion = Number(diasConsignacionInput.value || 0);
  const fechaVencimiento = diasConsignacion > 0 ? new Date(Date.now() + diasConsignacion * 24 * 60 * 60 * 1000) : null;

  const clienteDoc = await getDoc(doc(db, "clientes", clienteId));
  const clienteData = clienteDoc.data();
  const total = carrito.reduce((s, l) => s + l.subtotal, 0);

  const ventaRef = await addDoc(collection(db, "ventas"), {
    vendedorId,
    cliente: { id: clienteId, nombre: clienteData.nombre, telefono: clienteData.telefono || null },
    fecha: new Date(),
    total,
    lineas: [...carrito],
    estado: "entrante",
    estadoPago: "pendiente",
    consignacion: diasConsignacion > 0 ? { dias: diasConsignacion, vencimiento: fechaVencimiento, estado: "pendiente de pago" } : null,
    comentario: ""
  });

  // Solo agregamos esta línea para imprimir antes de limpiar el carrito
  imprimirTicket({
    id: ventaRef.id,
    cliente: { nombre: clienteData.nombre },
    fecha: new Date(),
    total,
    lineas: [...carrito],
    estadoPago: "pendiente"
  });

  carrito = [];
  renderCarrito();
  clienteSelect.value = "";
  clienteSelect.disabled = false;
  diasConsignacionInput.value = "";
  alert("Pedido registrado");
  cargarPedidos();
};

// ================== CARGAR PEDIDOS (Tus funciones originales) ==================
function cargarPedidos() {
  onSnapshot(collection(db, "ventas"), snap => {
    pedidosContainer.innerHTML = "";
    snap.forEach(docSnap => {
      const venta = docSnap.data();
      if (venta.vendedorId !== vendedorId) return;
      if (venta.estado === 'entregado' && venta.estadoPago === 'pagado') return;

      const card = document.createElement("div");
      card.className = `card estado-${venta.estado.replace(' ', '-')}`;
      card.innerHTML = `
        <p><strong>${venta.cliente.nombre}</strong></p>
        <p>Total: ₡${venta.total}</p>
        <button onclick='imprimirTicket(${JSON.stringify({ ...venta, id: docSnap.id })})'>Ticket</button>
      `;
      pedidosContainer.appendChild(card);
    });
  });
}

// ================== IMPRIMIR TICKET (Solo cambiamos el diseño visual) ==================
window.imprimirTicket = (venta) => {
  const fecha = venta.fecha.toDate ? venta.fecha.toDate() : new Date(venta.fecha);
  const statusPago = (venta.estadoPago || "pendiente").toUpperCase();

  const htmlTicket = `
    <div id="ticketImprimible">
      <div style="text-align:center;">
        <img src="imagenes/LOGO PRODIGO SUELO-01.png" style="width: 30mm; height: auto; filter: grayscale(100%);">
        <h1 style="font-size: 16px; margin: 5px 0;">PRÓDIGO SUELO</h1>
        <p style="font-size: 10px; margin: 0;">Nutrición Orgánica</p>
      </div>

      <div class="sep">-------------------------------</div>
      <div style="font-size: 11px;">
        <p><b>FECHA:</b> ${fecha.toLocaleDateString()} ${fecha.getHours()}:${fecha.getMinutes()}</p>
        <p><b>CLIENTE:</b> ${venta.cliente.nombre.toUpperCase()}</p>
        <p><b>DOC:</b> ${venta.id.slice(-6).toUpperCase()}</p>
      </div>
      <div class="sep">-------------------------------</div>
      
      <div class="items">
        ${venta.lineas.map(l => `
          <div style="margin-bottom: 5px;">
            <span style="font-size:10px; font-weight:bold; display:block;">${l.nombre.toUpperCase()}</span>
            <div style="display:flex; justify-content:space-between; font-size:11px;">
              <span>${l.cantidad} x ₡${l.precio.toLocaleString()}</span>
              <span><b>₡${l.subtotal.toLocaleString()}</b></span>
            </div>
          </div>
        `).join('')}
      </div>

      <div class="sep">-------------------------------</div>
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <b>TOTAL:</b>
        <b style="font-size: 16px;">₡${venta.total.toLocaleString()}</b>
      </div>

      <div style="margin-top:10px; border:1pt solid black; text-align:center; padding:4px; font-weight:bold; font-size:12px;">
        PAGO: ${statusPago}
      </div>

      <div style="text-align:center; font-size:10px; margin-top:10px;">
        <p>¡Gracias por su compra!</p>
      </div>
    </div>
  `;

  let contenedor = document.getElementById("ticketContainer");
  if (!contenedor) {
    contenedor = document.createElement("div");
    contenedor.id = "ticketContainer";
    document.body.appendChild(contenedor);
  }
  contenedor.innerHTML = htmlTicket;

  setTimeout(() => { window.print(); }, 500);
};
