import { auth, db } from "./firebase.js";
import { collection, onSnapshot, getDoc, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const pedidosContainer = document.getElementById("pedidosContainer");
const alertSound = new Audio("audio/alerta.mp3"); // sonido notificación

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

function cargarPedidos(){
  const ventasRef = collection(db, "ventas");

  onSnapshot(ventasRef, snapshot => {
    pedidosContainer.innerHTML = "";

    snapshot.forEach(async docSnap => {
      const pedido = docSnap.data();
      const pedidoId = docSnap.id;

      // solo mostrar pedidos del vendedor actual
      if(pedido.vendedorId !== auth.currentUser.uid) return;

      const card = document.createElement("div");
      card.className = `card estado-${pedido.estado || 'entrante'}`;
      card.id = `pedido-${pedidoId}`;

      const lineasHTML = pedido.lineas.map(l=>`<li>${l.nombre} x ${l.cantidad} = ₡${l.subtotal}</li>`).join("");

      card.innerHTML = `
        <p><strong>${getEstadoIcon(pedido.estado)} Cliente:</strong> ${pedido.cliente.nombre}</p>
        <p><strong>Total:</strong> ₡${pedido.total}</p>
        <ul>${lineasHTML}</ul>

        <label>Estado:</label>
        <select id="estado-${pedidoId}">
          <option value="listo" ${pedido.estado==='listo'?'selected':''}>Listo</option>
          <option value="entregado" ${pedido.estado==='entregado'?'selected':''}>Entregado</option>
        </select>

        <button onclick="actualizarEstadoVendedor('${pedidoId}')">Actualizar</button>
      `;

      pedidosContainer.appendChild(card);

      // notificación si el pedido pasó a LISTO
      if(pedido.estado === "listo" && !card.dataset.notificado){
        alertSound.play();
        card.dataset.notificado = true;

        // Notificación de navegador
        if("Notification" in window && Notification.permission === "granted"){
          new Notification(`Pedido listo: ${pedido.cliente.nombre}`, { body: "Revisa el pedido para entregar." });
        } else if("Notification" in window && Notification.permission !== "denied"){
          Notification.requestPermission().then(p => {
            if(p==="granted") new Notification(`Pedido listo: ${pedido.cliente.nombre}`, { body: "Revisa el pedido para entregar." });
          });
        }
      }
    });
  });
}

window.actualizarEstadoVendedor = async (pedidoId) => {
  const estadoSelect = document.getElementById(`estado-${pedidoId}`);
  const nuevoEstado = estadoSelect.value;

  // El vendedor solo puede cambiar "listo" → "entregado"
  const pedidoDoc = await getDoc(doc(db,"ventas",pedidoId));
  const estadoActual = pedidoDoc.data().estado;
  if(estadoActual !== "listo" && nuevoEstado === "entregado") {
    alert("Solo se puede marcar como entregado desde LISTO");
    return;
  }

  await updateDoc(doc(db,"ventas",pedidoId), { estado: nuevoEstado });
};
