import { auth, db } from "./firebase.js";
import {
  collection, getDocs, addDoc, doc, getDoc,
  updateDoc, deleteDoc, query, where, Timestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

document.addEventListener("DOMContentLoaded", () => {

  let editId = null;
  let editClienteId = null;
  let chartInstance = null;

  // =======================
  // ELEMENTOS DASHBOARD
  // =======================
  const kpiVentas = document.getElementById("kpiVentas");
  const kpiKg = document.getElementById("kpiKg");
  const kpiPedidos = document.getElementById("kpiPedidos");
  const kpiEntrantes = document.getElementById("kpiEntrantes");
  const estadoProduccion = document.getElementById("estadoProduccion");

  // =======================
  // AUTH
  // =======================
  onAuthStateChanged(auth, async (user) => {
    if (!user) location.href = "index.html";
    await cargarDashboard();
    await cargarGraficaMensual();
  });

  // =======================
  // DASHBOARD (KPIs + PRODUCCIÓN)
  // =======================
  async function cargarDashboard() {
    const snap = await getDocs(collection(db, "ventas"));

    let totalVentas = 0;
    let totalKg = 0;
    let pedidosMes = 0;

    let estados = {
      entrante: 0,
      "en proceso": 0,
      listo: 0,
      atrasado: 0
    };

    const hoy = new Date();
    const mesActual = hoy.getMonth();
    const anioActual = hoy.getFullYear();

    snap.forEach(docSnap => {
      const v = docSnap.data();
      const fecha = v.fecha?.toDate ? v.fecha.toDate() : new Date(v.fecha);

      totalVentas += Number(v.total || 0);

      if (
        fecha.getMonth() === mesActual &&
        fecha.getFullYear() === anioActual
      ) {
        pedidosMes++;
      }

      if (estados[v.estado] !== undefined) {
        estados[v.estado]++;
      }

      if (Array.isArray(v.lineas)) {
        v.lineas.forEach(l => {
          const peso = Number(l.peso);
          const cantidad = Number(l.cantidad);
          if (!isNaN(peso) && !isNaN(cantidad)) {
            totalKg += (peso * cantidad) / 1000;
          }
        });
      }
    });

    kpiVentas.textContent = `₡${totalVentas.toLocaleString()}`;
    kpiKg.textContent = `${totalKg.toFixed(2)} kg`;
    kpiPedidos.textContent = pedidosMes;
    kpiEntrantes.textContent = estados.entrante;

    estadoProduccion.innerHTML = `
      <div class="estado-box entrante">Entrantes<br>${estados.entrante}</div>
      <div class="estado-box proceso">En Proceso<br>${estados["en proceso"]}</div>
      <div class="estado-box listo">Listos<br>${estados.listo}</div>
      <div class="estado-box atrasado">Atrasados<br>${estados.atrasado}</div>
    `;
  }

  // =======================
  // GRÁFICA MENSUAL COMPLETA
  // =======================
  async function cargarGraficaMensual() {
    const snap = await getDocs(collection(db, "ventas"));

    const meses = [
      "Enero","Febrero","Marzo","Abril","Mayo","Junio",
      "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"
    ];

    let ventasPorMes = Array(12).fill(0);
    let kgPorMes = Array(12).fill(0);
    let pedidosPorMes = Array(12).fill(0);

    snap.forEach(docSnap => {
      const v = docSnap.data();
      if (!v.fecha) return;

      const fecha = v.fecha.toDate ? v.fecha.toDate() : new Date(v.fecha);
      const mes = fecha.getMonth();

      pedidosPorMes[mes]++;
      ventasPorMes[mes] += Number(v.total || 0);

      if (Array.isArray(v.lineas)) {
        v.lineas.forEach(l => {
          const peso = Number(l.peso);
          const cantidad = Number(l.cantidad);
          if (!isNaN(peso) && !isNaN(cantidad)) {
            kgPorMes[mes] += (peso * cantidad) / 1000;
          }
        });
      }
    });

    const ctx = document.getElementById("graficaVentasMensuales");
    if (!ctx) return;

    if (chartInstance) chartInstance.destroy();

    chartInstance = new Chart(ctx, {
      type: "bar",
      data: {
        labels: meses,
        datasets: [
          {
            label: "₡ Ventas",
            data: ventasPorMes,
            backgroundColor: "rgba(75,192,192,0.7)"
          },
          {
            label: "Kg vendidos",
            data: kgPorMes,
            backgroundColor: "rgba(255,159,64,0.7)"
          },
          {
            label: "Pedidos",
            data: pedidosPorMes,
            backgroundColor: "rgba(153,102,255,0.7)"
          }
        ]
      },
      options: {
        responsive: true,
        scales: {
          y: { beginAtZero: true }
        }
      }
    });
  }

});
