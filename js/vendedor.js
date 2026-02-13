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
  iniciarSistemaRuta();

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
// Dibuja Ruta
// ===================

async function dibujarRutaReal(mapa, puntos) {

  const coordenadas = puntos
    .map(p => `${p[1]},${p[0]}`)
    .join(";");

  const url = `https://router.project-osrm.org/route/v1/driving/${coordenadas}?overview=full&geometries=geojson`;

  const respuesta = await fetch(url);
  const data = await respuesta.json();

  if (!data.routes || data.routes.length === 0) return;

  const ruta = data.routes[0];

  alert(`🚗 Distancia: ${(ruta.distance / 1000).toFixed(2)} km
⏱ Tiempo estimado: ${(ruta.duration / 60).toFixed(0)} minutos`);

  return L.geoJSON(ruta.geometry, {
    style: {
      color: "green",
      weight: 5
    }
  }).addTo(mapa);
}









// =====================
// Calcular Distancia
// =====================

function calcularDistancia(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

function optimizarRuta(miLat, miLng, clientes) {

  let rutaOrdenada = [];
  let pendientes = [...clientes];

  let latActual = miLat;
  let lngActual = miLng;

  while (pendientes.length > 0) {

    let menorDistancia = Infinity;
    let indiceMasCercano = 0;

    pendientes.forEach((cliente, index) => {

      const distancia = calcularDistancia(
        latActual,
        lngActual,
        cliente.lat,
        cliente.lng
      );

      if (distancia < menorDistancia) {
        menorDistancia = distancia;
        indiceMasCercano = index;
      }

    });

    const siguiente = pendientes.splice(indiceMasCercano, 1)[0];

    rutaOrdenada.push(siguiente);

    latActual = siguiente.lat;
    lngActual = siguiente.lng;
  }

  return rutaOrdenada;
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
  let marcadoresClientes = [];
  let lineaRuta;
  let miLat = null;
  let miLng = null;
  let clientesListosGlobal = [];

  // ================= ICONOS =================

  const iconoNormal = L.icon({
    iconUrl: "https://maps.google.com/mapfiles/ms/icons/red-dot.png",
    iconSize: [32, 32]
  });

  const iconoListo = L.icon({
    iconUrl: "https://maps.google.com/mapfiles/ms/icons/green-dot.png",
    iconSize: [32, 32]
  });

  const iconoMasCercano = L.icon({
    iconUrl: "https://maps.google.com/mapfiles/ms/icons/blue-dot.png",
    iconSize: [32, 32]
  });

  const iconoVan = L.icon({
    iconUrl: "imagenes/van.png",
    iconSize: [45, 45],
    iconAnchor: [22, 45]
  });

  // ================= RUTA REAL =================

  async function dibujarRutaReal(puntos) {

    if (!miLat || !miLng) return;

    if (lineaRuta) mapa.removeLayer(lineaRuta);

    const coordenadas = puntos
      .map(p => `${p[1]},${p[0]}`)
      .join(";");

    const url = `https://router.project-osrm.org/route/v1/driving/${coordenadas}?overview=full&geometries=geojson`;

    try {

      const res = await fetch(url);
      const data = await res.json();

      if (!data.routes || data.routes.length === 0) return;

      const ruta = data.routes[0];

      lineaRuta = L.geoJSON(ruta.geometry, {
        style: { color: "green", weight: 5 }
      }).addTo(mapa);

      const km = (ruta.distance / 1000).toFixed(2);
      const minutos = (ruta.duration / 60).toFixed(0);

      console.log(`🚗 ${km} km | ⏱ ${minutos} min`);

      // Puedes mostrarlo en un div si quieres
      const infoRuta = document.getElementById("infoRuta");
      if (infoRuta) {
        infoRuta.innerHTML = `🚗 ${km} km | ⏱ ${minutos} min`;
      }

    } catch (err) {
      console.error("Error OSRM:", err);
    }
  }

  // ================= RECALCULAR RUTA AUTOMÁTICA =================

  async function recalcularRutaOptimizada() {

    if (!miLat || !miLng) return;
    if (clientesListosGlobal.length === 0) return;

    const rutaOrdenada = optimizarRuta(miLat, miLng, clientesListosGlobal);

    const masCercano = rutaOrdenada[0];

    marcadoresClientes.forEach(m => {
      const pos = m.getLatLng();
      if (pos.lat === masCercano.lat && pos.lng === masCercano.lng) {
        m.setIcon(iconoMasCercano);
      }
    });

    const puntos = [
      [miLat, miLng],
      ...rutaOrdenada.map(c => [c.lat, c.lng])
    ];

    await dibujarRutaReal(puntos);
  }

  // ================= ESCUCHAR VENTAS =================

  onSnapshot(
    query(collection(db, "ventas"), where("vendedorId", "==", vendedorId)),
    async (snapVentas) => {

      if (!miLat || !miLng) return;

      const snapClientes = await getDocs(collection(db, "clientes"));

      marcadoresClientes.forEach(m => mapa.removeLayer(m));
      marcadoresClientes = [];

      const mapaUltimaVenta = {};
      clientesListosGlobal = [];

      snapVentas.forEach(docSnap => {

        const venta = docSnap.data();
        const clienteId = venta.cliente?.id;

        if (!clienteId) return;

        if (
          !mapaUltimaVenta[clienteId] ||
          venta.fecha.toDate() > mapaUltimaVenta[clienteId].fecha
        ) {
          mapaUltimaVenta[clienteId] = {
            estado: venta.estado,
            fecha: venta.fecha.toDate()
          };
        }

      });

      snapClientes.forEach(docSnap => {

        const c = docSnap.data();

        if (c.vendedorId !== vendedorId) return;
        if (!c.ubicacion) return;

        const [lat, lng] = c.ubicacion.split(",").map(v => parseFloat(v.trim()));
        if (isNaN(lat) || isNaN(lng)) return;

        const ventaInfo = mapaUltimaVenta[docSnap.id];
        const estadoFinal = ventaInfo ? ventaInfo.estado : "sinVenta";

        let iconoUsar = iconoNormal;

        if (estadoFinal === "listo") {
          clientesListosGlobal.push({
            id: docSnap.id,
            nombre: c.nombre,
            lat,
            lng
          });
          iconoUsar = iconoListo;
        }

        const marcador = L.marker([lat, lng], { icon: iconoUsar })
          .addTo(mapa)
          .bindPopup(`<strong>${c.nombre}</strong><br>Estado: ${estadoFinal}`);

        // 🔥 SI HACES CLICK EN EL CLIENTE → RUTA DIRECTA
        marcador.on("click", async () => {
          await dibujarRutaReal([
            [miLat, miLng],
            [lat, lng]
          ]);
        });

        marcadoresClientes.push(marcador);

      });

      await recalcularRutaOptimizada();

    }
  );

  // ================= GPS =================

  navigator.geolocation.watchPosition(async (pos) => {

    miLat = pos.coords.latitude;
    miLng = pos.coords.longitude;

    if (!marcadorVendedor) {

      marcadorVendedor = L.marker([miLat, miLng], { icon: iconoVan })
        .addTo(mapa)
        .bindPopup("🚐 Ruta de reparto");

      mapa.setView([miLat, miLng], 13);

    } else {

      marcadorVendedor.setLatLng([miLat, miLng]);

    }

    // 🔥 RECALCULA CADA VEZ QUE TE MUEVES
    await recalcularRutaOptimizada();

  }, () => {

    alert("Activa el GPS");

  }, {
    enableHighAccuracy: true
  });

}






// ================== MARCAR CLIENTE ENTREGADO ==================
window.marcarEntregado = async (ventaId) => {

  try {

    await updateDoc(doc(db, "ventas", ventaId), {
      estado: "entregado"
    });

    alert("✅ Pedido marcado como entregado");

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








