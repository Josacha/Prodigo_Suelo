import { auth, db } from "./firebase.js";
import {
  collection, getDocs, addDoc, doc, getDoc, updateDoc, deleteDoc, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// ================== VARIABLES ==================
let carrito = [];
let vendedorId = null;

const productoInput = document.getElementById("productoInput");
const listaSugerencias = document.getElementById("listaSugerencias");
let productosCache = [];

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
productoInput.addEventListener("input", () => {
  const query = productoInput.value.toLowerCase();
  listaSugerencias.innerHTML = "";
  if (!query) return;

  productosCache
    .filter(p => p.nombre.toLowerCase().includes(query) || p.variedad.toLowerCase().includes(query))
    .forEach(p => {
      const li = document.createElement("li");
      li.textContent = `${p.nombre} (${p.variedad}) ${p.peso}g - ₡${p.precio}`;
      li.dataset.id = p.id;
      li.dataset.nombre = p.nombre;
      li.dataset.precio = p.precio;
      li.dataset.peso = p.peso;
      li.dataset.variedad = p.variedad;

      li.onclick = () => {
        productoInput.value = li.textContent;
        productoInput.dataset.id = li.dataset.id; // guardamos id seleccionado
        listaSugerencias.innerHTML = "";
      };
      listaSugerencias.appendChild(li);
    });
});

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
  const productoId = productoInput.dataset.id;
const cantidad = Number(cantidadInput.value);
if (!productoId) return alert("Seleccione un producto válido");
if (cantidad <= 0) return alert("Cantidad inválida");

const prod = productosCache.find(p => p.id === productoId);


  // Evitar duplicados
  const indexExistente = carrito.findIndex(l => l.productoId === opt.value);
  if (indexExistente >= 0) {
    carrito[indexExistente].cantidad += cantidad;
    carrito[indexExistente].subtotal = carrito[indexExistente].cantidad * carrito[indexExistente].precio;
  } else {
    const subtotal = cantidad * Number(prod.precio);
    carrito.push({
      productoId: opt.value,
      nombre: prod.nombre,
      precio: Number(prod.precio),
      peso: Number(prod.peso),
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

  const ventaRef = await addDoc(collection(db, "ventas"), {
    vendedorId,
    cliente: { id: clienteId, nombre: clienteData.nombre, telefono: clienteData.telefono || null },
    fecha: new Date(),
    total,
    lineas: carrito,
    estado: "entrante",
    estadoPago: "pendiente",
    consignacion: diasConsignacion > 0 ? { dias: diasConsignacion, vencimiento: fechaVencimiento, estado: "pendiente de pago" } : null,
    comentario: ""
  });

  carrito = [];
  renderCarrito();
  clienteSelect.value = "";
  clienteSelect.disabled = false;
  diasConsignacionInput.value = "";

  alert("Pedido registrado");
  cargarPedidos();
  imprimirTicket({
    id: ventaRef.id,
    vendedorId,
    cliente: { id: clienteId, nombre: clienteData.nombre, telefono: clienteData.telefono || null },
    fecha: new Date(),
    total,
    lineas: carrito,
    estado: "entrante",
    estadoPago: "pendiente",
    consignacion: diasConsignacion > 0 ? { dias: diasConsignacion, vencimiento: fechaVencimiento, estado: "pendiente de pago" } : null
  });
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

// ================== IMPRIMIR TICKET ==================
window.imprimirTicket = (venta) => {
  const fecha = venta.fecha.toDate?venta.fecha.toDate():new Date(venta.fecha);
  const htmlTicket = `
    <div class="ticket">
      <h3 style="text-align:center;">Pródigo Suelo</h3>
      <hr>
      <p>Fecha: ${fecha.toLocaleDateString()} ${fecha.toLocaleTimeString()}</p>
      <p>Cliente: ${venta.cliente.nombre}</p>
      <ul>${venta.lineas.map(l=>`<li>${l.nombre} x ${l.cantidad} = ₡${l.subtotal}</li>`).join('')}</ul>
      <hr>
      <p class="total"><strong>Total:</strong> ₡${venta.total}</p>
      <p class="estado">Estado Pedido: ${venta.estado}</p>
      <p>Estado Pago: ${venta.estadoPago||'pendiente'}</p>
      ${venta.consignacion?`<p>Consignación: ${venta.consignacion.estado}</p>`:''}
      <hr>
      <p style="text-align:center;">¡Gracias por su compra!</p>
    </div>
  `;
  const ventana = window.open('', '_blank', 'height=600,width=400');
  ventana.document.write('<html><head><title>Ticket</title>');
  ventana.document.write('<style>@page{size:100mm auto;margin:0;} body{font-family: monospace;margin:0;} .ticket{width:100mm;padding:10px;}</style>');
  ventana.document.write('</head><body>');
  ventana.document.write(htmlTicket);
  ventana.document.write('</body></html>');
  ventana.document.close();
  ventana.focus();
  ventana.print();
};

