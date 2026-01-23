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

  // PREPARAMOS DATOS PARA FIREBASE E IMPRESIÓN
  const nuevaVenta = {
    vendedorId,
    cliente: { id: clienteId, nombre: clienteData.nombre, telefono: clienteData.telefono || null },
    fecha: new Date(),
    total,
    lineas: [...carrito], // COPIA PARA QUE NO SE BORRE AL LIMPIAR CARRITO
    estado: "entrante",
    estadoPago: "pendiente",
    consignacion: diasConsignacion > 0 ? { dias: diasConsignacion, vencimiento: fechaVencimiento, estado: "pendiente de pago" } : null,
    comentario: ""
  };

  const ventaRef = await addDoc(collection(db, "ventas"), nuevaVenta);

  // LANZAR IMPRESIÓN ANTES DE LIMPIAR INTERFAZ
  imprimirTicket({ ...nuevaVenta, id: ventaRef.id });

  // LIMPIAR CARRITO
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

        ${venta.consignacion?`<p><strong>Consignación:</strong> ${venta.consignacion.estado}${venta.consignacion.vencimiento && new Date() > new Date(venta.consignacion.vencimiento.toDate?venta.consignacion.vencimiento.toDate():venta.consignacion.vencimiento)?' ⚠ PLAZO VENCIDO':''}</p>`:''}

        <button onclick="actualizarEstadoVendedor('${pedidoId}')">Actualizar</button>
        <button onclick="eliminarPedido('${pedidoId}')">Eliminar pedido</button>
        <button onclick='imprimirTicket(${JSON.stringify({ ...venta, id: pedidoId })})'>Imprimir Ticket</button>
      `;
      pedidosContainer.appendChild(card);
    });
  });
}

// ================== ACTUALIZAR ESTADO ==================
window.actualizarEstadoVendedor = async (pedidoId) => {
  const estadoSelect = document.getElementById(`estado-${pedidoId}`);
  const estadoPagoSelect = document.getElementById(`estadoPago-${pedidoId}`);
  const nuevoEstado = estadoSelect.value;
  const nuevoEstadoPago = estadoPagoSelect.value;
  const docRef = doc(db, "ventas", pedidoId);
  const docSnap = await getDoc(docRef);
  const pedido = docSnap.data();

  if (pedido.estado==='listo' && nuevoEstado==='entregado') {
    await updateDoc(docRef, { estado:'entregado', estadoPago: nuevoEstadoPago });
    alert("Pedido entregado y pago actualizado");
  } else if (nuevoEstado!=='entregado') {
    await updateDoc(docRef, { estado:nuevoEstado, estadoPago: nuevoEstadoPago });
    alert("Estado actualizado");
  } else {
    alert("Solo se puede marcar como ENTREGADO un pedido LISTO. Estado de pago sí se actualizó");
    await updateDoc(docRef, { estadoPago: nuevoEstadoPago });
  }
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
  const inicio = fechaInicioFiltro.value;
  const fin = fechaFinFiltro.value;

  const snap = await getDocs(collection(db,"ventas"));
  resultadosPedidos.innerHTML = "";

  snap.forEach(docSnap => {
    const venta = docSnap.data();
    const pedidoId = docSnap.id;

    if(clienteId && venta.cliente.id!==clienteId) return;
    const fechaVenta = venta.fecha.toDate?venta.fecha.toDate():new Date(venta.fecha);
    if(inicio && fechaVenta<new Date(inicio)) return;
    if(fin){
      const fechaFinObj = new Date(fin);
      fechaFinObj.setHours(23,59,59,999);
      if(fechaVenta>fechaFinObj) return;
    }

    const lineasHTML = venta.lineas.map(l=>`<li>${l.nombre} x ${l.cantidad} = ₡${l.subtotal}</li>`).join('');
    const card = document.createElement("div");
    card.className = `card estado-${venta.estado.replace(' ','-')}`;
    card.innerHTML = `
      <p><strong>Cliente:</strong> ${venta.cliente.nombre}</p>
      <p><strong>Fecha:</strong> ${fechaVenta.toLocaleDateString()}</p>
      <p><strong>Total:</strong> ₡${venta.total}</p>
      <ul>${lineasHTML}</ul>
      <p><strong>Estado Pedido:</strong> ${venta.estado}</p>
      <p><strong>Estado Pago:</strong> ${venta.estadoPago||'pendiente'}</p>
      <button onclick='imprimirTicket(${JSON.stringify({...venta,id:pedidoId})})'>Imprimir Ticket</button>
    `;
    resultadosPedidos.appendChild(card);
  });
};

// ================== IMPRIMIR TICKET PROFESIONAL 58MM ==================
window.imprimirTicket = (venta) => {
  const fecha = venta.fecha.toDate ? venta.fecha.toDate() : new Date(venta.fecha);
  const statusPago = (venta.estadoPago || "PENDIENTE").toUpperCase();
  const ticketID = (venta.id || "N/A").slice(-6).toUpperCase();

  const htmlTicket = `
    <div id="ticketImprimible">
      <div style="text-align:center;">
        <img src="imagenes/LOGO PRODIGO SUELO-01.png" style="width: 40mm; height: auto; margin-bottom: 5px;">
        <h2 style="margin: 0; font-size: 16px; text-transform: uppercase;">Pródigo Suelo</h2>
        <p style="margin: 0; font-size: 11px;">Nutrición Orgánica</p>
      </div>

      <div style="margin-top: 10px; font-size: 12px; border-top: 1px dashed #000; padding-top: 5px;">
        <p><b>FECHA:</b> ${fecha.toLocaleDateString()} ${fecha.getHours()}:${fecha.getMinutes()}</p>
        <p><b>DOC:</b> #${ticketID}</p>
        <p><b>CLIENTE:</b> ${venta.cliente.nombre.toUpperCase()}</p>
      </div>

      <table style="width:100%; margin-top: 10px; border-collapse: collapse;">
        <thead>
          <tr style="border-bottom: 1px solid #000; font-size: 12px;">
            <th style="text-align:left; padding-bottom: 3px;">DETALLE</th>
            <th style="text-align:right; padding-bottom: 3px;">TOTAL</th>
          </tr>
        </thead>
        <tbody style="font-size: 13px;">
          ${venta.lineas.map(l => `
            <tr>
              <td style="padding-top: 5px;">${l.nombre}</td>
              <td style="text-align:right; vertical-align: bottom;">₡${l.subtotal.toLocaleString()}</td>
            </tr>
            <tr style="border-bottom: 1px dashed #eee;">
              <td colspan="2" style="font-size: 11px; color: #333; padding-bottom: 5px;">
                ${l.cantidad} unidad(es) x ₡${l.precio.toLocaleString()}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div style="margin-top: 10px; text-align: right;">
        <p style="font-size: 16px; margin: 0;"><strong>TOTAL: ₡${venta.total.toLocaleString()}</strong></p>
      </div>

      <div style="text-align:center; border: 1px solid #000; margin-top: 10px; padding: 5px;">
        <b style="font-size: 14px;">PAGO: ${statusPago}</b>
      </div>

      ${venta.consignacion ? `
        <p style="text-align:center; font-size: 11px; margin-top: 5px;">
          <i>Condición: Consignación (${venta.consignacion.dias} días)</i>
        </p>` : ''}

      <div style="text-align:center; margin-top: 15px; font-size: 11px;">
        <p>¡Gracias por apoyar lo orgánico!</p>
        <p>*** Copia de Cliente ***</p>
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

  setTimeout(() => {
    window.print();
  }, 300);
};
