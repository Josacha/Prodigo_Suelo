import { auth, db } from "./firebase.js";
import {
  collection, getDocs, addDoc, doc, getDoc, updateDoc, deleteDoc, onSnapshot
  collection, getDocs, addDoc, doc, getDoc, updateDoc, deleteDoc, onSnapshot, Timestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

@@ -12,11 +12,10 @@ const carritoBody = document.getElementById("carritoBody");
const totalPedido = document.getElementById("totalPedido");
const clienteSelect = document.getElementById("clienteSelect");
const pedidosContainer = document.getElementById("pedidosContainer");
const diasConsignacionInput = document.getElementById("diasConsignacion");

let vendedorId = null; // Vendedor logueado

// Sonido de notificación
const sonidoPedidoListo = new Audio("audio/alerta.mp3"); // Pon tu archivo de sonido aquí
let vendedorId = null;
const sonidoPedidoListo = new Audio("audio/alerta.mp3");

// PROTECCIÓN
onAuthStateChanged(auth, async user => {
@@ -36,29 +35,22 @@ document.getElementById("logoutBtn").onclick = async () => {
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
      opt.dataset.peso = p.peso; // ✅ ESTO ES CLAVE

      opt.dataset.peso = p.peso;
      productoSelect.appendChild(opt);
    }
  });
}


// CARGAR CLIENTES DEL VENDEDOR (sin repetir)
// CARGAR CLIENTES DEL VENDEDOR
async function cargarClientes() {
  clienteSelect.innerHTML = "<option value=''>Seleccione cliente</option>";
  const snap = await getDocs(collection(db, "clientes"));
@@ -79,7 +71,7 @@ async function cargarClientes() {
document.getElementById("agregarLineaBtn").onclick = () => {
  const opt = productoSelect.selectedOptions[0];
  const cantidad = Number(cantidadInput.value);
  if(!opt || cantidad <=0 || cantidad>Number(opt.dataset.stock)) return alert("Cantidad inválida o stock insuficiente");
  if(!opt || cantidad <=0) return alert("Cantidad inválida");
  const subtotal = cantidad*Number(opt.dataset.precio);

  carrito.push({
@@ -93,7 +85,7 @@ document.getElementById("agregarLineaBtn").onclick = () => {

  cantidadInput.value="";
  renderCarrito();
  clienteSelect.disabled = true; // bloquea cliente después de agregar primera línea
  clienteSelect.disabled = true;
};

// RENDER CARRITO
@@ -118,7 +110,7 @@ function renderCarrito() {
window.eliminarLinea = (i) => {
  carrito.splice(i,1);
  renderCarrito();
  if(carrito.length===0) clienteSelect.disabled = false; // desbloquea si carrito vacío
  if(carrito.length===0) clienteSelect.disabled = false;
};

// CONFIRMAR PEDIDO
@@ -127,6 +119,9 @@ document.getElementById("confirmarVentaBtn").onclick = async () => {
  if(!clienteId) return alert("Seleccione un cliente");
  if(carrito.length===0) return alert("Carrito vacío");

  const diasConsignacion = Number(diasConsignacionInput.value || 0);
  const fechaVencimiento = diasConsignacion > 0 ? new Date(Date.now() + diasConsignacion*24*60*60*1000) : null;

  const clienteDoc = await getDoc(doc(db,"clientes",clienteId));
  const clienteData = clienteDoc.data();
  const total = carrito.reduce((s,l)=>s+l.subtotal,0);
@@ -138,13 +133,15 @@ document.getElementById("confirmarVentaBtn").onclick = async () => {
    total,
    lineas: carrito,
    estado: "entrante",
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
@@ -159,14 +156,22 @@ function cargarPedidos(){
      if(venta.vendedorId!==vendedorId) return;
      const pedidoId = docSnap.id;

      const lineasHTML = venta.lineas.map(l=>`<li>${l.nombre} x ${l.cantidad} = ₡${l.subtotal}</li>`).join("");

      let consignacionHTML = "";
      if(venta.consignacion){
        const venc = venta.consignacion.vencimiento ? new Date(venta.consignacion.vencimiento.toDate ? venta.consignacion.vencimiento.toDate() : venta.consignacion.vencimiento) : null;
        const hoy = new Date();
        let alerta = "";
        if(venc && hoy>venc && venta.consignacion.estado==="pendiente de pago") alerta = " ⚠ PLAZO VENCIDO";
        consignacionHTML = `<p><strong>Consignación:</strong> ${venta.consignacion.estado} ${alerta} ${venc?`(Vence: ${venc.toLocaleDateString()})`:""}</p>`;
      }

      const card = document.createElement("div");
      card.className = "card";

      const lineasHTML = venta.lineas.map(l=>`<li>${l.nombre} x ${l.cantidad} = ₡${l.subtotal}</li>`).join("");

      card.innerHTML = `
        <p><strong>Cliente:</strong> ${venta.cliente.nombre}</p>
        <p><strong>Vendedor:</strong> ${vendedorId}</p>
        <p><strong>Total:</strong> ₡${venta.total}</p>
        <ul>${lineasHTML}</ul>

@@ -179,54 +184,54 @@ function cargarPedidos(){
          <option value="entregado" ${venta.estado==='entregado'?'selected':''}>Entregado</option>
        </select>

        ${consignacionHTML}

        <button onclick="actualizarEstadoVendedor('${pedidoId}')">Actualizar</button>
        <button onclick="eliminarPedido('${pedidoId}')" class="btn-eliminar">Eliminar pedido</button>
      `;

      pedidosContainer.appendChild(card);

      // Notificación cuando el pedido está LISTO
      // Notificación pedido listo
      if(venta.estado === "listo" && !card.dataset.notificado){
        sonidoPedidoListo.play();
        card.dataset.notificado = true;

        if("Notification" in window && Notification.permission === "granted"){
          new Notification(`Pedido LISTO: ${venta.cliente.nombre}`, { body: "Revisa el pedido para entregar." });
        } else if("Notification" in window && Notification.permission !== "denied"){
          Notification.requestPermission().then(p => {
            if(p==="granted") new Notification(`Pedido LISTO: ${venta.cliente.nombre}`, { body: "Revisa el pedido para entregar." });
        if("Notification" in window && Notification.permission==="granted"){
          new Notification(`Pedido LISTO: ${venta.cliente.nombre}`, { body:"Revisa el pedido para entregar." });
        } else if("Notification" in window && Notification.permission!=="denied"){
          Notification.requestPermission().then(p=>{
            if(p==="granted") new Notification(`Pedido LISTO: ${venta.cliente.nombre}`, { body:"Revisa el pedido para entregar." });
          });
        }
      }
    });
  });
}

// Vendedor solo puede cambiar LISTO → ENTREGADO
// Actualizar estado
window.actualizarEstadoVendedor = async (pedidoId)=>{
  const estadoSelect = document.getElementById(`estado-${pedidoId}`);
  const nuevoEstado = estadoSelect.value;
  const docRef = doc(db, "ventas", pedidoId);
  const docRef = doc(db,"ventas",pedidoId);
  const docSnap = await getDoc(docRef);
  const pedido = docSnap.data();

  // Solo LISTO → ENTREGADO para vendedor
  if(pedido.estado === 'listo' && nuevoEstado==='entregado'){
    await updateDoc(docRef,{estado:'entregado'});
    alert("Pedido marcado como ENTREGADO");
  } else if(nuevoEstado !== 'entregado'){
  } else if(nuevoEstado!=='entregado'){
    await updateDoc(docRef,{estado:nuevoEstado});
    alert("Estado actualizado");
  } else {
    alert("Solo puede marcar como ENTREGADO un pedido que esté LISTO");
  }
};

// ELIMINAR PEDIDO
// Eliminar pedido
window.eliminarPedido = async (pedidoId)=>{
  if(confirm("¿Desea eliminar este pedido?")){
    await deleteDoc(doc(db,"ventas",pedidoId));
    alert("Pedido eliminado");
  }
