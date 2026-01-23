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
      productoSelect.appendChild(opt);
    }
  });
}

// ================== CARGAR CLIENTES ==================
async function cargarClientes() {
  clienteSelect.innerHTML = "<option value=''>Seleccione cliente</option>";
  const snap = await getDocs(collection(db, "clientes"));
  snap.forEach(docSnap => {
    const c = docSnap.data();
    if (c.vendedorId === vendedorId) {
      const opt = document.createElement("option");
      opt.value = docSnap.id;
      opt.textContent = `${c.nombre}`;
      clienteSelect.appendChild(opt);
    }
  });
}

async function cargarClientesFiltro() {
  filtroCliente.innerHTML = "<option value=''>Todos los clientes</option>";
  const snap = await getDocs(collection(db, "clientes"));
  snap.forEach(docSnap => {
    const c = docSnap.data();
    if (c.vendedorId === vendedorId) {
      const opt = document.createElement("option");
      opt.value = docSnap.id;
      opt.textContent = c.nombre;
      filtroCliente.appendChild(opt);
    }
  });
}

// ================== CARRITO ==================
document.getElementById("agregarLineaBtn").onclick = () => {
  const opt = productoSelect.selectedOptions[0];
  const cantidad = Number(cantidadInput.value);
  if (!opt || cantidad <= 0) return alert("Cantidad inválida");

  const indexExistente = carrito.findIndex(l => l.productoId === opt.value);
  if (indexExistente >= 0) {
    carrito[indexExistente].cantidad += cantidad;
    carrito[indexExistente].subtotal = carrito[indexExistente].cantidad * carrito[indexExistente].precio;
  } else {
    carrito.push({
      productoId: opt.value,
      nombre: opt.dataset.nombre,
      precio: Number(opt.dataset.precio),
      cantidad,
      subtotal: cantidad * Number(opt.dataset.precio)
    });
  }
  cantidadInput.value = "";
  renderCarrito();
  clienteSelect.disabled = true;
};

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
        <td><button onclick="eliminarLinea(${i})">X</button></td>
      </tr>`;
  });
  totalPedido.textContent = total;
}

window.eliminarLinea = (i) => {
  carrito.splice(i, 1);
  renderCarrito();
  if (carrito.length === 0) clienteSelect.disabled = false;
};

// ================== CONFIRMAR VENTA E IMPRIMIR ==================
document.getElementById("confirmarVentaBtn").onclick = async () => {
  const clienteId = clienteSelect.value;
  if (!clienteId || carrito.length === 0) return alert("Datos incompletos");

  const diasConsig = Number(diasConsignacionInput.value || 0);
  const clienteDoc = await getDoc(doc(db, "clientes", clienteId));
  const clienteData = clienteDoc.data();
  const total = carrito.reduce((s, l) => s + l.subtotal, 0);

  const ventaData = {
    vendedorId,
    cliente: { id: clienteId, nombre: clienteData.nombre, telefono: clienteData.telefono || "" },
    fecha: new Date(),
    total,
    lineas: [...carrito], // Copia para que no se pierda al limpiar
    estado: "entrante",
    estadoPago: "pendiente",
    consignacion: diasConsig > 0 ? { dias: diasConsig, estado: "pendiente" } : null
  };

  try {
    const docRef = await addDoc(collection(db, "ventas"), ventaData);
    
    // Imprimir antes de resetear la UI
    imprimirTicket({ ...ventaData, id: docRef.id });

    // Limpiar
    carrito = [];
    renderCarrito();
    clienteSelect.value = "";
    clienteSelect.disabled = false;
    diasConsignacionInput.value = "";
    alert("Pedido registrado con éxito");
  } catch (e) {
    alert("Error al guardar");
  }
};

// ================== IMPRESIÓN 58MM ==================
window.imprimirTicket = (venta) => {
  const fecha = venta.fecha.toDate ? venta.fecha.toDate() : new Date(venta.fecha);
  const lineasHTML = venta.lineas.map(l => `
    <tr>
      <td colspan="2" style="padding-top:5px;">${l.nombre}</td>
    </tr>
    <tr>
      <td>${l.cantidad} x ₡${l.precio}</td>
      <td style="text-align:right;">₡${l.subtotal}</td>
    </tr>
  `).join('');

  const win = window.open('', '_blank', 'width=400,height=600');
  win.document.write(`
    <html>
      <head>
        <style>
          @page { size: 58mm auto; margin: 0; }
          body { font-family: 'Courier New', monospace; width: 52mm; padding: 2mm; margin: 0; font-size: 11px; color: #000; }
          .center { text-align: center; }
          .bold { font-weight: bold; }
          hr { border: none; border-top: 1px dashed #000; margin: 5px 0; }
          table { width: 100%; border-collapse: collapse; font-size: 11px; }
          .total { font-size: 14px; margin-top: 5px; }
        </style>
      </head>
      <body onload="window.print(); window.close();">
        <div class="center">
          <img src="imagenes/empaque.jpg" style="width:35mm; filter: grayscale(100%);">
          <h3 style="margin:5px 0;">PRÓDIGO SUELO</h3>
          <p>Nutrición Orgánica</p>
        </div>
        <hr>
        <p><b>Ticket:</b> ${venta.id.slice(-6).toUpperCase()}</p>
        <p><b>Fecha:</b> ${fecha.toLocaleDateString()} ${fecha.getHours()}:${fecha.getMinutes()}</p>
        <p><b>Cliente:</b> ${venta.cliente.nombre}</p>
        <hr>
        <table>${lineasHTML}</table>
        <hr>
        <div class="total">
          <b>TOTAL: <span style="float:right;">₡${venta.total}</span></b>
        </div>
        <hr>
        <p class="center">${venta.consignacion ? `CONSIGNACIÓN: ${venta.consignacion.dias} DÍAS` : 'VENTA DE CONTADO'}</p>
        <p class="center" style="margin-top:10px;">¡Gracias por su compra!</p>
      </body>
    </html>
  `);
  win.document.close();
};

// ================== CARGAR PEDIDOS Y BUSCAR (RESTO DEL CODIGO) ==================
function cargarPedidos() {
  onSnapshot(collection(db, "ventas"), snap => {
    pedidosContainer.innerHTML = "";
    snap.forEach(docSnap => {
      const venta = docSnap.data();
      if (venta.vendedorId !== vendedorId || (venta.estado === 'entregado' && venta.estadoPago === 'pagado')) return;
      
      const card = document.createElement("div");
      card.className = `card estado-${venta.estado.replace(' ', '-')}`;
      card.innerHTML = `
        <p><strong>${venta.cliente.nombre}</strong></p>
        <p>Total: ₡${venta.total}</p>
        <select id="estado-${docSnap.id}">
          <option value="entrante" ${venta.estado==='entrante'?'selected':''}>Entrante</option>
          <option value="listo" ${venta.estado==='listo'?'selected':''}>Listo</option>
          <option value="entregado" ${venta.estado==='entregado'?'selected':''}>Entregado</option>
        </select>
        <button onclick="actualizarEstadoVendedor('${docSnap.id}')">Ok</button>
        <button onclick='imprimirTicket(${JSON.stringify({...venta, id: docSnap.id})})'>Ticket</button>
      `;
      pedidosContainer.appendChild(card);
    });
  });
}

window.actualizarEstadoVendedor = async (id) => {
  const e = document.getElementById(`estado-${id}`).value;
  await updateDoc(doc(db, "ventas", id), { estado: e });
  alert("Actualizado");
};
