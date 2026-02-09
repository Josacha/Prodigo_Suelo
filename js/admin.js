import { db, auth } from './firebase.js';
import { collection, query, where, getDocs, limit, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// --- ESTADO DE AUTENTICACIÓN ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        const welcomeTitle = document.getElementById('welcome-title');
        if(welcomeTitle) welcomeTitle.innerText = `Bienvenida, ${user.displayName || 'Andre'}`;
        initDashboard();
    } else {
        window.location.href = '../login.html';
    }
});

// --- LÓGICA PRINCIPAL DEL DASHBOARD ---
async function initDashboard() {
    try {
        const hoy = new Date();
        const lunes = new Date(hoy);
        lunes.setDate(hoy.getDate() - (hoy.getDay() === 0 ? 6 : hoy.getDay() - 1));
        const fechaLunesISO = lunes.toISOString().split('T')[0];

        const qStats = query(collection(db, "citas"), where("fecha", ">=", fechaLunesISO));
        const snapshotStats = await getDocs(qStats);
        
        let horasOcupadas = 0;
        let ingresosFijosSemana = 0;

        snapshotStats.forEach(doc => {
            const data = doc.data();
            const duracionMinutos = Number(data.duracion) || 60;
            horasOcupadas += (duracionMinutos / 60);
            ingresosFijosSemana += Number(data.inversionFija || 0);
        });

        const CAPACIDAD_SEMANAL = 60; 
        actualizarBarra(horasOcupadas, CAPACIDAD_SEMANAL);
        
        const txtIngresos = document.getElementById('stat-ingresos');
        if(txtIngresos) txtIngresos.innerText = `₡${ingresosFijosSemana.toLocaleString()}`;

        const hoyISO = hoy.toISOString().split('T')[0];
        const qRecent = query(
            collection(db, "citas"), 
            where("fecha", ">=", hoyISO),
            orderBy("fecha", "asc"),
            limit(3)
        );
        const snapshotRecent = await getDocs(qRecent);
        renderRecentList(snapshotRecent);

        const opciones = { weekday: 'long' };
        const dayTxt = document.getElementById('current-day-name');
        if(dayTxt) dayTxt.innerText = new Intl.DateTimeFormat('es-ES', opciones).format(hoy);

    } catch (e) {
        console.error("Error cargando datos del dashboard:", e);
    }
}

function actualizarBarra(ocupadas, total) {
    const porcentaje = Math.min(Math.round((ocupadas / total) * 100), 100);
    const fill = document.getElementById('progress-fill');
    const porcTxt = document.getElementById('ocupacion-porcentaje');
    const detTxt = document.getElementById('stat-detalle');

    if(fill) {
        fill.style.width = `${porcentaje}%`;
        if(porcentaje < 50) fill.style.backgroundColor = "#2ecc71";
        else if(porcentaje < 85) fill.style.backgroundColor = "#f1c40f";
        else fill.style.backgroundColor = "#e74c3c";
    }
    
    if(porcTxt) porcTxt.innerText = `${porcentaje}%`;
    if(detTxt) {
        detTxt.innerHTML = `Has ocupado <strong>${ocupadas.toFixed(1)}h</strong> de las <strong>${total}h</strong> disponibles esta semana.`;
    }
}

function renderRecentList(snapshot) {
    const list = document.getElementById('recent-list');
    if(!list) return;
    list.innerHTML = '';
    if(snapshot.empty) {
        list.innerHTML = '<div class="recent-item">No hay citas para los próximos días</div>';
        return;
    }
    snapshot.forEach(doc => {
        const cita = doc.data();
        const cliente = cita.nombreCliente || "Cliente"; 
        const servicio = cita.nombresServicios || cita.nombreServicio || "Servicio";
        const hora = cita.hora || "--:--";
        const fechaStr = cita.fecha;

        list.innerHTML += `
            <div class="recent-item">
                <div>
                    <span class="c-name">${cliente}</span>
                    <span class="c-service">${servicio}</span>
                    <small style="display:block; color:#888; font-size: 11px;">${fechaStr}</small>
                </div>
                <span class="c-time">${hora}</span>
            </div>
        `;
    });
}

// --- FUNCIÓN DE EXPORTACIÓN DE CLIENTES (CAFÉ PRÓDIGO SUELO) ---
async function exportarClientesExcel() {
    try {
        const q = query(collection(db, "clientes"), orderBy("fecha", "asc"));
        const snapshot = await getDocs(q);
        const dataRows = [];

        snapshot.forEach(doc => {
            const c = doc.data();
            // Formatear fecha del Timestamp
            let fechaFormateada = "";
            if (c.fecha && c.fecha.toDate) {
                fechaFormateada = c.fecha.toDate().toLocaleString('es-CR');
            }

            dataRows.push({
                "Nombre": c.nombre || "",
                "Teléfono": c.telefono || "N/A",
                "Dirección": c.direccion || "",
                "Ubicación GPS": c.ubicacion || "",
                "Vendedor ID": c.vendedorId || "",
                "Fecha Creación": fechaFormateada
            });
        });

        const worksheet = XLSX.utils.json_to_sheet(dataRows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Clientes");
        XLSX.writeFile(workbook, "CAFÉ_PRÓDIGO_SUELO_Clientes.xlsx");
    } catch (error) {
        console.error("Error exportando clientes:", error);
        alert("Error al generar el reporte.");
    }
}

// --- EVENT LISTENERS ---
document.getElementById('btnLogout')?.addEventListener('click', () => {
    signOut(auth).then(() => { window.location.href = '../login.html'; });
});

document.getElementById('btnExportarClientes')?.addEventListener('click', exportarClientesExcel);
