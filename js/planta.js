import { auth, db } from "./firebase.js";
import {
  collection, onSnapshot, updateDoc, doc, getDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const pedidosContainer = document.getElementById("pedidosContainer");
const alertSound = document.getElementById("alertSound");

// =====================
// Protección y logout
// =====================
onAuthStateChanged(auth, async user => {
  if(!user) location.href = "index.html";
  cargarPedidos();
});

document.getElementById("logoutBtn").onclick = async () => {
  await signOut(auth);
  location.href = "index.html";
};

// =====================
// Cargar pedidos en tiempo real
// =====================
function cargarPedidos() {
  const ventasRef = collection(db, "ventas");

  onSnapshot(ventasRef, async snapshot => {
    pedidosContainer.innerHTML = "";

    snapshot.forEach(async docSnap => {
      const pedido = docSnap.data();
      const pedidoId = docSnap.id;

      // Obtener nombre del vendedor
      const vendedorDoc = await getDoc(doc(db, "usuarios", pedido.vendedorId));
      const vendedorNombre = vendedorDoc.exists() ? vendedorDoc.data().nombre : "N/A";

      // Crear card del pedido
      const card = document.createElement("div");
      card.className = "card";
      card.id = `pedido-${pedidoId}`;

      const lineasHTML = pedido.lineas.map(l => `<li>${l.nombre} x ${l.cantidad} = ₡${l.subtotal}</li>`).join("");

      card.innerHTML = `
        <p><strong>Cliente:</strong> ${pedido.cliente.nombre}</p>
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

        <input type="text" id="comentario-${pedidoId}" placeholder="Motivo atraso" value="${pedido.comentario || ''}" ${pedido.estado!=='atrasado'?'disabled':''}>

        <button onclick="actualizarEstado('${pedidoId}')">Actualizar</button>
      `;

      pedidosContainer.appendChild(card);

      // Reproducir alerta si es un pedido nuevo (entrante)
      if(pedido.estado==='entrante' && !card.dataset.alertShown){
        alert(`Nuevo pedido de ${pedido.cliente.nombre}`);
        alertSound.play();
        card.dataset.alertShown = true;
      }
    });
  });
}

// =====================
// Actualizar estado
// =====================
window.actualizarEstado = async (pedidoId) => {
  const estadoSelect = document.getElementById(`estado-${pedidoId}`);
  const comentarioInput = document.getElementById(`comentario-${pedidoId}`);

  const nuevoEstado = estadoSelect.value;
  const comentario = comentarioInput.value;

  // Habilitar input solo si es atrasado
  comentarioInput.disabled = nuevoEstado !== 'atrasado';

  await updateDoc(doc(db, "ventas", pedidoId), {
    estado: nuevoEstado,
    comentario: nuevoEstado==='atrasado' ? comentario : ''
  });

  // Si está listo, mostrar alerta al vendedor (puedes luego hacer push notification)
  if(nuevoEstado==='listo'){
    alert(`Pedido ${pedidoId} listo para entrega`);
  }
};
