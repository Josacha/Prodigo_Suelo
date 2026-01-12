import { updateDoc, doc }
from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { db } from "./firebase.js";

async function cambiarEstado(id, estado) {
  await updateDoc(doc(db, "pedidos", id), { estado });
}
