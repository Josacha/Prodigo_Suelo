import { auth, db } from "./firebase.js";
import {
  collection, getDocs, addDoc, doc, getDoc, updateDoc, deleteDoc, onSnapshot, Timestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

let carrito = [];

const productoSelect = document.getElementById("productoSelect");
const cantidadInput = document.getElementById("cantidadInput");
const carritoBody = document.getElementById("carritoBody");
const totalPedido = document.getElementById("totalPedido");
const clienteSelect = document.getElementById("clienteSelect");
const pedidosContainer = document.getElementById("pedidosContainer");
const diasConsignacionInput = document.getElementById("diasConsignacion");

let vendedorId = null;
const sonidoPedidoListo = new Audio("audio/alerta.mp3");

// PROTECCIÓN
onAuthStateChanged(auth, async user => {
  if(!user) location.href = "index.html";
  vendedorId = user.uid; 
  await cargarProductos();
  await cargarClientes();
  cargarPedidos();
});

// LOGOUT
document.getElementById("logoutBtn").onclick = async () => {
  await signOut(auth);
  location.href = "index.html";
};

// CARGAR PRODUCTOS
async function cargarProductos() {
  productoSelect.innerHTML = "";
  const snap = await getDocs(collection(db, "productos"));
  snap.forEach(d => {
    const p = d.data();
    if (p.activo) {
      const opt = document.createElement("option");
      opt.value = d.id;
      opt.textContent = `${p.nombre} - ₡${p.precio}`;
      opt.dataset.precio = p.precio;
      opt.dataset.nombre = p.nombre;
      opt.dataset.peso = p.peso;
      productoSelect.appendChild(opt);
    }
  });
}

// CARGAR CLIENTES DEL VENDEDOR
async function cargarClientes() {
  clienteSelect.innerHTML = "<option value=''>Seleccione cliente</option>";
  const snap = await getDocs(collection(db, "clientes"));
  const agregados = new Set();
  snap.forEach(docSnap => {
    const c = docSnap.data();
    if(c.vendedorId === vendedorId && !agregados.has(docSnap.id)){
      const opt = document.createElement("option");
      opt.value = docSnap.id;
      opt.textContent = `${c.nombre} (${c.telefono || "-"})`;
      clienteSelect.appendChild(opt);
      agregados.add(docSnap.id);
    }
  });
}


// CARGAR HISTORIAL
const filtroCliente = document.getElementById("filtroCliente");
const fechaInicioFiltro = document.getElementById("fechaInicioFiltro");
const fechaFinFiltro = document.getElementById("fechaFinFiltro");
const btnBuscarPedidos = document.getElementById("btnBuscarPedidos");
const resultadosPedidos = document.getElementById("resultadosPedidos");

// Cargar clientes en el filtro
async function cargarClientesFiltro() {
  filtroCliente.innerHTML = "<option value=''>Todos los clientes</option>";
  const snap = await getDocs(collection(db, "clientes"));
  const agregados = new Set();
  snap.forEach(docSnap => {
    const c = docSnap.data();
    if(c.vendedorId === vendedorId && !agregados.has(docSnap.id)){
      const opt = document.createElement("option");
      opt.value = docSnap.id;
      opt.textContent = `${c.nombre} (${c.telefono || "-"})`;
      filtroCliente.appendChild(opt);
      agregados.add(docSnap.id);
    }
  });
}

// Ejecutar al cargar la página
cargarClientesFiltro();

// Buscar pedidos
btnBuscarPedidos.onclick = async () => {
  const clienteId = filtroCliente.value;
  const inicio = fechaInicioFiltro.value;
  const fin = fechaFinFiltro.value;

  let q = collection(db, "ventas");

  // Consultar todas las ventas y luego filtrar en JS
  const snap = await getDocs(q);

  resultadosPedidos.innerHTML = "";
  snap.forEach(docSnap => {
    const venta = docSnap.data();
    const pedidoId = docSnap.id;

    // Filtrar por cliente
    if(clienteId && venta.cliente.id !== clienteId) return;

    // Filtrar por fechas
    const fechaVenta = venta.fecha.toDate ? venta.fecha.toDate() : new Date(venta.fecha);
    if(inicio && fechaVenta < new Date(inicio)) return;
    if(fin){
      const fechaFin = new Date(fin);
      fechaFin.setHours(23,59,59,999); // incluir todo el día
      if(fechaVenta > fechaFin) return;
    }

    // Crear tarjeta de pedido
    const lineasHTML = venta.lineas.map(l=>`<li>${l.nombre} x ${l.cantidad} = ₡${l.subtotal}</li>`).join("");

    let consignacionHTML = "";
    if(venta.consignacion){
      const venc = venta.consignacion.vencimiento ? new Date(venta.consignacion.vencimiento.toDate ? venta.consignacion.vencimiento.toDate() : venta.consignacion.vencimiento) : null;
      consignacionHTML = `<p><strong>Consignación:</strong> ${venta.consignacion.estado} ${venc?`(Vence: ${venc.toLocaleDateString()})`:""}</p>`;
    }

    const estadoPago = venta.estadoPago || "pendiente";

    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <p><strong>Cliente:</strong> ${venta.cliente.nombre}</p>
      <p><strong>Fecha:</strong> ${fechaVenta.toLocaleDateString()}</p>
      <p><strong>Total:</strong> ₡${venta.total}</p>
      <ul>${lineasHTML}</ul>
      <p><strong>Estado Pedido:</strong> ${venta.estado}</p>
      <p><strong>Estado Pago:</strong> ${estadoPago}</p>
      ${consignacionHTML}
    `;

    resultadosPedidos.appendChild(card);
  });
};






// AGREGAR AL CARRITO
document.getElementById("agregarLineaBtn").onclick = () => {
  const opt = productoSelect.selectedOptions[0];
  const cantidad = Number(cantidadInput.value);
  if(!opt || cantidad <=0) return alert("Cantidad inválida");
  const subtotal = cantidad*Number(opt.dataset.precio);

  carrito.push({
    productoId: opt.value,
    nombre: opt.dataset.nombre,
    precio: Number(opt.dataset.precio),
    peso: Number(opt.dataset.peso), 
    cantidad,
    subtotal
  });

  cantidadInput.value="";
  renderCarrito();
  clienteSelect.disabled = true;
};

// RENDER CARRITO
function renderCarrito() {
  carritoBody.innerHTML="";
  let total=0;
  carrito.forEach((l,i)=>{
    total+=l.subtotal;
    carritoBody.innerHTML += `
      <tr>
        <td>${l.nombre}</td>
        <td>${l.cantidad}</td>
        <td>₡${l.subtotal}</td>
        <td>
          <button class="btn-eliminar" onclick="eliminarLinea(${i})"><i class="fa fa-trash"></i></button>
        </td>
      </tr>
    `;
  });
  totalPedido.textContent = total;
}
window.eliminarLinea = (i) => {
  carrito.splice(i,1);
  renderCarrito();
  if(carrito.length===0) clienteSelect.disabled = false;
};

// CONFIRMAR PEDIDO
document.getElementById("confirmarVentaBtn").onclick = async () => {
  const clienteId = clienteSelect.value;
  if(!clienteId) return alert("Seleccione un cliente");
  if(carrito.length===0) return alert("Carrito vacío");

  const diasConsignacion = Number(diasConsignacionInput.value || 0);
  const fechaVencimiento = diasConsignacion > 0 ? new Date(Date.now() + diasConsignacion*24*60*60*1000) : null;

  const clienteDoc = await getDoc(doc(db,"clientes",clienteId));
  const clienteData = clienteDoc.data();
  const total = carrito.reduce((s,l)=>s+l.subtotal,0);

  await addDoc(collection(db,"ventas"),{
    vendedorId,
    cliente:{id:clienteId, nombre:clienteData.nombre, telefono:clienteData.telefono||null},
    fecha: new Date(),
    total,
    lineas: carrito,
    estado: "entrante",
    estadoPago: "pendiente",
    consignacion: diasConsignacion>0 ? { dias:diasConsignacion, vencimiento: fechaVencimiento, estado:"pendiente de pago" } : null,
    comentario: ""
  });

  carrito=[];
  renderCarrito();
  clienteSelect.value="";
  clienteSelect.disabled=false;
  diasConsignacionInput.value="";
  alert("Pedido registrado");
  cargarPedidos();
};



// GENERAR TICKET
function generarTicket(venta) {
  const ticketDiv = document.getElementById("ticket");
  ticketDiv.innerHTML = ""; // limpiar

  const fecha = venta.fecha.toDate ? venta.fecha.toDate() : new Date(venta.fecha);

  ticketDiv.innerHTML = `
    <h3>Pródigo Suelo</h3>
    <p>Fecha: ${fecha.toLocaleDateString()} ${fecha.toLocaleTimeString()}</p>
    <p>Cliente: ${venta.cliente.nombre}</p>
    <hr>
    <ul>
      ${venta.lineas.map(l => `<li>${l.nombre} x ${l.cantidad} = ₡${l.subtotal}</li>`).join("")}
    </ul>
    <hr>
    <p><strong>Total:</strong> ₡${venta.total}</p>
    <p>Estado Pedido: ${venta.estado}</p>
    <p>Estado Pago: ${venta.estadoPago || "pendiente"}</p>
    ${venta.consignacion ? `<p>Consignación: ${venta.consignacion.estado}</p>` : ""}
    <hr>
    <p>¡Gracias por su compra!</p>
  `;

  // Mostrar botón para imprimir
  const btnPrint = document.getElementById("imprimirTicketBtn");
  btnPrint.style.display = "block";
  btnPrint.onclick = () => {
    const originalContent = document.body.innerHTML;
    document.body.innerHTML = ticketDiv.innerHTML;
    window.print();
    document.body.innerHTML = originalContent;
    location.reload(); // recargar para restaurar todo
  };
}

// Llamar después de confirmar venta
document.getElementById("confirmarVentaBtn").onclick = async () => {
  const clienteId = clienteSelect.value;
  if(!clienteId) return alert("Seleccione un cliente");
  if(carrito.length===0) return alert("Carrito vacío");

  const diasConsignacion = Number(diasConsignacionInput.value || 0);
  const fechaVencimiento = diasConsignacion > 0 ? new Date(Date.now() + diasConsignacion*24*60*60*1000) : null;

  const clienteDoc = await getDoc(doc(db,"clientes",clienteId));
  const clienteData = clienteDoc.data();
  const total = carrito.reduce((s,l)=>s+l.subtotal,0);

  const ventaRef = await addDoc(collection(db,"ventas"),{
    vendedorId,
    cliente:{id:clienteId, nombre:clienteData.nombre, telefono:clienteData.telefono||null},
    fecha: new Date(),
    total,
    lineas: carrito,
    estado: "entrante",
    estadoPago: "pendiente",
    consignacion: diasConsignacion>0 ? { dias:diasConsignacion, vencimiento: fechaVencimiento, estado:"pendiente de pago" } : null,
    comentario: ""
  });

  const ventaData = {
    ...{
      vendedorId,
      cliente:{id:clienteId, nombre:clienteData.nombre, telefono:clienteData.telefono||null},
      fecha: new Date(),
      total,
      lineas: carrito,
      estado: "entrante",
      estadoPago: "pendiente",
      consignacion: diasConsignacion>0 ? { dias:diasConsignacion, vencimiento: fechaVencimiento, estado:"pendiente de pago" } : null,
      comentario: ""
    },
    id: ventaRef.id
  };

  carrito=[];
  renderCarrito();
  clienteSelect.value="";
  clienteSelect.disabled=false;
  diasConsignacionInput.value="";
  alert("Pedido registrado");

  cargarPedidos();

  generarTicket(ventaData); // Genera el ticket
};





// CARGAR PEDIDOS REGISTRADOS
function cargarPedidos(){
  pedidosContainer.innerHTML = "";
  
  onSnapshot(collection(db,"ventas"), snap => {
    pedidosContainer.innerHTML = "";

    snap.forEach(docSnap => {
      const venta = docSnap.data();
      const pedidoId = docSnap.id;

      // 🔹 FILTRO: ignorar si ya está ENTREGADO y PAGADO
      if(venta.estado === "entregado" && venta.estadoPago === "pagado") return;

      if(venta.vendedorId !== vendedorId) return;

      const lineasHTML = venta.lineas.map(l=>`<li>${l.nombre} x ${l.cantidad} = ₡${l.subtotal}</li>`).join("");

      let consignacionHTML = "";
      if(venta.consignacion){
        const venc = venta.consignacion.vencimiento ? new Date(venta.consignacion.vencimiento.toDate ? venta.consignacion.vencimiento.toDate() : venta.consignacion.vencimiento) : null;
        const hoy = new Date();
        let alerta = "";
        if(venc && hoy > venc && venta.consignacion.estado === "pendiente de pago") alerta = " ⚠ PLAZO VENCIDO";
        consignacionHTML = `<p><strong>Consignación:</strong> ${venta.consignacion.estado} ${alerta} ${venc?`(Vence: ${venc.toLocaleDateString()})`:""}</p>`;
      }

      const card = document.createElement("div");
      card.className = "card";

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

        ${consignacionHTML}

        <button onclick="actualizarEstadoVendedor('${pedidoId}')">Actualizar</button>
        <button onclick="eliminarPedido('${pedidoId}')" class="btn-eliminar">Eliminar pedido</button>
      `;

      pedidosContainer.appendChild(card);
    });
  });
}


// Actualizar estado
window.actualizarEstadoVendedor = async (pedidoId)=>{
  const estadoSelect = document.getElementById(`estado-${pedidoId}`);
  const estadoPagoSelect = document.getElementById(`estadoPago-${pedidoId}`);

  const nuevoEstado = estadoSelect.value;
  const nuevoEstadoPago = estadoPagoSelect.value;

  const docRef = doc(db,"ventas",pedidoId);
  const docSnap = await getDoc(docRef);
  const pedido = docSnap.data();

  // Vendedor solo puede marcar LISTO → ENTREGADO
  if(pedido.estado === 'listo' && nuevoEstado==='entregado'){
    await updateDoc(docRef,{estado:'entregado', estadoPago:nuevoEstadoPago});
    alert("Pedido marcado como ENTREGADO y estado de pago actualizado");
  } else if(nuevoEstado!=='entregado'){
    await updateDoc(docRef,{estado:nuevoEstado, estadoPago:nuevoEstadoPago});
    alert("Estado del pedido y de pago actualizado");
  } else {
    alert("Solo puede marcar como ENTREGADO un pedido que esté LISTO, pero el estado de pago sí se puede cambiar");
    await updateDoc(docRef,{estadoPago:nuevoEstadoPago});
  }
};


 

// Eliminar pedido
window.eliminarPedido = async (pedidoId)=>{
  if(confirm("¿Desea eliminar este pedido?")){
    await deleteDoc(doc(db,"ventas",pedidoId));
    alert("Pedido eliminado");
  }
};




