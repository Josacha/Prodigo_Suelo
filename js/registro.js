 import { db } from "./firebase.js";
import {
  collection, getDocs, query, where, Timestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const tabla = document.getElementById("tablaRegistros");
const clienteFiltro = document.getElementById("clienteFiltro");
const vendedorFiltro = document.getElementById("vendedorFiltro");

const kpiVentas = document.getElementById("kpiTotalVentas");
const kpiKg = document.getElementById("kpiKg");
const kpiPedidos = document.getElementById("kpiPedidos");

// ============================
// CARGAR FILTROS
// ============================
async function cargarFiltros() {
  const clientes = await getDocs(collection(db,"clientes"));
  clientes.forEach(d=>{
    const c = d.data();
    clienteFiltro.innerHTML += `<option value="${d.id}">${c.nombre}</option>`;
  });

  const vendedores = await getDocs(collection(db,"usuarios"));
  vendedores.forEach(d=>{
    const v = d.data();
    vendedorFiltro.innerHTML += `<option value="${d.id}">${v.nombre}</option>`;
  });
}
cargarFiltros();

// ============================
// FILTRAR REGISTROS
// ============================
document.getElementById("btnFiltrar").onclick = async () => {

  tabla.innerHTML = "";
  let totalVentas = 0;
  let totalKg = 0;
  let totalPedidos = 0;

  const inicio = document.getElementById("fechaInicio").value;
  const fin = document.getElementById("fechaFin").value;

  let q = collection(db,"ventas");

  if(inicio && fin){
    q = query(
      q,
      where("fecha",">=", Timestamp.fromDate(new Date(inicio))),
      where("fecha","<=", Timestamp.fromDate(new Date(fin+"T23:59:59")))
    );
  }

  const snap = await getDocs(q);

  snap.forEach(docSnap=>{
    const v = docSnap.data();

    if(clienteFiltro.value && v.cliente.id !== clienteFiltro.value) return;
    if(vendedorFiltro.value && v.vendedorId !== vendedorFiltro.value) return;

    totalPedidos++;
    totalVentas += Number(v.total || 0);

    if(Array.isArray(v.lineas)){
      v.lineas.forEach(l=>{
        totalKg += (Number(l.peso) * Number(l.cantidad)) / 1000;
      });
    }

    tabla.innerHTML += `
      <tr>
        <td>${new Date(v.fecha.seconds*1000).toLocaleDateString()}</td>
        <td>${v.cliente.nombre}</td>
        <td>${v.vendedorId}</td>
        <td>${totalKg.toFixed(2)}</td>
        <td>₡${v.total.toLocaleString()}</td>
        <td>${v.estado}</td>
      </tr>
    `;
  });

  kpiVentas.textContent = `₡${totalVentas.toLocaleString()}`;
  kpiKg.textContent = `${totalKg.toFixed(2)} kg`;
  kpiPedidos.textContent = totalPedidos;
};
