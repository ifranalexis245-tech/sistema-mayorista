const KEY = "almacen-plantilla";
const CATEGORIAS = ["Alimentos", "Bebidas", "Fiambres", "Lácteos", "Limpieza", "Varios"];
const MOTIVOS_IN = ["Compra a proveedor", "Ajuste de inventario", "Devolución"];
const MOTIVOS_OUT = ["Venta", "Merma", "Ajuste de inventario", "Consumo interno"];
const HOY = new Date(); // Mock date base
const addDays = (d) => new Date(HOY.getTime() + d * 86400000).toISOString().split('T')[0];

const SEED_PRODUCTOS = [];
const SEED_MOVS = [];

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const uid = (p) => p + Date.now().toString(36);
const pesos = (n) =>
  n.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  return { productos: SEED_PRODUCTOS, movimientos: SEED_MOVS };
}

const store = load();
let productos = store.productos;
let movimientos = store.movimientos;
let sortKey = "nombre";
let sortDir = 1;
let seleccion = new Set();

function persist() {
  localStorage.setItem(KEY, JSON.stringify({ productos, movimientos }));
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
    <article class="kpi"><span>Unidades a reponer</span><strong>${bajos.reduce((a, p) => a + (p.minimo - p.stock), 0)}</strong></article>
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
        <td>${esc(p.nombre)}<span class="prod-meta">${esc(p.unidad)} · <span class="precio-venta">$${p.precio}</span></span></td>
        <td style="${vence ? 'color: red; font-weight: bold;' : ''}">${fechaVencFmt}</td>
        <td>${esc(p.categoria)}</td>
        <td>${esc(p.proveedor)}</td>
        <td>
          <div class="stock-cell">
            <button type="button" class="sm ghost" data-out="${p.id}">−</button>
            <strong>${p.stock}</strong>
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

function render() {
  renderFiltros();
  renderKpis();
  renderTabla();
  renderLista();
  renderMovs();
}

const modal = document.getElementById("modal");
const modalMov = document.getElementById("modalMov");
const formError = document.getElementById("formError");
const movError = document.getElementById("movError");

function showError(el, msg) {
  el.hidden = !msg;
  el.textContent = msg || "";
}

function abrir(item) {
  showError(formError, "");
  document.getElementById("modalTitulo").textContent = item ? "Editar producto / lote" : "Nuevo producto / lote";
  document.getElementById("editId").value = item?.id || "";
  document.getElementById("sku").value = item?.sku || "";
  document.getElementById("nombre").value = item?.nombre || "";
  document.getElementById("vencimiento").value = item?.vencimiento || "";
  document.getElementById("categoria").value = item?.categoria || CATEGORIAS[0];
  document.getElementById("proveedor").value = item?.proveedor || "";
  document.getElementById("unidad").value = item?.unidad || "unidad";
  document.getElementById("stock").value = item?.stock ?? 0;
  document.getElementById("minimo").value = item?.minimo ?? 0;
  document.getElementById("costo").value = item?.costo ?? 0;
  document.getElementById("porcentaje").value = item?.porcentaje ?? 30;
  document.getElementById("precio").value = item?.precio ?? 0;
  document.getElementById("sku").readOnly = Boolean(item);
  modal.showModal();
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

function calcularPrecio() {
  const costo = Number(document.getElementById("costo").value);
  const porcentaje = Number(document.getElementById("porcentaje").value);
  document.getElementById("precio").value = Math.round(costo * (1 + porcentaje / 100));
}

document.getElementById("costo").addEventListener("input", calcularPrecio);
document.getElementById("porcentaje").addEventListener("input", calcularPrecio);

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
  const minimo = Number(document.getElementById("minimo").value);
  const costo = Number(document.getElementById("costo").value);
  const porcentaje = Number(document.getElementById("porcentaje").value);
  const precio = Number(document.getElementById("precio").value);
  if (stock < 0 || minimo < 0 || costo < 0 || porcentaje < 0 || precio < 0) {
    showError(formError, "Stock, mínimo, costo, porcentaje y precio no pueden ser negativos.");
    return;
  }
  const item = {
    id,
    sku,
    nombre: document.getElementById("nombre").value.trim(),
    vencimiento: document.getElementById("vencimiento").value,
    categoria: document.getElementById("categoria").value,
    proveedor: document.getElementById("proveedor").value.trim(),
    unidad: document.getElementById("unidad").value,
    stock,
    minimo,
    costo,
    porcentaje,
    precio,
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
    showError(movError, `No hay stock suficiente. Hay ${p.stock} ${p.unidad}(s).`);
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

render();

// --- Seguridad de Datos ---

function exportarExcel() {
  let csvContent = "=== PRODUCTOS ===\n";
  csvContent += "Cod/Lote,Nombre,Vencimiento,Categoria,Proveedor,Stock,Minimo,Costo,Precio\n";
  productos.forEach(p => {
    csvContent += `"${p.sku}","${p.nombre}","${p.vencimiento||''}","${p.categoria}","${p.proveedor||''}",${p.stock},${p.minimo},${p.costo},${p.precio}\n`;
  });
  
  csvContent += "\n=== MOVIMIENTOS ===\n";
  csvContent += "Fecha,Tipo,Cantidad,Producto,Motivo,MetodoPago\n";
  movimientos.forEach(m => {
    const p = productos.find(x => x.id === m.productoId);
    const prodName = p ? p.nombre : "Borrado";
    csvContent += `"${m.fecha}","${m.tipo}",${m.cantidad},"${prodName}","${m.motivo}","${m.metodoPago||''}"\n`;
  });

  const blob = new Blob(["\ufeff", csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", "almacen_reporte.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function descargarRespaldo() {
  const data = JSON.stringify({ productos, movimientos });
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
