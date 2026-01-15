import { auth, db } from "./firebase.js";
import { collection, onSnapshot, updateDoc, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const colEntrante  = document.getElementById("col-entrante");
const colProceso   = document.getElementById("col-proceso");
const colListo     = document.getElementById("col-listo");
const colAtrasado  = document.getElementById("col-atrasado");

const alertSound = new Audio("audio/alerta.mp3");

// pedidos ya notificados (persistente aunque recargue)
const pedidosNotificados = JSON.parse(localStorage.getItem("pedidosNotificados") || "[]");

onAuthStateChanged(auth, user => {
  if (!user) location.href = "index.html";
  cargarPedidos();
});

document.getElementById("logoutBtn").onclick = async () => {
  await signOut(auth);
  location.href = "index.html";
};

function getEstadoIcon(estado){
  switch(estado){
    case 'entrante': return '🚀';
    case 'en proceso': return '⚙️';
    case 'listo': return '✅';
    case 'atrasado': return '⏰';
    case 'entregado': return '📦';
    default: return '';
  }
}

function cargarPedidos() {
  const ventasRef = collection(db, "ventas");

  onSnapshot(ventasRef, snapshot => {
    colEntrante.innerHTML = "";
    colProceso.innerHTML = "";
    colListo.innerHTML = "";
    colAtrasado.innerHTML = "";


    snapshot.forEach(async docSnap => {
      const pedido = docSnap.data();
      const pedidoId = docSnap.id;

      // 👉 PLANTA NO MANEJA ENTREGADOS
      if (pedido.estado === "entregado") return;

      // vendedor
      let vendedorNombre = "Desconocido";
      if (pedido.vendedorId) {
        const vendedorDoc = await getDoc(doc(db, "usuarios", pedido.vendedorId));
        vendedorNombre = vendedorDoc.exists() ? vendedorDoc.data().nombre : "Desconocido";
      }

      const card = document.createElement("div");
      card.className = `card estado-${pedido.estado || 'entrante'}`;

      const lineasHTML = pedido.lineas
        .map(l => `<li>${l.nombre} x ${l.cantidad} = ₡${l.subtotal}</li>`)
        .join("");

      card.innerHTML = `
        <p><strong>${getEstadoIcon(pedido.estado)} Cliente:</strong> ${pedido.cliente.nombre}</p>
        <p><strong>Vendedor:</strong> ${vendedorNombre}</p>
        <p><strong>Total:</strong> ₡${pedido.total}</p>
        <ul>${lineasHTML}</ul>

        <label>Estado:</label>
        <select id="estado-${pedidoId}">
          <option value="entrante" ${pedido.estado==='entrante'?'selected':''}>Entrante</option>
          <option value="en proceso" ${pedido.estado==='en proceso'?'selected':''}>En Proceso</option>
          <option value="listo" ${pedido.estado==='listo'?'selected':''}>Listo</option>
          <option value="atrasado" ${pedido.estado==='atrasado'?'selected':''}>Atrasado</option>
        </select>

        <input type="text" id="comentario-${pedidoId}"
          placeholder="Motivo atraso"
          value="${pedido.comentario || ''}"
          ${pedido.estado!=='atrasado'?'disabled':''}>

        <button onclick="actualizarEstadoPlanta('${pedidoId}')">Actualizar</button>
      `;

      switch (pedido.estado) {
  case "entrante":
    colEntrante.appendChild(card);
    break;
  case "en proceso":
    colProceso.appendChild(card);
    break;
  case "listo":
    colListo.appendChild(card);
    break;
  case "atrasado":
    colAtrasado.appendChild(card);
    break;
}


      // 🔊 SONIDO SOLO LA PRIMERA VEZ QUE ENTRA
      if (pedido.estado === "entrante" && !pedidosNotificados.includes(pedidoId)) {
        alertSound.play();

        pedidosNotificados.push(pedidoId);
        localStorage.setItem("pedidosNotificados", JSON.stringify(pedidosNotificados));
      }

      // 🔔 NOTIFICACIÓN VISUAL (SIEMPRE)
      if (pedido.estado === "entrante") {
        mostrarNotificacion(pedido.cliente.nombre);
      }
    });
  });
}

function mostrarNotificacion(cliente) {
  if (!("Notification" in window)) return;

  if (Notification.permission === "granted") {
    new Notification("📦 Pedido Entrante", {
      body: `Nuevo pedido de ${cliente}`
    });
  } else if (Notification.permission !== "denied") {
    Notification.requestPermission().then(p => {
      if (p === "granted") {
        new Notification("📦 Pedido Entrante", {
          body: `Nuevo pedido de ${cliente}`
        });
      }
    });
  }
}

function mostrarPopupPedido(pedido) {
  document.getElementById("popupCliente").innerText =
    `Cliente: ${pedido.cliente.nombre}`;

  document.getElementById("popupTotal").innerText =
    `Total: ₡${pedido.total}`;

  const ul = document.getElementById("popupProductos");
  ul.innerHTML = "";

  pedido.lineas.forEach(l => {
    const li = document.createElement("li");
    li.textContent = `${l.nombre} x ${l.cantidad}`;
    ul.appendChild(li);
  });

  document.getElementById("popupPedido").className = "popup-visible";
}

window.cerrarPopup = () => {
  document.getElementById("popupPedido").className = "popup-oculto";
};


window.actualizarEstadoPlanta = async (pedidoId) => {
  const estadoSelect = document.getElementById(`estado-${pedidoId}`);
  const comentarioInput = document.getElementById(`comentario-${pedidoId}`);
  const nuevoEstado = estadoSelect.value;

  comentarioInput.disabled = nuevoEstado !== 'atrasado';

  await updateDoc(doc(db, "ventas", pedidoId), {
    estado: nuevoEstado,
    comentario: nuevoEstado === 'atrasado' ? comentarioInput.value : ''
  });
};


