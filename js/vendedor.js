import { auth, db } from "./firebase.js";
import {
  collection, getDocs, addDoc, doc, getDoc, updateDoc, deleteDoc, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

let carrito = [];
let vendedorId = null;

const productoSelect = document.getElementById("productoSelect");
const cantidadInput = document.getElementById("cantidadInput");
const diasConsignacionInput = document.getElementById("diasConsignacion");
const carritoBody = document.getElementById("carritoBody");
const totalPedido = document.getElementById("totalPedido");
const clienteSelect = document.getElementById("clienteSelect");
const pedidosContainer = document.getElementById("pedidosContainer");

const sonidoPedidoListo = new Audio("audio/alerta.mp3");

// ====== PROTECCIÓN ======
onAuthStateChanged(auth, async user => {
  if(!user) location.href = "index.html";
  vendedorId = user.uid;
  await cargarProductos();
  await cargarClientes();
  cargarPedidos();
});

// ====== LOGOUT ======
document.getElementById("logoutBtn").onclick = async () => {
  await signOut(auth);
  location.href = "index.html";
};

// ====== CARGAR PRODUCTOS ======
async function cargarProductos() {
  productoSelect.innerHTML = "";
  const snap = await getDocs(collection(db, "productos"));
  snap.forEach(d => {
    const p = d.data();
    if(p.activo){
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

// ====== CARGAR CLIENTES ======
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

// ====== AGREGAR AL CARRITO ======
document.getElementById("agregarLineaBtn").onclick = () => {
  const opt = productoSelect.selectedOptions[0];
  const cantidad = Number(cantidadInput.value);
  const diasConsignacion = Number(diasConsignacionInput.value) || 0;

  if(!opt || cantidad <= 0) return alert("Cantidad inválida");

  const subtotal = cantidad * Number(opt.dataset.precio);

  carrito.push({
    productoId: opt.value,
    nombre: opt.dataset.nombre,
    precio: Number(opt.dataset.precio),
    peso: Number(opt.dataset.peso),
    cantidad,
    subtotal,
    diasConsignacion
  });

  cantidadInput.value = "";
  diasConsignacionInput.value = "";
  renderCarrito();
  clienteSelect.disabled = true;
};

// ====== RENDER CARRITO ======
function renderCarrito() {
  carritoBody.innerHTML = "";
  let total = 0;
  carrito.forEach((l,i)=>{
    total += l.subtotal;
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

// ====== CONFIRMAR PEDIDO ======
document.getElementById("confirmarVentaBtn").onclick = async () => {
  const clienteId = clienteSelect.value;
  if(!clienteId) return alert("Seleccione un cliente");
  if(carrito.length===0) return alert("Carrito vacío");

  const clienteDoc = await getDoc(doc(db,"clientes",clienteId));
  const clienteData = clienteDoc.data();
  const total = carrito.reduce((s,l)=>s+l.subtotal,0);

  const fechaVencimiento = carrito.some(l=>l.diasConsignacion>0)
    ? new Date(new Date().getTime() + Math.max(...carrito.map(l=>l.diasConsignacion))*24*60*60*1000)
    : null;

  const estadoPagoInicial = fechaVencimiento ? "consignacion" : "pendiente";

  await addDoc(collection(db,"ventas"),{
    vendedorId,
    cliente: {id:clienteId, nombre:clienteData.nombre, telefono:clienteData.telefono||null},
    fecha: new Date(),
    total,
    lineas: carrito,
    estadoPedido: "entrante", // conservamos estado de producción
    estadoPago: estadoPagoInicial,
    consignacion: !!fechaVencimiento,
    diasConsignacion: fechaVencimiento ? Math.max(...carrito.map(l=>l.diasConsignacion)) : 0,
    fechaVencimiento,
    comentario: ""
  });

  carrito=[];
  renderCarrito();
  clienteSelect.value="";
  clienteSelect.disabled=false;
  alert("Pedido registrado");
  cargarPedidos();
};

// ====== CARGAR PEDIDOS ======
function cargarPedidos() {
  pedidosContainer.innerHTML="";
  onSnapshot(collection(db,"ventas"),snap=>{
    pedidosContainer.innerHTML="";
    snap.forEach(async docSnap=>{
      const venta = docSnap.data();
      if(venta.vendedorId!==vendedorId) return;
      const pedidoId = docSnap.id;

      const card = document.createElement("div");
      card.className = "card";

      const lineasHTML = venta.lineas.map(l=>`<li>${l.nombre} x ${l.cantidad} = ₡${l.subtotal}</li>`).join("");

      // alerta de consignación vencida
      let alertaVencimiento = "";
      if(venta.estadoPago==="consignacion" && venta.fechaVencimiento){
        const hoy = new Date();
        if(new Date(venta.fechaVencimiento) < hoy){
          alertaVencimiento = `<p style="color:red;font-weight:bold;">¡Consignación vencida!</p>`;
        }
      }

      card.innerHTML = `
        <p><strong>Cliente:</strong> ${venta.cliente.nombre}</p>
        <p><strong>Total:</strong> ₡${venta.total}</p>
        <ul>${lineasHTML}</ul>

        <label>Estado Pedido:</label>
        <select id="estadoPedido-${pedidoId}">
          <option value="entrante" ${venta.estadoPedido==='entrante'?'selected':''}>Entrante</option>
          <option value="en proceso" ${venta.estadoPedido==='en proceso'?'selected':''}>En Proceso</option>
          <option value="listo" ${venta.estadoPedido==='listo'?'selected':''}>Listo</option>
          <option value="entregado" ${venta.estadoPedido==='entregado'?'selected':''}>Entregado</option>
        </select>

        <label>Estado Pago:</label>
        <select id="estadoPago-${pedidoId}">
          <option value="pendiente" ${venta.estadoPago==='pendiente'?'selected':''}>Pendiente de pago</option>
          <option value="pagado" ${venta.estadoPago==='pagado'?'selected':''}>Pagado</option>
          <option value="consignacion" ${venta.estadoPago==='consignacion'?'selected':''}>Consignación</option>
        </select>

        <button onclick="actualizarPedido('${pedidoId}')">Actualizar</button>
        <button onclick="eliminarPedido('${pedidoId}')" class="btn-eliminar">Eliminar pedido</button>

        ${alertaVencimiento}
      `;

      pedidosContainer.appendChild(card);
    });
  });
}

// ====== ACTUALIZAR PEDIDO ======
window.actualizarPedido = async (pedidoId)=>{
  const estadoPedidoSelect = document.getElementById(`estadoPedido-${pedidoId}`);
  const estadoPagoSelect = document.getElementById(`estadoPago-${pedidoId}`);

  const nuevoEstadoPedido = estadoPedidoSelect.value;
  const nuevoEstadoPago = estadoPagoSelect.value;

  const docRef = doc(db,"ventas",pedidoId);
  const docSnap = await getDoc(docRef);
  const pedido = docSnap.data();

  // regla: consignación solo puede pasar a pagado
  if(pedido.estadoPago==="consignacion" && nuevoEstadoPago!=="pagado"){
    alert("Los pedidos en consignación solo pueden marcarse como Pagado");
    estadoPagoSelect.value = "consignacion";
    return;
  }

  await updateDoc(docRef,{
    estadoPedido: nuevoEstadoPedido,
    estadoPago: nuevoEstadoPago
  });

  alert("Pedido actualizado");
};

// ====== ELIMINAR PEDIDO ======
window.eliminarPedido = async (pedidoId)=>{
  if(confirm("¿Desea eliminar este pedido?")){
    await deleteDoc(doc(db,"ventas",pedidoId));
    alert("Pedido eliminado");
  }
};
