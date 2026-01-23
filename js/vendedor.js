import { auth, db } from "./firebase.js";
import {
  collection, getDocs, addDoc, doc, getDoc, updateDoc, deleteDoc, onSnapshot
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
const fechaInicioFiltro = document.getElementById("fechaInicioFiltro");
const fechaFinFiltro = document.getElementById("fechaFinFiltro");
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

// ================== CARRITO ==================
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

  const datosVenta = {
    vendedorId,
    cliente: { id: clienteId, nombre: clienteData.nombre, telefono: clienteData.telefono || null },
    fecha: new Date(),
    total,
    lineas: [...carrito],
    estado: "entrante",
    estadoPago: "pendiente",
    consignacion: diasConsignacion > 0 ? { dias: diasConsignacion, vencimiento: fechaVencimiento, estado: "pendiente de pago" } : null,
    comentario: ""
  };

  const ventaRef = await addDoc(collection(db, "ventas"), datosVenta);

  // IMPRESIÓN CON COPIA DE DATOS ANTES DE LIMPIAR
  imprimirTicket({ ...datosVenta, id: ventaRef.id });

  carrito = [];
  renderCarrito();
  clienteSelect.value = "";
  clienteSelect.disabled = false;
  diasConsignacionInput.value = "";
  alert("Pedido registrado e imprimiendo...");
  cargarPedidos();
};

// ================== CARGAR PEDIDOS ==================
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
        <button onclick='imprimirTicket(${JSON.stringify({ ...venta, id: docSnap.id })})'>Re-imprimir Ticket</button>
      `;
      pedidosContainer.appendChild(card);
    });
  });
}

// ================== IMPRESIÓN PROFESIONAL (ALTA VISIBILIDAD) ==================
window.imprimirTicket = (venta) => {
  const fecha = venta.fecha.toDate ? venta.fecha.toDate() : new Date(venta.fecha);
  const pagoStr = (venta.estadoPago || "pendiente").toUpperCase();
  const estadoStr = (venta.estado || "entrante").toUpperCase();

  const htmlTicket = `
    <div id="ticketImprimible">
      <div style="text-align:center;">
        <img src="imagenes/empaque.jpg" style="width: 35mm; filter: grayscale(100%) contrast(200%);">
        <h1 style="font-size: 18px; margin: 5px 0; color:#000; font-weight:bold;">PRÓDIGO SUELO</h1>
        <p style="font-size: 11px; margin: 0; color:#000; font-weight:bold;">Nutrición Orgánica</p>
      </div>

      <div class="divisor">*******************************</div>
      
      <div style="font-size: 12px; color:#000; font-family: 'Courier New', monospace;">
        <p style="margin: 2px 0;"><b>FECHA:</b> ${fecha.toLocaleDateString()} ${fecha.getHours()}:${fecha.getMinutes()}</p>
        <p style="margin: 2px 0;"><b>CLIENTE:</b> ${venta.cliente.nombre.toUpperCase()}</p>
        <p style="margin: 2px 0;"><b>TICKET:</b> #${venta.id.slice(-6).toUpperCase()}</p>
      </div>

      <div class="divisor">*******************************</div>
      <p style="text-align: center; font-size: 11px; font-weight:bold; margin: 3px 0;">DETALLE DE PRODUCTOS</p>
      
      <div class="productos">
        ${venta.lineas.map(l => `
          <div style="margin-bottom: 7px;">
            <span style="font-size:12px; font-weight:bold; display:block;">${l.nombre.toUpperCase()}</span>
            <div style="display:flex; justify-content:space-between; font-size:12px;">
              <span>${l.cantidad} x ₡${l.precio.toLocaleString()}</span>
              <span><b>₡${l.subtotal.toLocaleString()}</b></span>
            </div>
          </div>
        `).join('')}
      </div>

      <div class="divisor">*******************************</div>
      
      <div style="display:flex; justify-content:space-between; align-items:center; margin: 5px 0;">
        <b style="font-size: 14px;">TOTAL:</b>
        <b style="font-size: 20px; color:#000;">₡${venta.total.toLocaleString()}</b>
      </div>

      <div style="margin-top: 10px; border: 2pt solid #000; padding: 6px; text-align:center;">
        <b style="font-size: 14px; display:block; margin-bottom: 2px;">PAGO: ${pagoStr}</b>
        <span style="font-size: 11px; display:block;">ESTADO: ${estadoStr}</span>
      </div>

      ${venta.consignacion ? `
        <p style="text-align:center; font-size: 11px; margin-top: 5px; font-weight:bold;">
          CONSIGNACIÓN: ${venta.consignacion.dias} DÍAS
        </p>
      ` : ''}

      <div style="text-align:center; font-size: 11px; margin-top: 20px; font-weight:bold; line-height: 1.2;">
        <p>¡GRACIAS POR SU COMPRA!</p>
        <p>PRÓDIGO SUELO COSTA RICA</p>
      </div>
      <div style="height: 10mm;"></div> </div>
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
