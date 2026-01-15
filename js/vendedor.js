import { auth, db } from "./firebase.js";
import {
  collection, getDocs, addDoc, doc, getDoc, updateDoc, deleteDoc, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// ====== VARIABLES ======
let carrito = [];
let vendedorId = null; // Vendedor logueado

const productoSelect = document.getElementById("productoSelect");
const cantidadInput = document.getElementById("cantidadInput");
const diasConsignacionInput = document.getElementById("diasConsignacion");
const carritoBody = document.getElementById("carritoBody");
const totalPedido = document.getElementById("totalPedido");
const clienteSelect = document.getElementById("clienteSelect");
const pedidosContainer = document.getElementById("pedidosContainer");

// Sonido de notificación
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
function renderCarrito(){
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

  // Calculamos la fecha de vencimiento si hay consignación
  const fechaVencimiento = carrito.some(l=>l.diasConsignacion>0)
    ? new Date(new Date().getTime() + Math.max(...carrito.map(l=>l.diasConsignacion))*24*60*60*1000)
    : null;

  const estadoInicial = fechaVencimiento ? "consignacion" : "pendiente";

  await addDoc(collection(db,"ventas"),{
    vendedorId,
    cliente: {id:clienteId, nombre:clienteData.nombre, telefono:clienteData.telefono||null},
    fecha: new Date(),
    total,
    lineas: carrito,
    estado: estadoInicial,
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
function cargarPedidos(){
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

      // Si es consignación vencida
      let alertaVencimiento = "";
      if(venta.estado==="consignacion" && venta.fechaVencimiento){
        const hoy = new Date();
        if(new Date(venta.fechaVencimiento) < hoy){
          alertaVencimiento = `<p style="color:red;font-weight:bold;">¡Consignación vencida!</p>`;
        }
      }

      card.innerHTML = `
        <p><strong>Cliente:</strong> ${venta.cliente.nombre}</p>
        <p><strong>Total:</strong> ₡${venta.total}</p>
        <ul>${lineasHTML}</ul>

        <label>Estado:</label>
        <select id="estado-${pedidoId}">
          <option value="pendiente" ${venta.estado==='pendiente'?'selected':''}>Pendiente de pago</option>
          <option value="pagado" ${venta.estado==='pagado'?'selected':''}>Pagado</option>
          <option value="consignacion" ${venta.estado==='consignacion'?'selected':''}>Consignación</option>
        </select>

        <button onclick="actualizarEstadoVendedor('${pedidoId}')">Actualizar</button>
        <button onclick="eliminarPedido('${pedidoId}')" class="btn-eliminar">Eliminar pedido</button>

        ${alertaVencimiento}
      `;

      pedidosContainer.appendChild(card);

      // Notificación si consignación vencida
      if(alertaVencimiento && "Notification" in window && Notification.permission==="granted"){
        new Notification(`Consignación vencida: ${venta.cliente.nombre}`, {body:"Revisa el pedido"});
      }
    });
  });
}

// ====== ACTUALIZAR ESTADO ======
window.actualizarEstadoVendedor = async (pedidoId)=>{
  const estadoSelect = document.getElementById(`estado-${pedidoId}`);
  const nuevoEstado = estadoSelect.value;
  const docRef = doc(db,"ventas",pedidoId);
  const docSnap = await getDoc(docRef);
  const pedido = docSnap.data();

  // reglas: si es consignación, solo se puede pasar a pagado
  if(pedido.estado==="consignacion" && nuevoEstado!=="pagado"){
    alert("Los pedidos en consignación solo se pueden marcar como Pagado");
    estadoSelect.value = "consignacion";
    return;
  }

  await updateDoc(docRef,{estado:nuevoEstado});
  alert("Estado actualizado");
};

// ====== ELIMINAR PEDIDO ======
window.eliminarPedido = async (pedidoId)=>{
  if(confirm("¿Desea eliminar este pedido?")){
    await deleteDoc(doc(db,"ventas",pedidoId));
    alert("Pedido eliminado");
  }
};
