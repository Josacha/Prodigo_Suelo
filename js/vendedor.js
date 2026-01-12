import { addDoc, collection, serverTimestamp }
from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { db, auth } from "./firebase.js";

async function crearPedido(data) {
  await addDoc(collection(db, "pedidos"), {
    ...data,
    vendedorId: auth.currentUser.uid,
    estado: "pendiente",
    fecha: serverTimestamp(),
    facturaNumero: "",
    facturaLink: ""
  });
}
