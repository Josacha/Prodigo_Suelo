import { auth, db } from "./firebase.js";
import { collection, onSnapshot, updateDoc, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const pedidosContainer = document.getElementById("pedidosContainer");
const alertSound = document.getElementById("alertSound");

onAuthStateChanged(auth, async user => {
  if(!user) location.href = "index.html";
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
    pedidosContainer.innerHTML = "";

    snapshot.forEach(async docSnap => {
      const pedido = docSnap.data();
      const pedidoId = docSnap.id;

      // Mostrar todos los pedidos, incluso atrasados y listos
      const card = document.createElement("div");
      card.className = `card estado-${pedido.estado || 'entrante'}`;
      card.id = `pedido-${pedidoId}`;

      const lineasHTML = pedido.lineas.map(l => `<li>${l.nombre} x ${l.cantidad} = ₡${l.subtotal}</li>`).join("");

      card.innerHTML = `
        <p><strong>${getEstadoIcon(pedido.estado)} Cliente:</strong> ${pedido.cliente.nombre}</p>
        <p><strong>Vendedor:</strong> ${pedido.vendedorId}</p>
        <p><strong>Total:</strong> ₡${pedido.total}</p>
        <ul>${lineasHTML}</ul>

        <label>Estado:</label>
        <select id="estado-${pedidoId}">
          <option value="entrante" ${pedido.estado==='entrante'?'selected':''}>Entrante</option>
          <option value="en proceso" ${pedido.estado==='en proceso'?'selected':''}>En Proceso</option>
          <option value="listo" ${pedido.estado==='listo'?'selected':''}>Listo</option>
          <option value="atrasado" ${pedido.estado==='atrasado'?'selected':''}>Atrasado</option>
        </select>

        <input type="text" id="comentario-${pedidoId}" placeholder="Motivo atraso" value="${pedido.comentario || ''}" ${pedido.estado!=='atrasado'?'disabled':''}>
        <button onclick="actualizarEstadoPlanta('${pedidoId}')">Actualizar</button>
      `;

      pedidosContainer.appendChild(card);

      // Generar notificación sonora y alerta para el vendedor si el estado cambia a LISTO
      if(pedido.estado==='listo' && !card.dataset.notificado){
        alertSound.play();
        card.dataset.notificado = true;

        // También se puede usar notificaciones del navegador:
        if("Notification" in window && Notification.permission === "granted"){
          new Notification(`Pedido listo: ${pedido.cliente.nombre}`, { body: "El pedido está listo para entregar." });
        } else if("Notification" in window && Notification.permission !== "denied"){
          Notification.requestPermission().then(permission => {
            if(permission === "granted"){
              new Notification(`Pedido listo: ${pedido.cliente.nombre}`, { body: "El pedido está listo para entregar." });
            }
          });
        }
      }
    });
  });
}

window.actualizarEstadoPlanta = async (pedidoId) => {
  const estadoSelect = document.getElementById(`estado-${pedidoId}`);
  const comentarioInput = document.getElementById(`comentario-${pedidoId}`);
  const nuevoEstado = estadoSelect.value;
  const comentario = comentarioInput.value;

  comentarioInput.disabled = nuevoEstado !== 'atrasado';

  await updateDoc(doc(db, "ventas", pedidoId), {
    estado: nuevoEstado,
    comentario: nuevoEstado==='atrasado' ? comentario : ''
  });
};
