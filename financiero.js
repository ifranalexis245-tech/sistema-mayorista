const KEY = "almacen-plantilla";

const TIPO_MAP = {
  ingreso: { tipo: "ingreso", categoria: "Ingresos por Ventas" },
  egreso_prov: { tipo: "egreso", categoria: "Pago a Proveedores" },
  egreso_gasto: { tipo: "egreso", categoria: "Gastos del Local" }
};
const REVERSE_CAT_MAP = {
  "Ingresos por Ventas": "ingreso",
  "Pago a Proveedores": "egreso_prov",
  "Gastos del Local": "egreso_gasto"
};

const PALETA = ["#203E7F", "#EF7A1E", "#6F86B8", "#F6A862", "#2E9E5B", "#D64545", "#1B356B", "#B8550E"];
const NAVY = "#203E7F";
const ORANGE = "#EF7A1E";

const pesos = (n) =>
  n.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const uid = () => "fc-" + Date.now().toString(36);
const colorDe = (i) => PALETA[i % PALETA.length];

Chart.defaults.font.family = "Poppins, system-ui, sans-serif";
Chart.defaults.color = "#565B66";
Chart.defaults.plugins.legend.labels.usePointStyle = true;

let storeData = { productos: [], movimientos: [], flujoCaja: [] };

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      storeData = JSON.parse(raw);
    }
  } catch (_) {}
  
  if (!storeData.flujoCaja) storeData.flujoCaja = [];
  
  return storeData.flujoCaja.map(m => {
    const mapped = TIPO_MAP[m.tipo] || { tipo: "egreso", categoria: "Otros" };
    return {
      id: m.id,
      fecha: m.fecha,
      tipo: mapped.tipo,
      categoria: mapped.categoria,
      descripcion: m.detalle,
      monto: m.monto
    };
  });
}

let movimientos = load();
const charts = {};

let currentMonthYear = new Date().toISOString().slice(0, 7); // e.g. "2026-09"

function currentMovimientos() {
  return movimientos.filter(m => m.fecha.startsWith(currentMonthYear));
}

function persist() {
  storeData.flujoCaja = movimientos.map(m => {
    return {
      id: m.id,
      fecha: m.fecha,
      tipo: REVERSE_CAT_MAP[m.categoria] || (m.tipo === "ingreso" ? "ingreso" : "egreso_gasto"),
      detalle: m.descripcion,
      monto: m.monto
    };
  });
  localStorage.setItem(KEY, JSON.stringify(storeData));
}

function semanaDelMes(fechaIso) {
  const dia = Number(fechaIso.slice(8, 10));
  return Math.min(3, Math.floor((dia - 1) / 7));
}

function tot(tipo) {
  return currentMovimientos().filter((m) => m.tipo === tipo).reduce((a, m) => a + m.monto, 0);
}

function porCategoria(tipo) {
  const map = {};
  currentMovimientos()
    .filter((m) => m.tipo === tipo)
    .forEach((m) => {
      map[m.categoria] = (map[m.categoria] || 0) + m.monto;
    });
  const labels = Object.keys(map);
  return { labels, data: labels.map((k) => map[k]), colors: labels.map((_, i) => colorDe(i)) };
}

function volumenCategorias() {
  const map = {};
  currentMovimientos().forEach((m) => {
    map[m.categoria] = (map[m.categoria] || 0) + m.monto;
  });
  return Object.entries(map).sort((a, b) => b[1] - a[1]);
}

function serieDiaria() {
  const ordenados = [...currentMovimientos()].sort((a, b) => a.fecha.localeCompare(b.fecha));
  const labels = [];
  const balance = [];
  const ingAcc = [];
  const egrAcc = [];
  let b = 0;
  let ing = 0;
  let egr = 0;
  ordenados.forEach((m) => {
    if (m.tipo === "ingreso") {
      b += m.monto;
      ing += m.monto;
    } else {
      b -= m.monto;
      egr += m.monto;
    }
    labels.push(new Date(m.fecha + "T12:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" }));
    balance.push(b);
    ingAcc.push(ing);
    egrAcc.push(egr);
  });
  return { labels, balance, ingAcc, egrAcc };
}

function upsert(id, config) {
  if (charts[id]) {
    charts[id].data = config.data;
    charts[id].update();
    return;
  }
  charts[id] = new Chart(document.getElementById(id), config);
}

function renderKpis() {
  const ingresos = tot("ingreso");
  const egresos = tot("egreso");
  document.getElementById("kpis").innerHTML = `
    <article class="kpi ingreso"><span>Ingresos del mes</span><strong>${pesos(ingresos)}</strong></article>
    <article class="kpi egreso"><span>Egresos del mes</span><strong>${pesos(egresos)}</strong></article>
    <article class="kpi balance"><span>Balance</span><strong>${pesos(ingresos - egresos)}</strong></article>
  `;
}

function renderFiltro() {
  const actual = document.getElementById("filtroCategoria").value || "Todas";
  const categorias = ["Todas", ...new Set(currentMovimientos().map((m) => m.categoria))];
  document.getElementById("filtroCategoria").innerHTML = categorias
    .map((c) => `<option ${c === actual ? "selected" : ""}>${esc(c)}</option>`)
    .join("");
}

function renderTabla() {
  const filtro = document.getElementById("filtroCategoria").value || "Todas";
  // Sort descending by date (newest first)
  const filas = currentMovimientos()
    .filter((m) => filtro === "Todas" || m.categoria === filtro)
    .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.id.localeCompare(a.id));
    
  document.getElementById("tablaMovimientos").innerHTML = filas
    .map(
      (m) => `
      <tr>
        <td>${new Date(m.fecha + "T12:00:00").toLocaleDateString("es-AR")}</td>
        <td><span class="pill ${m.tipo}">${m.tipo}</span></td>
        <td>${esc(m.categoria)}</td>
        <td>${esc(m.descripcion)}</td>
        <td class="num">${m.tipo === "egreso" ? "−" : "+"}${pesos(m.monto)}</td>
        <td>
          <div class="acciones">
            <button type="button" class="sm ghost" data-edit="${m.id}">Editar</button>
            <button type="button" class="sm danger" data-del="${m.id}">Borrar</button>
          </div>
        </td>
      </tr>`
    )
    .join("") || `<tr><td colspan="6" style="text-align: center; padding: 1.5rem;">No hay movimientos este mes.</td></tr>`;
}

function renderCharts() {
  const ingresosSem = [0, 0, 0, 0];
  const egresosSem = [0, 0, 0, 0];
  currentMovimientos().forEach((m) => {
    const i = semanaDelMes(m.fecha);
    if (m.tipo === "ingreso") ingresosSem[i] += m.monto;
    else egresosSem[i] += m.monto;
  });

  const ticksMil = { y: { ticks: { callback: (v) => "$" + (v / 1000).toFixed(0) + " mil" } } };
  const common = { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom" } } };

  upsert("chartSemanas", {
    type: "bar",
    data: {
      labels: ["Sem 1", "Sem 2", "Sem 3", "Sem 4"],
      datasets: [
        { label: "Ingresos", data: ingresosSem, backgroundColor: NAVY, borderRadius: 6 },
        { label: "Egresos", data: egresosSem, backgroundColor: ORANGE, borderRadius: 6 },
      ],
    },
    options: { ...common, scales: ticksMil },
  });



  const egrCat = porCategoria("egreso");
  upsert("chartDona", {
    type: "doughnut",
    data: {
      labels: egrCat.labels,
      datasets: [{ data: egrCat.data, backgroundColor: egrCat.colors, borderWidth: 0 }],
    },
    options: { ...common, cutout: "62%" },
  });

  const ingresos = tot("ingreso");
  const egresos = tot("egreso");
  const ratio = ingresos ? Math.round((egresos / ingresos) * 100) : 0;
  const resto = Math.max(0, 100 - ratio);
  document.getElementById("gaugeLabel").innerHTML = `<strong>${ratio}%</strong><span>del ingreso</span>`;
  upsert("chartGauge", {
    type: "doughnut",
    data: {
      labels: ["Gastado", "Disponible"],
      datasets: [{ data: [Math.min(ratio, 100), resto], backgroundColor: [ORANGE, "#E4E7EC"], borderWidth: 0 }],
    },
    options: {
      ...common,
      maintainAspectRatio: false,
      rotation: -90,
      circumference: 180,
      cutout: "78%",
      plugins: { legend: { display: false } },
    },
  });

}

function renderFiltroMesAnio() {
  const select = document.getElementById("filtroMesAnio");
  // Collect unique YYYY-MM
  const mesesSet = new Set(movimientos.map(m => m.fecha.slice(0, 7)));
  // Ensure currentMonthYear is always in the list even if empty
  mesesSet.add(currentMonthYear);
  
  const mesesArray = Array.from(mesesSet).sort().reverse();
  
  const formatter = new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric' });
  
  select.innerHTML = mesesArray.map(m => {
    const [year, month] = m.split('-');
    const date = new Date(year, month - 1, 15);
    const label = formatter.format(date).replace(/^\w/, c => c.toUpperCase());
    return `<option value="${m}" ${m === currentMonthYear ? "selected" : ""}>${label}</option>`;
  }).join("");
}

function render() {
  renderFiltroMesAnio();
  renderKpis();
  renderFiltro();
  renderTabla();
  renderCharts();
}

const modal = document.getElementById("modal");

document.getElementById("filtroMesAnio").addEventListener("change", (e) => {
  currentMonthYear = e.target.value;
  render();
});

function abrir(item) {
  document.getElementById("modalTitulo").textContent = item ? "Editar movimiento" : "Nuevo movimiento";
  document.getElementById("editId").value = item?.id || "";
  document.getElementById("fecha").value = item?.fecha || new Date().toISOString().split('T')[0];
  document.getElementById("categoria").value = item?.categoria || "Ingresos por Ventas";
  document.getElementById("descripcion").value = item?.descripcion || "";
  document.getElementById("monto").value = item?.monto || "";
  modal.showModal();
}

document.getElementById("btnNuevo").addEventListener("click", () => abrir(null));
document.getElementById("btnCancelar").addEventListener("click", () => modal.close());
document.getElementById("filtroCategoria").addEventListener("change", renderTabla);

document.getElementById("formAbm").addEventListener("submit", (e) => {
  e.preventDefault();
  const categoria = document.getElementById("categoria").value;
  const tipo = categoria === "Ingresos por Ventas" ? "ingreso" : "egreso";
  const item = {
    id: document.getElementById("editId").value || uid(),
    fecha: document.getElementById("fecha").value,
    tipo: tipo,
    categoria: categoria,
    descripcion: document.getElementById("descripcion").value.trim(),
    monto: Number(document.getElementById("monto").value),
  };
  const i = movimientos.findIndex((m) => m.id === item.id);
  if (i >= 0) movimientos[i] = item;
  else movimientos.push(item);
  persist();
  modal.close();
  render();
});

document.getElementById("tablaMovimientos").addEventListener("click", (e) => {
  const edit = e.target.closest("[data-edit]");
  const del = e.target.closest("[data-del]");
  if (edit) abrir(movimientos.find((m) => m.id === edit.dataset.edit));
  if (del && confirm("¿Borrar este movimiento?")) {
    movimientos = movimientos.filter((m) => m.id !== del.dataset.del);
    persist();
    render();
  }
});

document.getElementById("btnLimpiarTodo").addEventListener("click", () => {
  if (confirm("⚠️ ADVERTENCIA: Estás a punto de borrar TODO el historial (Financiero y Stock).\n¿Estás completamente seguro?")) {
    if (confirm("Última confirmación: Esta acción no se puede deshacer. Todo quedará en cero. ¿Continuar?")) {
      localStorage.removeItem(KEY);
      storeData = { productos: [], movimientos: [], flujoCaja: [] };
      movimientos = [];
      
      // Update charts data to empty
      Object.values(charts).forEach(chart => {
        chart.data.datasets.forEach(ds => ds.data = []);
        chart.update();
      });
      
      render();
      alert("El sistema ha sido reiniciado a cero exitosamente.");
    }
  }
});

render();
