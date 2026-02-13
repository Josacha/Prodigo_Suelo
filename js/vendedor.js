import { auth, db } from "./firebase.js";
import {
  collection, getDocs, addDoc, doc, getDoc, updateDoc, deleteDoc, onSnapshot, query, where, Timestamp
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
  
  // INICIALIZAR BUSCADORES
  configurarBuscadorCoincidencia("buscarClienteInput", "clienteSelect");
  configurarBuscadorCoincidencia("buscarProductoInput", "productoSelect");
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

// =====================
// MAPA + RUTA INTELIGENTE
// =====================
async function iniciarSistemaRuta() {

  const mapa = L.map("mapaRuta").setView([9.9281, -84.0907], 8);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors"
  }).addTo(mapa);

  let marcadorVendedor;
  let lineaRuta;
  let marcadoresClientes = [];

  function calcularDistancia(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;

    const a =
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1*Math.PI/180) *
      Math.cos(lat2*Math.PI/180) *
      Math.sin(dLon/2) *
      Math.sin(dLon/2);

    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  }

  function optimizarRuta(latInicial, lngInicial, clientes) {

    let rutaOrdenada = [];
    let actualLat = latInicial;
    let actualLng = lngInicial;

    while (clientes.length > 0) {

      let masCercanoIndex = 0;
      let menorDistancia = Infinity;

      clientes.forEach((cliente, index) => {
        const distancia = calcularDistancia(
          actualLat,
          actualLng,
          cliente.lat,
          cliente.lng
        );

        if (distancia < menorDistancia) {
          menorDistancia = distancia;
          masCercanoIndex = index;
        }
      });

      const siguiente = clientes.splice(masCercanoIndex, 1)[0];

      rutaOrdenada.push(siguiente);
      actualLat = siguiente.lat;
      actualLng = siguiente.lng;
    }

    return rutaOrdenada;
  }

  navigator.geolocation.watchPosition(async (pos) => {

    const latActual = pos.coords.latitude;
    const lngActual = pos.coords.longitude;

    if (!marcadorVendedor) {
      marcadorVendedor = L.marker([latActual, lngActual], { title: "Tu ubicación" })
        .addTo(mapa)
        .bindPopup("📍 Estás aquí");
      mapa.setView([latActual, lngActual], 13);
    } else {
      marcadorVendedor.setLatLng([latActual, lngActual]);
    }

    // 🔥 AHORA SÍ se actualiza cada vez
    const snap = await getDocs(collection(db, "clientes"));

    let clientesPendientes = [];
    let clientesEntregados = [];

    snap.forEach(docSnap => {

      const c = docSnap.data();
      if (!c.ubicacion) return;

      const [lat, lng] = c.ubicacion.split(",").map(v => parseFloat(v.trim()));
      if (isNaN(lat) || isNaN(lng)) return;

      const clienteObj = {
        id: docSnap.id,
        nombre: c.nombre,
        direccion: c.direccion,
        lat,
        lng,
        entregado: c.entregado || false
      };

      if (clienteObj.entregado) {
        clientesEntregados.push(clienteObj);
      } else {
        clientesPendientes.push(clienteObj);
      }
    });

    // Optimizar solo pendientes
    const rutaOptimizada = optimizarRuta(latActual, lngActual, clientesPendientes);

    // Limpiar marcadores anteriores
    marcadoresClientes.forEach(m => mapa.removeLayer(m));
    marcadoresClientes = [];

    if (lineaRuta) mapa.removeLayer(lineaRuta);

    const iconoPendiente = L.icon({
      iconUrl: "https://maps.google.com/mapfiles/ms/icons/red-dot.png",
      iconSize: [32, 32]
    });

    const iconoEntregado = L.icon({
      iconUrl: "https://maps.google.com/mapfiles/ms/icons/grey-dot.png",
      iconSize: [32, 32]
    });

    const puntosRuta = [[latActual, lngActual]];

    // Dibujar pendientes
    rutaOptimizada.forEach(cliente => {

      const marcador = L.marker([cliente.lat, cliente.lng], { icon: iconoPendiente })
        .addTo(mapa)
        .bindPopup(`
          <strong>${cliente.nombre}</strong><br>
          ${cliente.direccion || ""}<br><br>
          <button onclick="marcarEntregado('${cliente.id}')">
            ✔ Marcar entregado
          </button>
        `);

      marcadoresClientes.push(marcador);
      puntosRuta.push([cliente.lat, cliente.lng]);
    });

    // Dibujar entregados en gris
    clientesEntregados.forEach(cliente => {

      const marcador = L.marker([cliente.lat, cliente.lng], { icon: iconoEntregado })
        .addTo(mapa)
        .bindPopup(`
          <strong>${cliente.nombre}</strong><br>
          ✅ Entregado
        `);

      marcadoresClientes.push(marcador);
    });

    if (puntosRuta.length > 1) {
      lineaRuta = L.polyline(puntosRuta, { color: "green" }).addTo(mapa);
    }

  }, (err) => {
    alert("Activa el GPS para usar la ruta");
  }, {
    enableHighAccuracy: true
  });

}

iniciarSistemaRuta();




// ================== MARCAR CLIENTE ENTREGADO ==================
window.marcarEntregado = async (idCliente) => {

  try {

    await updateDoc(doc(db, "clientes", idCliente), {
      entregado: true,
      fechaEntrega: Timestamp.now()
    });

    alert("✅ Cliente marcado como entregado");

  } catch (error) {

    console.error("Error al marcar entrega:", error);
    alert("❌ Error al marcar entrega");

  }

};






// ================== CARGAR CLIENTES ==================
async function cargarClientes() {
  clienteSelect.innerHTML = "<option value=''>Seleccione cliente</option>";
  const snap = await getDocs(collection(db, "clientes"));
  snap.forEach(docSnap => {
    const c = docSnap.data();
    if (c.vendedorId === vendedorId) {
      const opt = document.createElement("option");
      opt.value = docSnap.id;
      opt.textContent = `${c.nombre} (${c.telefono || "-"})`;
      clienteSelect.appendChild(opt);
    }
  });
}

// ================== CARGAR CLIENTES FILTRO ==================
async function cargarClientesFiltro() {
  filtroCliente.innerHTML = "<option value=''>Todos los clientes</option>";
  const snap = await getDocs(collection(db, "clientes"));
  snap.forEach(docSnap => {
    const c = docSnap.data();
    if (c.vendedorId === vendedorId) {
      const opt = document.createElement("option");
      opt.value = docSnap.id;
      opt.textContent = `${c.nombre} (${c.telefono || "-"})`;
      filtroCliente.appendChild(opt);
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
  document.getElementById("buscarClienteInput").disabled = true;
};

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
  if (carrito.length === 0) {
    clienteSelect.disabled = false;
    document.getElementById("buscarClienteInput").disabled = false;
  }
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
  document.getElementById("buscarClienteInput").disabled = false;
  document.getElementById("buscarClienteInput").value = "";
  document.getElementById("buscarProductoInput").value = "";
  diasConsignacionInput.value = "";

  alert("Pedido registrado con éxito");
};

// ================== CARGAR PEDIDOS (CON ESTADOS) ==================
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

// ================== BUSCADOR DINÁMICO (LA MEJORA) ==================
function configurarBuscadorCoincidencia(inputId, selectId) {
  const input = document.getElementById(inputId);
  const select = document.getElementById(selectId);
  if (!input || !select) return;

  input.addEventListener("input", () => {
    const filtro = input.value.toLowerCase();
    const opciones = select.options;
    let primeraEncontrada = -1;

    for (let i = 0; i < opciones.length; i++) {
      const texto = opciones[i].text.toLowerCase();
      const coincide = texto.includes(filtro);
      opciones[i].style.display = coincide ? "block" : "none";
      if (coincide && primeraEncontrada === -1 && filtro !== "") primeraEncontrada = i;
    }
    if (primeraEncontrada !== -1) select.selectedIndex = primeraEncontrada;
  });
}

// ================== IMPRIMIR TICKET REFORZADO 58MM (RESTAURADO) ==================
window.imprimirTicket = (venta) => {
  let fechaDoc = (venta.fecha && venta.fecha.seconds) ? new Date(venta.fecha.seconds * 1000) : new Date();
  const statusPago = (venta.estadoPago || "PENDIENTE").toUpperCase();
  const ticketID = (venta.id || "N/A").slice(-6).toUpperCase();

  const htmlTicket = `
    <div id="ticketImprimible" style="width: 48mm; margin: 0 auto; padding: 2mm; font-family: 'Arial Black', sans-serif; color: #000; background: #fff;">
      <div style="text-align:center; border-bottom: 4px solid #000; padding-bottom: 5px; margin-bottom: 8px;">
        <img src="imagenes/LOGO PRODIGO SUELO-01.png" style="width: 30mm; height: auto; filter: grayscale(100%) contrast(200%);">
        <p style="margin: 4px 0 0 0; font-size: 10px; font-weight: 900; text-transform: uppercase; background: #000; color: #fff; display: inline-block; padding: 2px 6px;">CAFÉ PRÓDIGO SUELO</p>
      </div>
      <div style="font-size: 12px; font-weight: 900; line-height: 1.3; border-bottom: 2px dashed #000; padding-bottom: 6px;">
        <p style="margin: 0;">FECHA: ${fechaDoc.toLocaleDateString()} ${fechaDoc.getHours()}:${String(fechaDoc.getMinutes()).padStart(2, '0')}</p>
        <p style="margin: 0;">TICKET: #${ticketID}</p>
        <p style="margin: 4px 0 0 0; font-size: 13px; text-transform: uppercase;">CLIENTE: ${venta.cliente.nombre}</p>
      </div>
      <table style="width:100%; margin-top: 8px; border-collapse: collapse;">
        <tbody style="font-size: 12px; font-weight: 900;">
          ${venta.lineas.map(l => `
            <tr><td colspan="2" style="padding-top: 6px; text-transform: uppercase;">${l.nombre}</td></tr>
            <tr style="border-bottom: 1px solid #eee;">
              <td style="font-size: 11px;">${l.cantidad} x ₡${l.precio.toLocaleString()}</td>
              <td style="text-align:right; font-size: 13px;">₡${l.subtotal.toLocaleString()}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div style="margin-top: 10px; border-top: 3px solid #000; padding-top: 6px; text-align: right;">
        <p style="margin: 0; font-size: 18px; font-weight: 900;">TOTAL: ₡${venta.total.toLocaleString()}</p>
      </div>
      <div style="text-align:center; background: #000; color: #fff; margin-top: 15px; padding: 6px;">
        <span style="font-size: 14px; font-weight: 900;">PAGO: ${statusPago}</span>
      </div>
      <div style="text-align:center; margin-top: 20px; font-size: 10px; font-weight: 900;">
        <p>¡GRACIAS POR APOYAR LO NUESTRO!</p>
        <p>COSTA RICA</p>
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

// BUSCAR PEDIDOS ANTIGUOS
btnBuscarPedidos.onclick = async () => {
  const clienteId = filtroCliente.value;
  const snap = await getDocs(collection(db,"ventas"));
  resultadosPedidos.innerHTML = "";
  snap.forEach(docSnap => {
    const venta = docSnap.data();
    if(clienteId && venta.cliente.id !== clienteId) return;
    const card = document.createElement("div");
    card.className = `card estado-${venta.estado.replace(' ','-')}`;
    card.innerHTML = `
      <p><strong>Cliente:</strong> ${venta.cliente.nombre}</p>
      <p><strong>Total:</strong> ₡${venta.total.toLocaleString()}</p>
      <button onclick='imprimirTicket(${JSON.stringify({...venta, id: docSnap.id})})'>Reimprimir</button>
    `;
    resultadosPedidos.appendChild(card);
  });
};


