const KEY = "almacen-plantilla";
const CATEGORIAS = ["Alimentos", "Bebidas", "Fiambres", "Lácteos", "Varios"];
const MOTIVOS_IN = ["Compra a proveedor", "Ajuste de inventario", "Devolución"];
const MOTIVOS_OUT = ["Venta", "Merma", "Ajuste de inventario", "Consumo interno"];
const HOY = new Date(); // Mock date base
const addDays = (d) => new Date(HOY.getTime() + d * 86400000).toISOString().split('T')[0];

const SEED_PRODUCTOS = [];
const SEED_MOVS = [];

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const uid = (p) => p + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
const pesos = (n) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n);

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  return { productos: SEED_PRODUCTOS, movimientos: SEED_MOVS, flujoCaja: [] };
}

const store = load();
let productos = store.productos || [];
let movimientos = store.movimientos || [];
let flujoCaja = store.flujoCaja || [];
let sortKey = "nombre";
let sortDir = 1;
let seleccion = new Set();

function persist() {
  localStorage.setItem(KEY, JSON.stringify({ productos, movimientos, flujoCaja }));
}

function bajo(p) {
  return p.stock < p.minimo;
}

function proximoVencer(p) {
  if (!p.vencimiento) return false;
  const v = new Date(p.vencimiento);
  const diff = (v - new Date()) / 86400000;
  return diff <= 10 && diff >= -9999;
}

function filtrados() {
  const q = document.getElementById("q").value.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const cat = document.getElementById("filtroCat").value;
  const prov = document.getElementById("filtroProv").value;
  const est = document.getElementById("filtroEstado").value;
  return productos
    .filter((p) => {
      const texto = `${p.sku} ${p.nombre} ${p.proveedor} ${p.ubicacion || ""}`.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      if (q && !texto.includes(q)) return false;
      if (cat !== "todas" && p.categoria !== cat) return false;
      if (prov !== "todos" && p.proveedor !== prov) return false;
      if (est === "ok" && (bajo(p) || proximoVencer(p))) return false;
      if (est === "reponer" && !bajo(p)) return false;
      if (est === "vencer" && !proximoVencer(p)) return false;
      return true;
    })
    .sort((a, b) => {
      const va = a[sortKey];
      const vb = b[sortKey];
      if (typeof va === "number") return (va - vb) * sortDir;
      return String(va).localeCompare(String(vb), "es") * sortDir;
    });
}

function renderFiltros() {
  const catSel = document.getElementById("filtroCat");
  const provSel = document.getElementById("filtroProv");
  const catActual = catSel.value || "todas";
  const provActual = provSel.value || "todos";
  const proveedores = [...new Set(productos.map((p) => p.proveedor))].sort();
  catSel.innerHTML =
    `<option value="todas">Todas las categorías</option>` +
    CATEGORIAS.map((c) => `<option ${c === catActual ? "selected" : ""}>${esc(c)}</option>`).join("");
  provSel.innerHTML =
    `<option value="todos">Todos los proveedores</option>` +
    proveedores.map((p) => `<option ${p === provActual ? "selected" : ""}>${esc(p)}</option>`).join("");
  document.getElementById("categoria").innerHTML = CATEGORIAS.map((c) => `<option>${esc(c)}</option>`).join("");
  document.getElementById("listaProveedores").innerHTML = proveedores.map((p) => `<option value="${esc(p)}"></option>`).join("");
}

function renderKpis() {
  const bajos = productos.filter(bajo);
  const valor = productos.reduce((a, p) => a + p.stock * p.precio, 0);
  document.getElementById("kpis").innerHTML = `
    <article class="kpi"><span>SKUs</span><strong>${productos.length}</strong></article>
    <article class="kpi"><span>Por debajo del mínimo</span><strong>${bajos.length}</strong></article>
    <article class="kpi"><span>Cajas/Packs a reponer</span><strong>${bajos.reduce((a, p) => a + (p.minimo - p.stock), 0)}</strong></article>
    <article class="kpi"><span>Valor en stock</span><strong>${pesos(valor)}</strong></article>
  `;
}

function renderTabla() {
  const rows = filtrados();
  document.getElementById("tablaHint").textContent = `${rows.length} de ${productos.length} productos`;
  document.getElementById("tablaStock").innerHTML = rows
    .map((p) => {
      const crit = bajo(p);
      const vence = proximoVencer(p);
      const fechaVencFmt = p.vencimiento ? p.vencimiento.split('-').reverse().join('/') : '-';
      return `
      <tr class="${crit ? "bajo" : ""} ${vence ? "bajo" : ""}">
        <td class="check"><input type="checkbox" data-check="${p.id}" ${seleccion.has(p.id) ? "checked" : ""} /></td>
        <td class="sku">${esc(p.sku)}</td>
        <td>${esc(p.nombre)}<span class="prod-meta">${esc(p.unidad)} · <span class="precio-venta">${pesos(p.precio)}</span> · Ganancia: ${pesos(p.gananciaNeta || 0)} (${p.margenEsperado || p.margenBruto || 0}%)</span></td>
        <td style="${vence ? 'color: red; font-weight: bold;' : ''}">${fechaVencFmt}</td>
        <td>${esc(p.categoria)}</td>
        <td>${esc(p.proveedor)}</td>
        <td>
          <div class="stock-cell">
            <button type="button" class="sm ghost" data-out="${p.id}">−</button>
            <div style="text-align: center; display: flex; flex-direction: column; min-width: 4rem;">
              <strong>${p.stock} Cajas</strong>
              <small style="font-size: 0.7em; color: var(--fg-3);">(${(p.stock * (p.unidades_por_caja || 1))} un)</small>
            </div>
            <button type="button" class="sm" data-in="${p.id}">+</button>
          </div>
        </td>
        <td class="num">${p.minimo}</td>
        <td><span class="pill ${crit || vence ? "reponer" : "ok"}">${vence ? "Vencer" : (crit ? "Reponer" : "OK")}</span></td>
        <td>
          <div class="acciones">
            <button type="button" class="sm ghost" data-edit="${p.id}">Editar</button>
            <button type="button" class="sm danger" data-del="${p.id}">Borrar</button>
          </div>
        </td>
      </tr>`;
    })
    .join("") || `<tr><td colspan="10">No hay productos con esos filtros.</td></tr>`;
  document.getElementById("checkAll").checked = rows.length > 0 && rows.every((p) => seleccion.has(p.id));
  const btnSel = document.getElementById("btnBorrarSel");
  btnSel.hidden = seleccion.size === 0;
  btnSel.textContent = `Borrar seleccionados (${seleccion.size})`;
}

function renderLista() {
  const bajos = productos.filter(bajo);
  if (!bajos.length) {
    document.getElementById("panelLista").innerHTML = `<h2>Lista de reposición</h2><p>Nada por debajo del mínimo.</p>`;
    return;
  }
  const items = bajos
    .map((p) => `<li><span>${esc(p.nombre)}<br><small>${esc(p.sku)} · ${esc(p.proveedor)}</small></span><strong>+${p.minimo - p.stock}</strong></li>`)
    .join("");
  document.getElementById("panelLista").innerHTML = `
    <h2>Lista de reposición</h2>
    <p>${bajos.length} productos para comprar ahora</p>
    <ul class="lista">${items}</ul>
    <p>En Etapa 3 este listado puede ir por WhatsApp al encargado de compras.</p>
  `;
}

function renderMovs() {
  const ultimos = [...movimientos].sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 8);
  if (!ultimos.length) {
    document.getElementById("panelMovs").innerHTML = `<h2>Movimientos</h2><p>Todavía no hay entradas ni salidas.</p>`;
    return;
  }
  const items = ultimos
    .map((m) => {
      const p = productos.find((x) => x.id === m.productoId);
      const cuando = new Date(m.fecha).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
      const extra = m.metodoPago ? ` · ${m.metodoPago}` : "";
      return `<li><b class="${m.tipo}">${m.tipo === "entrada" ? "+" : "−"}${m.cantidad}</b> ${esc(p?.nombre || "Producto borrado")}<br><small>${esc(m.motivo)}${extra} · ${cuando}</small></li>`;
    })
    .join("");
  document.getElementById("panelMovs").innerHTML = `<h2>Últimos movimientos</h2><ul class="movs">${items}</ul>`;
}

function renderCaja() {
  let totalIngresos = 0;
  let totalEgresos = 0;
  
  const rows = [...flujoCaja].sort((a, b) => b.fecha.localeCompare(a.fecha) || b.id.localeCompare(a.id)).map(m => {
    const isIngreso = m.tipo === "ingreso";
    if (isIngreso) totalIngresos += m.monto;
    else totalEgresos += m.monto;
    
    const fechaFmt = m.fecha.split('-').reverse().join('/');
    const tipoMap = { ingreso: "Venta", egreso_prov: "Pago Prov.", egreso_gasto: "Gasto" };
    const tipoFmt = tipoMap[m.tipo] || (isIngreso ? "Ingreso" : "Egreso");
    const color = isIngreso ? "var(--success)" : "var(--danger)";
    const signo = isIngreso ? "+" : "−";
    
    return `
      <tr>
        <td>${fechaFmt}</td>
        <td><span class="pill" style="color: ${color}; background: transparent; border: 1px solid ${color};">${tipoFmt}</span></td>
        <td>${esc(m.detalle)}</td>
        <td class="num" style="color: ${color}; font-weight: bold;">${signo}${pesos(m.monto)}</td>
        <td><button type="button" class="sm danger" data-del-caja="${m.id}">×</button></td>
      </tr>
    `;
  });
  
  document.getElementById("tablaCaja").innerHTML = rows.join("") || `<tr><td colspan="5">No hay movimientos registrados.</td></tr>`;
  
  const balance = totalIngresos - totalEgresos;
  document.getElementById("kpisCaja").innerHTML = `
    <article class="kpi"><span>Total Ingresos</span><strong style="color: var(--success);">${pesos(totalIngresos)}</strong></article>
    <article class="kpi"><span>Total Egresos</span><strong style="color: var(--danger);">${pesos(totalEgresos)}</strong></article>
    <article class="kpi"><span>Balance Neto</span><strong style="color: ${balance >= 0 ? 'var(--success)' : 'var(--danger)'};">${pesos(balance)}</strong></article>
  `;
}

function render() {
  renderFiltros();
  renderKpis();
  renderTabla();
  renderLista();
  renderMovs();
  renderCaja();
}

const modal = document.getElementById("modal");
const modalMov = document.getElementById("modalMov");
const formError = document.getElementById("formError");
const movError = document.getElementById("movError");

function showError(el, msg) {
  el.hidden = !msg;
  el.textContent = msg || "";
}

function getNextSku() {
  if (productos.length === 0) return "L-001";
  const lSkus = productos
    .map(p => p.sku)
    .filter(sku => /^L-\d+$/.test(sku))
    .map(sku => parseInt(sku.replace("L-", ""), 10))
    .sort((a, b) => b - a);
  if (lSkus.length === 0) return "L-001";
  return "L-" + String(lSkus[0] + 1).padStart(3, '0');
}

function abrir(item) {
  showError(formError, "");
  document.getElementById("modalTitulo").textContent = item ? "Editar producto / lote" : "Nuevo producto / lote";
  document.getElementById("editId").value = item?.id || "";
  document.getElementById("sku").value = item?.sku || getNextSku();
  document.getElementById("sku").readOnly = true;
  document.getElementById("nombre").value = item?.nombre || "";
  document.getElementById("vencimiento").value = item?.vencimiento || "";
  document.getElementById("categoria").value = item?.categoria || CATEGORIAS[0];
  document.getElementById("proveedor").value = item?.proveedor || "";
  document.getElementById("unidad").value = item?.unidad || "";
  document.getElementById("stock").value = item?.stock ?? 0;
  document.getElementById("unidadesPorCaja").value = item?.unidades_por_caja ?? 1;
  document.getElementById("minimo").value = item?.minimo ?? 0;
  document.getElementById("costo").value = item?.costo ?? 0;
  let margen = item?.margenEsperado ?? 30; // Default 30% margin for new items
  if (item && item.precio && item.costo && !item.margenEsperado) {
    margen = (1 - (item.costo / item.precio)) * 100;
  }
  document.getElementById("margenEsperado").value = Number(margen.toFixed(2));
  
  calcularPrecioFinal();
  calcularSueltas();
  modal.showModal();
}

function calcularSueltas() {
  const stock = Number(document.getElementById("stock").value);
  const upc = Number(document.getElementById("unidadesPorCaja").value);
  document.getElementById("totalSueltas").value = (stock * upc) + " unidades";
}

function abrirMov(producto, tipo) {
  showError(movError, "");
  document.getElementById("movId").value = producto.id;
  document.getElementById("movTipo").value = tipo;
  document.getElementById("movTitulo").textContent = tipo === "entrada" ? "Entrada de stock" : "Salida de stock";
  document.getElementById("movProducto").textContent = `${producto.sku} · ${producto.nombre} · stock actual ${producto.stock}`;
  document.getElementById("movCantidad").value = 1;
  const motivos = tipo === "entrada" ? MOTIVOS_IN : MOTIVOS_OUT;
  const selMotivo = document.getElementById("movMotivo");
  selMotivo.innerHTML = motivos.map((m) => `<option>${m}</option>`).join("");
  document.getElementById("labelMetodoPago").hidden = !(tipo === "salida" && selMotivo.value === "Venta");
  modalMov.showModal();
}

document.getElementById("movMotivo").addEventListener("change", (e) => {
  const isVenta = document.getElementById("movTipo").value === "salida" && e.target.value === "Venta";
  document.getElementById("labelMetodoPago").hidden = !isVenta;
});

function calcularPrecioFinal() {
  const costo = Number(document.getElementById("costo").value);
  const margen = Number(document.getElementById("margenEsperado").value);
  
  if (margen >= 100) {
    showError(formError, "El margen de ganancia debe ser menor al 100%.");
    document.getElementById("precio").value = pesos(0);
    document.getElementById("gananciaNeta").value = pesos(0);
    return;
  } else {
    showError(formError, ""); // clear error
  }
  
  if (costo >= 0 && margen >= 0) {
    const precioFinal = costo / (1 - (margen / 100));
    const ganancia = precioFinal - costo;
    document.getElementById("precio").value = pesos(precioFinal);
    document.getElementById("gananciaNeta").value = pesos(ganancia);
  } else {
    document.getElementById("precio").value = pesos(0);
    document.getElementById("gananciaNeta").value = pesos(0);
  }
}

document.getElementById("costo").addEventListener("input", calcularPrecioFinal);
document.getElementById("margenEsperado").addEventListener("input", calcularPrecioFinal);
document.getElementById("stock").addEventListener("input", calcularSueltas);
document.getElementById("unidadesPorCaja").addEventListener("input", calcularSueltas);

function borrarIds(ids) {
  productos = productos.filter((p) => !ids.includes(p.id));
  movimientos = movimientos.filter((m) => !ids.includes(m.productoId));
  ids.forEach((id) => seleccion.delete(id));
  persist();
  render();
}

document.getElementById("btnNuevo").addEventListener("click", () => abrir(null));
document.getElementById("btnCancelar").addEventListener("click", () => modal.close());
document.getElementById("btnCancelarMov").addEventListener("click", () => modalMov.close());
["q", "filtroCat", "filtroProv", "filtroEstado"].forEach((id) => {
  document.getElementById(id).addEventListener("input", renderTabla);
  document.getElementById(id).addEventListener("change", renderTabla);
});

document.querySelectorAll(".th-sort").forEach((btn) => {
  btn.addEventListener("click", () => {
    const key = btn.dataset.sort;
    if (sortKey === key) sortDir *= -1;
    else {
      sortKey = key;
      sortDir = 1;
    }
    renderTabla();
  });
});

document.getElementById("checkAll").addEventListener("change", (e) => {
  const rows = filtrados();
  if (e.target.checked) rows.forEach((p) => seleccion.add(p.id));
  else rows.forEach((p) => seleccion.delete(p.id));
  renderTabla();
});

document.getElementById("btnBorrarSel").addEventListener("click", () => {
  if (!seleccion.size) return;
  if (confirm(`¿Borrar ${seleccion.size} producto(s)?`)) borrarIds([...seleccion]);
});

document.getElementById("formAbm").addEventListener("submit", (e) => {
  e.preventDefault();
  const id = document.getElementById("editId").value || uid("p-");
  const sku = document.getElementById("sku").value.trim().toUpperCase();
  const duplicado = productos.some((p) => p.sku === sku && p.id !== id);
  if (duplicado) {
    showError(formError, "Ese Cód/Lote ya existe. Tiene que ser único.");
    return;
  }
  const stock = Number(document.getElementById("stock").value);
  const unidades_por_caja = Number(document.getElementById("unidadesPorCaja").value) || 1;
  const minimo = Number(document.getElementById("minimo").value);
  const costo = Number(document.getElementById("costo").value);
  const margenEsperado = Number(document.getElementById("margenEsperado").value);
  
  if (margenEsperado >= 100) {
    showError(formError, "El margen de ganancia debe ser menor al 100%.");
    return;
  }
  
  const precio = costo / (1 - (margenEsperado / 100));
  
  if (stock < 0 || unidades_por_caja < 1 || minimo < 0 || costo < 0 || margenEsperado < 0) {
    showError(formError, "Valores numéricos inválidos.");
    return;
  }
  const gananciaNeta = precio > 0 ? (precio - costo) : 0;
  
  const item = {
    id,
    sku,
    nombre: document.getElementById("nombre").value.trim(),
    vencimiento: document.getElementById("vencimiento").value,
    categoria: document.getElementById("categoria").value,
    proveedor: document.getElementById("proveedor").value.trim(),
    unidad: document.getElementById("unidad").value,
    stock,
    unidades_por_caja,
    minimo,
    costo,
    precio,
    gananciaNeta,
    margenEsperado,
  };
  const i = productos.findIndex((p) => p.id === id);
  const anterior = i >= 0 ? productos[i] : null;
  if (i >= 0) productos[i] = item;
  else productos.push(item);
  if (anterior && anterior.stock !== item.stock) {
    const diff = item.stock - anterior.stock;
    movimientos.push({
      id: uid("mv-"),
      productoId: id,
      tipo: diff > 0 ? "entrada" : "salida",
      cantidad: Math.abs(diff),
      motivo: "Ajuste de inventario",
      fecha: new Date().toISOString(),
    });
  }
  persist();
  modal.close();
  render();
});

document.getElementById("formMov").addEventListener("submit", (e) => {
  e.preventDefault();
  const id = document.getElementById("movId").value;
  const tipo = document.getElementById("movTipo").value;
  const cantidad = Number(document.getElementById("movCantidad").value);
  const motivo = document.getElementById("movMotivo").value;
  const metodoPago = document.getElementById("labelMetodoPago").hidden ? null : document.getElementById("movMetodoPago").value;
  
  const p = productos.find((x) => x.id === id);
  if (!p || cantidad < 1) return;
  if (tipo === "salida" && cantidad > p.stock) {
    showError(movError, `No hay stock suficiente. Hay ${p.stock} caja(s)/pack(s) de ${p.unidad}.`);
    return;
  }
  p.stock = tipo === "entrada" ? p.stock + cantidad : p.stock - cantidad;
  movimientos.push({
    id: uid("mv-"),
    productoId: p.id,
    tipo,
    cantidad,
    motivo,
    metodoPago,
    fecha: new Date().toISOString(),
  });
  
  // Integración automática con Financiero / Flujo de Caja
  if (tipo === "salida" && motivo === "Venta") {
    flujoCaja.push({
      id: uid("fc-"),
      tipo: "ingreso",
      monto: cantidad * (p.precio || 0),
      detalle: `Venta de stock: ${cantidad} cajas/packs de ${p.nombre}`,
      fecha: new Date().toISOString().split('T')[0]
    });
  } else if (tipo === "entrada" && motivo === "Compra a proveedor") {
    flujoCaja.push({
      id: uid("fc-"),
      tipo: "egreso_prov",
      monto: cantidad * (p.costo || 0),
      detalle: `Compra de stock: ${cantidad} cajas/packs de ${p.nombre}`,
      fecha: new Date().toISOString().split('T')[0]
    });
  }
  persist();
  modalMov.close();
  render();
});

document.getElementById("tablaStock").addEventListener("click", (e) => {
  const edit = e.target.closest("[data-edit]");
  const del = e.target.closest("[data-del]");
  const inn = e.target.closest("[data-in]");
  const out = e.target.closest("[data-out]");
  if (edit) abrir(productos.find((p) => p.id === edit.dataset.edit));
  if (del && confirm("¿Borrar este producto y su historial de movimientos?")) borrarIds([del.dataset.del]);
  if (inn) abrirMov(productos.find((p) => p.id === inn.dataset.in), "entrada");
  if (out) abrirMov(productos.find((p) => p.id === out.dataset.out), "salida");
});

document.getElementById("tablaStock").addEventListener("change", (e) => {
  const box = e.target.closest("[data-check]");
  if (!box) return;
  if (box.checked) seleccion.add(box.dataset.check);
  else seleccion.delete(box.dataset.check);
  renderTabla();
});

document.getElementById("formCaja").addEventListener("submit", (e) => {
  e.preventDefault();
  const tipo = document.getElementById("cajaTipo").value;
  const monto = Number(document.getElementById("cajaMonto").value);
  const detalle = document.getElementById("cajaDetalle").value.trim();
  const fecha = document.getElementById("cajaFecha").value;
  
  flujoCaja.push({
    id: uid("fc-"),
    tipo,
    monto,
    detalle,
    fecha
  });
  persist();
  renderCaja();
  e.target.reset();
  document.getElementById("cajaFecha").value = HOY.toISOString().split('T')[0];
});

document.getElementById("tablaCaja").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-del-caja]");
  if (btn && confirm("¿Borrar este movimiento de caja?")) {
    flujoCaja = flujoCaja.filter(m => m.id !== btn.dataset.delCaja);
    persist();
    renderCaja();
  }
});

document.getElementById("cajaFecha").value = HOY.toISOString().split('T')[0];

function cargarDatosDemo() {
  if (productos.length > 0) return; // Only populate if empty
  
  const rawDemo = [
    { nombre: "Hamburguesas Swift Clásicas", categoria: "Congelados", proveedor: "Swift", vencimiento: "2026-12-10", unidad: "Caja de 48 un", unidades_por_caja: 48, stock: 15, minimo: 5, costo: 22000, margenEsperado: 40 },
    { nombre: "Salchichas de Viena Paladini", categoria: "Embutidos", proveedor: "Paladini", vencimiento: "2026-11-15", unidad: "Pack de 36 un", unidades_por_caja: 36, stock: 20, minimo: 8, costo: 14500, margenEsperado: 35 },
    { nombre: "Papas Fritas McCain Corte Tradicional", categoria: "Congelados", proveedor: "McCain", vencimiento: "2027-02-20", unidad: "Caja 6 bolsas x 2.5kg", unidades_por_caja: 6, stock: 3, minimo: 10, costo: 28000, margenEsperado: 45 },
    { nombre: "Mayonesa Natura Doypack", categoria: "Aderezos", proveedor: "AGD", vencimiento: "2027-05-01", unidad: "Caja de 12 un", unidades_por_caja: 12, stock: 35, minimo: 10, costo: 11000, margenEsperado: 30 },
    { nombre: "Queso Cheddar en fetas Tonadita", categoria: "Lácteos", proveedor: "Tonadita", vencimiento: "2026-10-30", unidad: "Pack de 192 fetas", unidades_por_caja: 192, stock: 8, minimo: 5, costo: 16000, margenEsperado: 50 },
    { nombre: "Pan de Hamburguesa Fargo", categoria: "Panificados", proveedor: "Fargo", vencimiento: "2026-09-25", unidad: "Bandeja de 4 un", unidades_por_caja: 4, stock: 50, minimo: 15, costo: 1200, margenEsperado: 60 }
  ];

  rawDemo.forEach((item, index) => {
    const sku = "L-" + String(index + 1).padStart(3, "0");
    const precio = item.costo / (1 - (item.margenEsperado / 100));
    const gananciaNeta = precio - item.costo;
    
    productos.push({
      id: uid("p-"),
      sku,
      ...item,
      precio,
      gananciaNeta
    });
  });
  
  persist();
}

cargarDatosDemo();
render();

// --- Seguridad de Datos ---

function exportarExcel() {
  let csvContent = "\uFEFF=== PRODUCTOS ===\n";
  csvContent += "Cod/Lote;Nombre;Vencimiento;Categoria;Proveedor;Stock;Minimo;Costo;Precio;GananciaNeta;MargenEsperado\n";
  productos.forEach(p => {
    csvContent += `"${p.sku}";"${p.nombre}";"${p.vencimiento||''}";"${p.categoria}";"${p.proveedor||''}";${p.stock};${p.minimo};${p.costo};${p.precio};${p.gananciaNeta||0};${p.margenEsperado||p.margenBruto||0}\n`;
  });
  
  csvContent += "\n=== MOVIMIENTOS ===\n";
  csvContent += "Fecha;Tipo;Cantidad;Producto;Motivo;MetodoPago\n";
  movimientos.forEach(m => {
    const p = productos.find(x => x.id === m.productoId);
    const prodName = p ? p.nombre : "Borrado";
    csvContent += `"${m.fecha}";"${m.tipo}";${m.cantidad};"${prodName}";"${m.motivo}";"${m.metodoPago||''}"\n`;
  });

  csvContent += "\n=== FLUJO DE CAJA ===\n";
  csvContent += "Fecha;Tipo;Detalle;Monto\n";
  flujoCaja.forEach(m => {
    csvContent += `"${m.fecha}";"${m.tipo}";"${m.detalle}";${m.monto}\n`;
  });

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", "almacen_reporte.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function descargarRespaldo() {
  const data = JSON.stringify({ productos, movimientos, flujoCaja });
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", "almacen_respaldo.json");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function restaurarRespaldo(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const parsed = JSON.parse(e.target.result);
      if (parsed.productos && parsed.movimientos) {
        if (!parsed.flujoCaja) parsed.flujoCaja = [];
        localStorage.setItem(KEY, JSON.stringify(parsed));
        alert("Respaldo restaurado con éxito. La página se recargará.");
        location.reload();
      } else {
        alert("El archivo JSON no tiene el formato esperado (productos y movimientos).");
      }
    } catch (err) {
      alert("Error al leer el archivo JSON.");
    }
  };
  reader.readAsText(file);
}

const FECHA_VENCIMIENTO_LICENCIA = "2026-10-10";

function checkLicencia() {
  const hoy = new Date().toISOString().split('T')[0];
  if (hoy > FECHA_VENCIMIENTO_LICENCIA) {
    document.body.innerHTML = `
      <div style="position: fixed; top:0; left:0; width:100%; height:100%; background:#f8fafc; z-index:99999; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; padding:2rem; font-family: 'Poppins', sans-serif;">
        <h1 style="color:var(--danger, #d32f2f); font-size: 2rem; margin-bottom:1rem;">Acceso Suspendido</h1>
        <p style="font-size: 1.1rem; color: var(--fg-2, #475569); max-width: 500px; line-height: 1.5; margin-bottom:2rem;">
          El período de prueba / suscripción ha finalizado. Por favor, contacte al administrador para renovar su acceso.
        </p>
        <button type="button" onclick="descargarRespaldo()" style="background:var(--navy, #203E7F); color:white; border:none; padding: 0.8rem 1.5rem; font-size: 1rem; border-radius: var(--r-md, 8px); cursor:pointer; font-weight:bold; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          Descargar Respaldo (JSON)
        </button>
      </div>
    `;
    return false;
  }
  return true;
}

checkLicencia();
