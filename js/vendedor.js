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

// ================== CARGAR CLIENTES FILTRO ==================
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
};

// ================== RENDER CARRITO ==================
function renderCarrito() {
  carritoBody.innerHTML = "";
  let total = 0;
  carrito.forEach((l, i) => {
    total += l.subtotal;
    carritoBody.innerHTML += `
      <tr>
        <td>${l.nombre}</td>
        <td>${l.cantidad}</td>
        <td>₡${l.subtotal}</td>
        <td><button onclick="eliminarLinea(${i})">Eliminar</button></td>
      </tr>
    `;
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

  // Guardamos los datos antes de limpiar el carrito localmente
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

  // MANDAR A IMPRIMIR ANTES DE LIMPIAR UI
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
  pedidosContainer.innerHTML = "";
  onSnapshot(collection(db, "ventas"), snap => {
    pedidosContainer.innerHTML = "";

    snap.forEach(docSnap => {
      const venta = docSnap.data();
      const pedidoId = docSnap.id;

      if (venta.vendedorId !== vendedorId) return;
      if (venta.estado === 'entregado' && venta.estadoPago === 'pagado') return;

      const lineasHTML = venta.lineas.map(l => `<li>${l.nombre} x ${l.cantidad} = ₡${l.subtotal}</li>`).join('');
      const card = document.createElement("div");
      card.className = `card estado-${venta.estado.replace(' ', '-')}`;
      card.innerHTML = `
        <p><strong>Cliente:</strong> ${venta.cliente.nombre}</p>
        <p><strong>Total:</strong> ₡${venta.total}</p>
        <ul>${lineasHTML}</ul>

        <label>Estado Pedido:</label>
        <select id="estado-${pedidoId}">
          <option value="entrante" ${venta.estado==='entrante'?'selected':''}>Entrante</option>
          <option value="en proceso" ${venta.estado==='en proceso'?'selected':''}>En Proceso</option>
          <option value="listo" ${venta.estado==='listo'?'selected':''}>Listo</option>
          <option value="atrasado" ${venta.estado==='atrasado'?'selected':''}>Atrasado</option>
          <option value="entregado" ${venta.estado==='entregado'?'selected':''}>Entregado</option>
        </select>

        <label>Estado Pago:</label>
        <select id="estadoPago-${pedidoId}">
          <option value="pendiente" ${venta.estadoPago==='pendiente'?'selected':''}>Pendiente</option>
          <option value="pagado" ${venta.estadoPago==='pagado'?'selected':''}>Pagado</option>
        </select>

        <button onclick="actualizarEstadoVendedor('${pedidoId}')">Actualizar</button>
        <button onclick="eliminarPedido('${pedidoId}')">Eliminar</button>
        <button onclick='imprimirTicket(${JSON.stringify({ ...venta, id: pedidoId })})'>Ticket</button>
      `;
      pedidosContainer.appendChild(card);
    });
  });
}

window.actualizarEstadoVendedor = async (pedidoId) => {
  const estadoSelect = document.getElementById(`estado-${pedidoId}`);
  const estadoPagoSelect = document.getElementById(`estadoPago-${pedidoId}`);
  const nuevoEstado = estadoSelect.value;
  const nuevoEstadoPago = estadoPagoSelect.value;
  const docRef = doc(db, "ventas", pedidoId);
  await updateDoc(docRef, { estado: nuevoEstado, estadoPago: nuevoEstadoPago });
  alert("Actualizado");
};

window.eliminarPedido = async (pedidoId) => {
  if (confirm("¿Eliminar pedido?")) {
    await deleteDoc(doc(db,"ventas",pedidoId));
  }
};

btnBuscarPedidos.onclick = async () => {
  const clienteId = filtroCliente.value;
  const inicio = fechaInicioFiltro.value;
  const fin = fechaFinFiltro.value;
  const snap = await getDocs(collection(db,"ventas"));
  resultadosPedidos.innerHTML = "";

  snap.forEach(docSnap => {
    const venta = docSnap.data();
    if(clienteId && venta.cliente.id!==clienteId) return;
    const card = document.createElement("div");
    card.className = `card`;
    card.innerHTML = `<p>${venta.cliente.nombre} - ₡${venta.total}</p>
      <button onclick='imprimirTicket(${JSON.stringify({...venta, id: docSnap.id})})'>Ticket</button>`;
    resultadosPedidos.appendChild(card);
  });
};

// ================== IMPRIMIR TICKET (CELULAR Y PC) ==================
window.imprimirTicket = (venta) => {
  const fecha = venta.fecha.toDate ? venta.fecha.toDate() : new Date(venta.fecha);
  const statusPago = (venta.estadoPago || "pendiente").toUpperCase();

  const htmlTicket = `
    <div id="ticketImprimible">
      <div style="text-align:center;">
        <img src="imagenes/empaque.jpg" style="width: 35mm; height: auto; filter: grayscale(100%);">
        <h3 style="margin: 5px 0; font-size: 14px; color:#000;">PRÓDIGO SUELO</h3>
      </div>
      <hr style="border:none; border-top:1px dashed #000;">
      <p style="font-size:11px; color:#000; margin:2px 0;"><b>Fecha:</b> ${fecha.toLocaleDateString()} ${fecha.getHours()}:${fecha.getMinutes()}</p>
      <p style="font-size:11px; color:#000; margin:2px 0;"><b>Cliente:</b> ${venta.cliente.nombre}</p>
      <hr style="border:none; border-top:1px dashed #000;">
      <table style="width:100%; border-collapse: collapse; color:#000;">
        ${venta.lineas.map(l => `
          <tr><td colspan="2" style="font-size:11px;">${l.nombre}</td></tr>
          <tr>
            <td style="font-size:11px;">${l.cantidad} x ₡${l.precio}</td>
            <td style="text-align:right; font-size:11px;">₡${l.subtotal}</td>
          </tr>
        `).join('')}
      </table>
      <hr style="border:none; border-top:1px dashed #000;">
      <p style="font-size: 13px; display:flex; justify-content:space-between; margin: 5px 0; color:#000;">
        <b>TOTAL:</b> <b>₡${venta.total}</b>
      </p>
      <div style="text-align:center; border: 1px solid #000; padding: 3px; margin: 5px 0; color:#000;">
        <b style="font-size: 12px;">PAGO: ${statusPago}</b>
      </div>
      <p style="text-align:center; font-size: 10px; color:#000; margin-top:10px;">¡Gracias por su compra!</p>
    </div>
  `;

  let contenedor = document.getElementById("ticketContainer");
  if (!contenedor) {
    contenedor = document.createElement("div");
    contenedor.id = "ticketContainer";
    document.body.appendChild(contenedor);
  }
  contenedor.innerHTML = htmlTicket;

  setTimeout(() => {
    window.print();
  }, 500);
};
