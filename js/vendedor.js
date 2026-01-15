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

// CARGAR PEDIDOS REGISTRADOS
function cargarPedidos(){
  pedidosContainer.innerHTML="";
  onSnapshot(collection(db,"ventas"),snap=>{
    pedidosContainer.innerHTML="";
    snap.forEach(async docSnap=>{
      const venta = docSnap.data();
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

      card.innerHTML = `
        <p><strong>Cliente:</strong> ${venta.cliente.nombre}</p>
        <p><strong>Total:</strong> ₡${venta.total}</p>
        <ul>${lineasHTML}</ul>

        <label>Estado:</label>
        <select id="estado-${pedidoId}">
          <option value="entrante" ${venta.estado==='entrante'?'selected':''}>Entrante</option>
          <option value="en proceso" ${venta.estado==='en proceso'?'selected':''}>En Proceso</option>
          <option value="listo" ${venta.estado==='listo'?'selected':''}>Listo</option>
          <option value="atrasado" ${venta.estado==='atrasado'?'selected':''}>Atrasado</option>
          <option value="entregado" ${venta.estado==='entregado'?'selected':''}>Entregado</option>
        </select>

        ${consignacionHTML}

        <button onclick="actualizarEstadoVendedor('${pedidoId}')">Actualizar</button>
        <button onclick="eliminarPedido('${pedidoId}')" class="btn-eliminar">Eliminar pedido</button>
      `;

      pedidosContainer.appendChild(card);

      // Notificación pedido listo
      if(venta.estado === "listo" && !card.dataset.notificado){
        sonidoPedidoListo.play();
        card.dataset.notificado = true;
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

// Actualizar estado
window.actualizarEstadoVendedor = async (pedidoId)=>{
  const estadoSelect = document.getElementById(`estado-${pedidoId}`);
  const nuevoEstado = estadoSelect.value;
  const docRef = doc(db,"ventas",pedidoId);
  const docSnap = await getDoc(docRef);
  const pedido = docSnap.data();

  // Solo LISTO → ENTREGADO para vendedor
  if(pedido.estado === 'listo' && nuevoEstado==='entregado'){
    await updateDoc(docRef,{estado:'entregado'});
    alert("Pedido marcado como ENTREGADO");
  } else if(nuevoEstado!=='entregado'){
    await updateDoc(docRef,{estado:nuevoEstado});
    alert("Estado actualizado");
  } else {
    alert("Solo puede marcar como ENTREGADO un pedido que esté LISTO");
  }
};

// Eliminar pedido
window.eliminarPedido = async (pedidoId)=>{
  if(confirm("¿Desea eliminar este pedido?")){
    await deleteDoc(doc(db,"ventas",pedidoId));
    alert("Pedido eliminado");
  }
};
