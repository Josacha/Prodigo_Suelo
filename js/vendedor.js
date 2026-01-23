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

  const nuevaVenta = {
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

  const ventaRef = await addDoc(collection(db, "ventas"), nuevaVenta);

  imprimirTicket({ ...nuevaVenta, id: ventaRef.id });

  carrito = [];
  renderCarrito();
  clienteSelect.value = "";
  clienteSelect.disabled = false;
  diasConsignacionInput.value = "";

  alert("Pedido registrado con éxito");
  cargarPedidos();
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

      const lineasHTML = venta.lineas.map(l => `<li>${l.nombre} x ${l.cantidad}</li>`).join('');
      const card = document.createElement("div");
      card.className = `card estado-${venta.estado.replace(' ', '-')}`;
      card.innerHTML = `
        <p><strong>Cliente:</strong> ${venta.cliente.nombre}</p>
        <p><strong>Total:</strong> ₡${venta.total.toLocaleString()}</p>
        <ul>${lineasHTML}</ul>

        <div style="margin-top:10px">
          <label style="font-size:11px">Estado Pedido:</label>
          <select id="estado-${pedidoId}" style="width:100%; margin-bottom:10px">
            <option value="entrante" ${venta.estado==='entrante'?'selected':''}>Entrante</option>
            <option value="en proceso" ${venta.estado==='en proceso'?'selected':''}>En Proceso</option>
            <option value="listo" ${venta.estado==='listo'?'selected':''}>Listo</option>
            <option value="atrasado" ${venta.estado==='atrasado'?'selected':''}>Atrasado</option>
            <option value="entregado" ${venta.estado==='entregado'?'selected':''}>Entregado</option>
          </select>

          <label style="font-size:11px">Estado Pago:</label>
          <select id="estadoPago-${pedidoId}" style="width:100%; margin-bottom:10px">
            <option value="pendiente" ${venta.estadoPago==='pendiente'?'selected':''}>Pendiente</option>
            <option value="pagado" ${venta.estadoPago==='pagado'?'selected':''}>Pagado</option>
          </select>
        </div>

        <button onclick="actualizarEstadoVendedor('${pedidoId}')">Actualizar</button>
        <button style="background:#444" onclick='imprimirTicket(${JSON.stringify({ ...venta, id: pedidoId })})'>Reimprimir</button>
        <button style="background:transparent; color:#ff4d4d; border:1px solid #ff4d4d" onclick="eliminarPedido('${pedidoId}')">Eliminar</button>
      `;
      pedidosContainer.appendChild(card);
    });
  });
}

// ================== ACTUALIZAR ESTADO ==================
window.actualizarEstadoVendedor = async (pedidoId) => {
  const estadoSelect = document.getElementById(`estado-${pedidoId}`);
  const estadoPagoSelect = document.getElementById(`estadoPago-${pedidoId}`);
  const docRef = doc(db, "ventas", pedidoId);
  await updateDoc(docRef, { estado: estadoSelect.value, estadoPago: estadoPagoSelect.value });
  alert("Estado actualizado");
};

// ================== ELIMINAR PEDIDO ==================
window.eliminarPedido = async (pedidoId) => {
  if (confirm("¿Desea eliminar este pedido?")) {
    await deleteDoc(doc(db,"ventas",pedidoId));
    alert("Pedido eliminado");
  }
};

// ================== BUSCAR PEDIDOS ==================
btnBuscarPedidos.onclick = async () => {
  const clienteId = filtroCliente.value;
  const snap = await getDocs(collection(db,"ventas"));
  resultadosPedidos.innerHTML = "";

  snap.forEach(docSnap => {
    const venta = docSnap.data();
    const pedidoId = docSnap.id;

    if(clienteId && venta.cliente.id!==clienteId) return;
    
    const card = document.createElement("div");
    card.className = `card estado-${venta.estado.replace(' ','-')}`;
    card.innerHTML = `
      <p><strong>Cliente:</strong> ${venta.cliente.nombre}</p>
      <p><strong>Total:</strong> ₡${venta.total.toLocaleString()}</p>
      <button onclick='imprimirTicket(${JSON.stringify({...venta,id:pedidoId})})'>Reimprimir</button>
    `;
    resultadosPedidos.appendChild(card);
  });
};

// ================== IMPRIMIR TICKET REFORZADO 58MM (Density 5 / 12x24) ==================
window.imprimirTicket = (venta) => {
  let fechaDoc = (venta.fecha && venta.fecha.seconds) ? new Date(venta.fecha.seconds * 1000) : new Date();

  const statusPago = (venta.estadoPago || "PENDIENTE").toUpperCase();
  const ticketID = (venta.id || "N/A").slice(-6).toUpperCase();

  const htmlTicket = `
    <div id="ticketImprimible" style="width: 48mm; margin: 0 auto; padding: 2mm; font-family: 'Arial Black', sans-serif; color: #000; background: #fff;">
      
      <div style="text-align:center; border-bottom: 4px solid #000; padding-bottom: 5px; margin-bottom: 8px;">
        <img src="imagenes/LOGO PRODIGO SUELO-01.png" style="width: 30mm; height: auto; filter: grayscale(100%) contrast(200%);">
        <p style="margin: 4px 0 0 0; font-size: 10px; font-weight: 900; text-transform: uppercase; background: #000; color: #fff; display: inline-block; padding: 2px 6px;">Café de Costa Rica</p>
      </div>

      <div style="font-size: 12px; font-weight: 900; line-height: 1.3; border-bottom: 2px dashed #000; padding-bottom: 6px;">
        <p style="margin: 0;">FECHA: ${fechaDoc.toLocaleDateString()} ${fechaDoc.getHours()}:${String(fechaDoc.getMinutes()).padStart(2, '0')}</p>
        <p style="margin: 0;">TICKET: #${ticketID}</p>
        <p style="margin: 4px 0 0 0; font-size: 13px; text-transform: uppercase;">CLIENTE: ${venta.cliente.nombre}</p>
      </div>

      <table style="width:100%; margin-top: 8px; border-collapse: collapse;">
        <tbody style="font-size: 12px; font-weight: 900;">
          ${venta.lineas.map(l => `
            <tr>
              <td colspan="2" style="padding-top: 6px; text-transform: uppercase; line-height: 1.1;">${l.nombre}</td>
            </tr>
            <tr style="border-bottom: 1px solid #eee;">
              <td style="font-size: 11px; padding-bottom: 4px;">${l.cantidad} x ₡${l.precio.toLocaleString()}</td>
              <td style="text-align:right; font-size: 13px;">₡${l.subtotal.toLocaleString()}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div style="margin-top: 10px; border-top: 3px solid #000; padding-top: 6px; text-align: right;">
        <p style="margin: 0; font-size: 18px; font-weight: 900;">TOTAL: ₡${venta.total.toLocaleString()}</p>
      </div>

      <div style="text-align:center; background: #000; color: #fff; margin-top: 15px; padding: 6px; -webkit-print-color-adjust: exact;">
        <span style="font-size: 14px; font-weight: 900; letter-spacing: 1px;">PAGO: ${statusPago}</span>
      </div>

      <div style="text-align:center; margin-top: 20px; font-size: 10px; font-weight: 900; line-height: 1.2;">
        <p style="margin: 0;">¡GRACIAS POR APOYAR LO NUESTRO!</p>
        <p style="margin: 4px 0;">PRODIGO SUELO - COSTA RICA</p>
       
      </div>
      
      <div style="height: 40px;"></div>
    </div>
  `;

  let contenedor = document.getElementById("ticketContainer");
  if (!contenedor) {
    contenedor = document.createElement("div");
    contenedor.id = "ticketContainer";
    document.body.appendChild(contenedor);
  }
  contenedor.innerHTML = htmlTicket;

  setTimeout(() => { window.print(); }, 600);
};



