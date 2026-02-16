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




// ================== ACTUALIZACIÓN DIARIA CLIENTES ==================
async function actualizarClientesSiEsNuevoDia() {

  const hoy = new Date().toISOString().split("T")[0];
  const ultimaActualizacion = localStorage.getItem("clientesFechaActualizacion");

  if (ultimaActualizacion === hoy) {
    console.log("Clientes ya actualizados hoy");
    return;
  }

  console.log("Actualizando clientes del día...");

  const snap = await getDocs(collection(db, "clientes"));

  const clientes = snap.docs
    .map(doc => ({
      id: doc.id,
      ...doc.data()
    }))
    .filter(c => c.vendedorId === vendedorId && c.ubicacion);

  localStorage.setItem("clientesCache", JSON.stringify(clientes));
  localStorage.setItem("clientesFechaActualizacion", hoy);

  console.log("Clientes guardados en cache");
}

// ================== OBTENER CLIENTES DESDE CACHE ==================
function obtenerClientesDesdeCache() {
  const data = localStorage.getItem("clientesCache");
  return data ? JSON.parse(data) : [];
}


// =====================
// MAPA + RUTA INTELIGENTE
// =====================
async function iniciarSistemaRuta() {

  await actualizarClientesSiEsNuevoDia();
  const clientes = obtenerClientesDesdeCache();

  const mapa = L.map("mapaRuta");

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors"
  }).addTo(mapa);

  let marcadorVendedor = null;
  let lineaRuta = null;
  let miLat = null;
  let miLng = null;
  let clientesSeleccionados = [];

  const panel = document.getElementById("panelRuta");

  // ================= ICONOS =================
  const iconoVan = L.icon({
    iconUrl: "./imagenes/van.png",
    iconSize: [45, 45],
    iconAnchor: [22, 45],
    popupAnchor: [0, -40]
  });

  const iconoAzul = L.icon({
    iconUrl: "https://maps.google.com/mapfiles/ms/icons/blue-dot.png",
    iconSize: [32, 32]
  });

  // ================== SEGUIMIENTO ON/OFF ==================
  let seguimientoActivo = true;
  let estoyMoviendoMapaConDedo = false;

  // Si el usuario mueve el mapa, se desactiva el seguimiento
  mapa.on("dragstart", () => {
    estoyMoviendoMapaConDedo = true;
    seguimientoActivo = false;
  });
  mapa.on("zoomstart", () => {
    estoyMoviendoMapaConDedo = true;
    seguimientoActivo = false;
  });
  mapa.on("dragend", () => setTimeout(() => (estoyMoviendoMapaConDedo = false), 250));
  mapa.on("zoomend", () => setTimeout(() => (estoyMoviendoMapaConDedo = false), 250));

  // Botón para centrar y volver a seguir
  const controlSeguir = L.control({ position: "topleft" });
  controlSeguir.onAdd = function () {
    const div = L.DomUtil.create("div", "leaflet-bar");
    div.style.background = "#fff";
    div.style.borderRadius = "8px";
    div.style.padding = "6px";
    div.style.boxShadow = "0 2px 8px rgba(0,0,0,.25)";
    div.style.cursor = "pointer";
    div.title = "Centrar y seguir mi ubicación";
    div.innerHTML = "📍 Seguir";

    // Evita que al tocar el botón también se arrastre el mapa
    L.DomEvent.disableClickPropagation(div);

    div.onclick = () => {
      seguimientoActivo = true;
      if (miLat && miLng) {
        mapa.setView([miLat, miLng], Math.max(mapa.getZoom(), 15), { animate: true });
      }
    };

    return div;
  };
  controlSeguir.addTo(mapa);

  // ================= PANEL =================
  function actualizarPanel(datos) {
    if (!panel) return;
    panel.innerHTML = `
      <strong>Siguiente parada:</strong><br>
      📍 ${(datos.distSiguiente / 1000).toFixed(2)} km<br>
      ⏱ ${(datos.tiempoSiguiente / 60).toFixed(0)} min<br><br>
      <strong>Ruta total:</strong><br>
      📏 ${(datos.distTotal / 1000).toFixed(2)} km<br>
      🕒 ${(datos.tiempoTotal / 60).toFixed(0)} min
    `;
  }

  // ================= RUTA =================
  async function dibujarRuta() {
    if (!miLat || clientesSeleccionados.length === 0) {
      if (lineaRuta) mapa.removeLayer(lineaRuta);
      if (panel) panel.innerHTML = "Sin ruta activa";
      return;
    }

    const puntos = [
      [miLat, miLng],
      ...clientesSeleccionados.map(c => [c.lat, c.lng])
    ];

    const coordenadas = puntos.map(p => `${p[1]},${p[0]}`).join(";");
    const url = `https://router.project-osrm.org/route/v1/driving/${coordenadas}?overview=full&geometries=geojson`;

    try {
      const respuesta = await fetch(url);
      const data = await respuesta.json();
      if (!data.routes || data.routes.length === 0) return;

      if (lineaRuta) mapa.removeLayer(lineaRuta);

      const ruta = data.routes[0];
      lineaRuta = L.geoJSON(ruta.geometry, {
        style: { color: "lime", weight: 6 }
      }).addTo(mapa);

      const distTotal = ruta.distance;
      const tiempoTotal = ruta.duration;
      const primerLeg = ruta.legs?.[0] || { distance: 0, duration: 0 };

      actualizarPanel({
        distTotal,
        tiempoTotal,
        distSiguiente: primerLeg.distance,
        tiempoSiguiente: primerLeg.duration
      });

    } catch (error) {
      console.error("Error calculando ruta:", error);
    }
  }

  // ================= CLIENTES =================
  clientes.forEach(c => {
    let lat, lng;

    if (typeof c.ubicacion === "string") {
      const partes = c.ubicacion.split(",");
      if (partes.length !== 2) return;
      lat = parseFloat(partes[0].trim());
      lng = parseFloat(partes[1].trim());
    } else if (typeof c.ubicacion === "object") {
      lat = c.ubicacion.latitude;
      lng = c.ubicacion.longitude;
    }

    if (!lat || !lng || isNaN(lat) || isNaN(lng)) return;

    const cliente = { id: c.id, nombre: c.nombre, lat, lng };

    const marcador = L.marker([lat, lng], { icon: iconoAzul })
      .addTo(mapa)
      .bindTooltip(c.nombre, {
        permanent: true,
        direction: "top",
        offset: [0, -20],
        className: "tooltip-cliente"
      });

    marcador.on("click", async () => {
      const index = clientesSeleccionados.findIndex(cl => cl.id === cliente.id);

      if (index === -1) {
        clientesSeleccionados.push(cliente);
        marcador.setOpacity(0.6);
      } else {
        clientesSeleccionados.splice(index, 1);
        marcador.setOpacity(1);
      }

      await dibujarRuta();
    });
  });

  // ================= GPS EN TIEMPO REAL =================
  navigator.geolocation.watchPosition(async (pos) => {

    miLat = pos.coords.latitude;
    miLng = pos.coords.longitude;

    if (!marcadorVendedor) {
      marcadorVendedor = L.marker([miLat, miLng], { icon: iconoVan }).addTo(mapa);

      // primera vez: sí centramos
      mapa.setView([miLat, miLng], 15);

    } else {
      marcadorVendedor.setLatLng([miLat, miLng]);

      // ✅ SOLO centramos si el seguimiento está activo
      // y el usuario NO está moviendo el mapa manualmente
      if (seguimientoActivo && !estoyMoviendoMapaConDedo) {
        mapa.panTo([miLat, miLng], { animate: true });
      }
    }

    await dibujarRuta();

  }, () => {
    alert("Activa el GPS para usar la ruta");
  }, { enableHighAccuracy: true });

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
    
