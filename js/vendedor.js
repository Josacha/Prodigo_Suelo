import { auth, db } from "./firebase.js";
import {
  collection, getDocs, addDoc, doc, getDoc, updateDoc, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

let carrito = [];

const productoSelect = document.getElementById("productoSelect");
const cantidadInput = document.getElementById("cantidadInput");
const carritoBody = document.getElementById("carritoBody");
const totalPedido = document.getElementById("totalPedido");
const clienteSelect = document.getElementById("clienteSelect");
const pedidosContainer = document.getElementById("pedidosContainer");

// PROTECCIÓN
onAuthStateChanged(auth, async user => {
  if(!user) location.href = "index.html";
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
    if(p.activo){
      const opt = document.createElement("option");
      opt.value = d.id;
      opt.textContent = `${p.nombre} - ₡${p.precio} (Stock: ${p.stock})`;
      opt.dataset.precio = p.precio;
      opt.dataset.stock = p.stock;
      opt.dataset.nombre = p.nombre;
      productoSelect.appendChild(opt);
    }
  });
}

// CARGAR CLIENTES DEL VENDEDOR
async function cargarClientes() {
  clienteSelect.innerHTML = "<option value=''>Seleccione cliente</option>";
  const snap = await getDocs(collection(db, "clientes"));
  snap.forEach(docSnap => {
    const c = docSnap.data();
    if(c.vendedorId === auth.currentUser.uid){
      const opt = document.createElement("option");
      opt.value = docSnap.id;
      opt.textContent = `${c.nombre} (${c.telefono || "-"})`;
      clienteSelect.appendChild(opt);
    }
  });
}

// AGREGAR AL CARRITO
document.getElementById("agregarLineaBtn").onclick = () => {
  const opt = productoSelect.selectedOptions[0];
  const cantidad = Number(cantidadInput.value);
  if(!opt || cantidad <=0 || cantidad>Number(opt.dataset.stock)) return alert("Cantidad inválida o stock insuficiente");
  const subtotal = cantidad*Number(opt.dataset.precio);

  carrito.push({
    productoId: opt.value,
    nombre: opt.dataset.nombre,
    precio: Number(opt.dataset.precio),
    cantidad,
    subtotal
  });
  cantidadInput.value="";
  renderCarrito();
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
          <button class="btn-eliminar" onclick="eliminarLinea(${i})">
            <i class="fa fa-trash"></i>
          </button>
        </td>
      </tr>
    `;
  });
  totalPedido.textContent=total;
}

window.eliminarLinea = (i)=>{
  carrito.splice(i,1);
  renderCarrito();
};

// CONFIRMAR PEDIDO
document.getElementById("confirmarVentaBtn").onclick = async () => {
  const clienteId = clienteSelect.value;
  if(!clienteId) return alert("Seleccione un cliente");
  if(carrito.length===0) return alert("Carrito vacío");

  const clienteDoc = await getDoc(doc(db,"clientes",clienteId));
  const clienteData = clienteDoc.data();

  const total = carrito.reduce((s,l)=>s+l.subtotal,0);

  await addDoc(collection(db,"ventas"),{
    vendedorId: auth.currentUser.uid,
    cliente:{id:clienteId, nombre:clienteData.nombre, telefono:clienteData.telefono||null},
    fecha: new Date(),
    total,
    lineas: carrito
  });

  // Actualizar stock
  for(const l of carrito){
    const ref = doc(db,"productos",l.productoId);
    const snap = await getDoc(ref);
    await updateDoc(ref,{stock: snap.data().stock-l.cantidad});
  }

  carrito=[];
  renderCarrito();
  clienteSelect.value="";
  alert("Pedido registrado");
  cargarPedidos();
};

// CARGAR PEDIDOS REGISTRADOS
function cargarPedidos(){
  pedidosContainer.innerHTML="";
  onSnapshot(collection(db,"ventas"),snap=>{
    pedidosContainer.innerHTML="";
    snap.forEach(docSnap=>{
      const venta = docSnap.data();
      if(venta.vendedorId!==auth.currentUser.uid) return;

      const card = document.createElement("div");
      card.className="card";
      const lineasHTML = venta.lineas.map(l=>`<li>${l.nombre} x ${l.cantidad} = ₡${l.subtotal}</li>`).join("");
      card.innerHTML = `
        <p><strong>Cliente:</strong> ${venta.cliente.nombre}</p>
        <p><strong>Teléfono:</strong> ${venta.cliente.telefono || "-"}</p>
        <p><strong>Total:</strong> ₡${venta.total}</p>
        <ul>${lineasHTML}</ul>
        <button class="btn-eliminar" onclick="eliminarPedido('${docSnap.id}')">
          <i class="fa fa-trash"></i> Eliminar pedido
        </button>
      `;
      pedidosContainer.appendChild(card);
    });
  });
}

window.eliminarPedido = async (id)=>{
  if(confirm("Eliminar pedido?")) await deleteDoc(doc(db,"ventas",id));
};
