const sampleCases = [
  {
    date: "2026-09-08",
    client: "Norte Servicios",
    reason: "Precio",
    agent: "Mariana Vega",
    city: "Tres Arroyos",
    status: "Retenida",
    retained: true,
    reading: "Se ofrecio ajuste temporal y cambio de plan.",
  },
  {
    date: "2026-09-06",
    client: "Estudio Alsina",
    reason: "Mudanza",
    agent: "Bruno Leal",
    city: "Claromeco",
    status: "En gestion",
    retained: false,
    reading: "Pendiente confirmar nueva zona de cobertura.",
  },
  {
    date: "2026-09-03",
    client: "Distribuidora Sur",
    reason: "Competencia",
    agent: "Sofia Acosta",
    city: "Tres Arroyos",
    status: "Baja confirmada",
    retained: false,
    reading: "Competidor con paquete bonificado por 6 meses.",
  },
  {
    date: "2026-08-29",
    client: "Consultora Prado",
    reason: "Servicio tecnico",
    agent: "Mariana Vega",
    city: "Bahia Blanca",
    status: "Retenida",
    retained: true,
    reading: "Se resolvio reclamo historico y quedo seguimiento.",
  },
  {
    date: "2026-08-24",
    client: "La Central Market",
    reason: "Precio",
    agent: "Diego Perez",
    city: "Chaves",
    status: "Baja confirmada",
    retained: false,
    reading: "No acepta contraoferta por reduccion de costos.",
  },
  {
    date: "2026-08-17",
    client: "Alem Logistica",
    reason: "Sin uso",
    agent: "Bruno Leal",
    city: "Tres Arroyos",
    status: "Retenida",
    retained: true,
    reading: "Se reactivo servicio con capacitacion comercial.",
  },
  {
    date: "2026-08-11",
    client: "Clínica Rivera",
    reason: "Servicio tecnico",
    agent: "Sofia Acosta",
    city: "Bahia Blanca",
    status: "En gestion",
    retained: false,
    reading: "Requiere visita tecnica antes de cerrar decision.",
  },
  {
    date: "2026-07-30",
    client: "Campo Azul",
    reason: "Mudanza",
    agent: "Diego Perez",
    city: "Tres Arroyos",
    status: "Baja confirmada",
    retained: false,
    reading: "Fuera de zona operativa actual.",
  },
  {
    date: "2026-07-22",
    client: "Gimnasio Nodo",
    reason: "Precio",
    agent: "Mariana Vega",
    city: "Tres Arroyos",
    status: "Retenida",
    retained: true,
    reading: "Descuento anual contra permanencia.",
  },
  {
    date: "2026-07-12",
    client: "Hotel Alameda",
    reason: "Competencia",
    agent: "Sofia Acosta",
    city: "Claromeco",
    status: "En gestion",
    retained: false,
    reading: "Comparando velocidad, soporte y permanencia.",
  },
];

let cases = [...sampleCases];

const periodFilter = document.querySelector("#periodFilter");
const agentFilter = document.querySelector("#agentFilter");
const reasonFilter = document.querySelector("#reasonFilter");
const searchInput = document.querySelector("#searchInput");
const resetFilters = document.querySelector("#resetFilters");
const connectM365 = document.querySelector("#connectM365");
const connectionStatus = document.querySelector(".connection-status");
const connectionTitle = document.querySelector("#connectionTitle");
const connectionMessage = document.querySelector("#connectionMessage");
const deviceCodeBox = document.querySelector("#deviceCodeBox");
const deviceCodeValue = document.querySelector("#deviceCodeValue");
const copyDeviceCode = document.querySelector("#copyDeviceCode");
const loadAltas = document.querySelector("#loadAltas");
const altasSummary = document.querySelector("#altasSummary");
const altasStatus = document.querySelector("#altasStatus");
const altasTable = document.querySelector("#altasTable");

let altas = [];

function uniqueValues(key) {
  return [...new Set(cases.map((item) => item[key]))].sort((a, b) => a.localeCompare(b));
}

function populateSelect(select, values) {
  const firstOption = select.querySelector("option");
  select.innerHTML = "";
  select.appendChild(firstOption);

  values.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  });
}

function getFilteredCases() {
  const period = periodFilter.value;
  const agent = agentFilter.value;
  const reason = reasonFilter.value;
  const query = searchInput.value.trim().toLowerCase();

  return cases.filter((item) => {
    const inPeriod = period === "all" || item.date.startsWith(period);
    const byAgent = agent === "all" || item.agent === agent;
    const byReason = reason === "all" || item.reason === reason;
    const haystack = `${item.client} ${item.status} ${item.reading}`.toLowerCase();
    const byQuery = !query || haystack.includes(query);
    return inPeriod && byAgent && byReason && byQuery;
  }).sort((a, b) => new Date(b.date) - new Date(a.date));
}

function countBy(items, key) {
  return items.reduce((acc, item) => {
    acc[item[key]] = (acc[item[key]] || 0) + 1;
    return acc;
  }, {});
}

function statusClass(status) {
  const normalized = normalizeText(status);
  if (normalized.includes("noreten")) return "no-retenida";
  if (normalized.includes("reten")) return "retenida";
  if (normalized.includes("gestion") || normalized.includes("pendiente") || normalized.includes("abiert")) return "gestion";
  return "baja";
}

function render() {
  const filtered = getFilteredCases();
  const retained = filtered.filter((item) => item.retained).length;
  const active = filtered.filter((item) => item.status === "En gestion").length;
  const retention = filtered.length ? Math.round((retained / filtered.length) * 100) : 0;
  const reasons = countBy(filtered, "reason");
  const topReason = Object.entries(reasons).sort((a, b) => b[1] - a[1])[0];

  document.querySelector("#totalRequests").textContent = filtered.length;
  document.querySelector("#retainedRequests").textContent = retained;
  document.querySelector("#activeRequests").textContent = active;
  document.querySelector("#retentionRate").textContent = `${retention}% de retención`;
  document.querySelector("#topReason").textContent = topReason ? topReason[0] : "-";
  document.querySelector("#topReasonCount").textContent = topReason ? `${topReason[1]} casos` : "0 casos";
  document.querySelector("#tableSummary").textContent = `${filtered.length} casos filtrados para análisis comercial.`;

  renderReasonBars(filtered, reasons);
  renderCityBars(filtered);
  renderAgentComparison(filtered);
  renderTable(filtered);
}

function renderReasonBars(filtered, reasons) {
  renderComparisonByKey("#reasonBars", filtered, "reason", "motivos");
}

function renderCityBars(filtered) {
  renderComparisonByKey("#cityBars", filtered, "city", "localidades");
}

function renderAgentComparison(filtered) {
  renderComparisonByKey("#agentComparison", filtered, "agent", "agentes");
}

function renderComparisonByKey(selector, filtered, key, emptyLabel) {
  const container = document.querySelector(selector);
  const summaries = [...new Set(filtered.map((item) => item[key]))]
    .map((label) => {
      const items = filtered.filter((item) => item[key] === label);
      const retained = items.filter((item) => item.retained).length;
      return { label, managed: items.length, retained };
    })
    .sort((a, b) => b.managed - a.managed || b.retained - a.retained || a.label.localeCompare(b.label));
  const max = Math.max(...summaries.map((item) => item.managed), 1);

  container.innerHTML = "";

  if (!summaries.length) {
    container.innerHTML = `<p class="empty">Sin ${emptyLabel} para los filtros seleccionados.</p>`;
    return;
  }

  summaries.forEach(({ label, managed, retained }) => {
    const row = document.createElement("div");
    row.className = "compare-row";
    row.innerHTML = `
      <strong>${escapeHtml(label)}</strong>
      <div class="compare-bars">
        <span class="compare-label">Gestionadas</span>
        <div class="bar-track"><div class="bar-fill managed" style="width:${(managed / max) * 100}%"></div></div>
        <b>${managed}</b>
        <span class="compare-label">Retenidas</span>
        <div class="bar-track"><div class="bar-fill retained-fill" style="width:${(retained / max) * 100}%"></div></div>
        <b>${retained}</b>
      </div>
    `;
    container.appendChild(row);
  });
}

function renderTable(filtered) {
  const tbody = document.querySelector("#casesTable");
  tbody.innerHTML = "";

  filtered.forEach((item) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${formatDate(item.date)}</td>
      <td><strong>${escapeHtml(item.client)}</strong></td>
      <td>${escapeHtml(item.reason)}</td>
      <td>${escapeHtml(item.agent)}</td>
      <td><span class="status-pill ${statusClass(item.status)}">${escapeHtml(item.status)}</span></td>
      <td>${escapeHtml(item.reading)}</td>
    `;
    tbody.appendChild(tr);
  });
}

async function loadAltasFromApi() {
  const month = getSelectedMonth();

  if (!month) {
    setAltasStatus("Elegí un mes para consultar instalaciones.", "error");
    return;
  }

  loadAltas.disabled = true;
  loadAltas.classList.add("is-loading");
  setAltasStatus("Consultando instalaciones del mes seleccionado...", "pending");

  try {
    const payload = await requestJson(`/api/altas/installations?month=${encodeURIComponent(month)}`);
    altas = Array.isArray(payload.value) ? payload.value.map(mapInstallationToAlta) : [];
    renderAltas(payload);
    setAltasStatus(`Se cargaron ${altas.length} instalaciones para ${monthLabel(month)}.`, "connected");
  } catch (error) {
    altas = [];
    renderAltas();
    setAltasStatus(error.message || "No se pudieron cargar las altas.", "error");
  } finally {
    loadAltas.disabled = false;
    loadAltas.classList.remove("is-loading");
  }
}

function renderAltas(payload = {}) {
  const month = getSelectedMonth();
  const visibleAltas = altas
    .filter((item) => !month || item.date.startsWith(month))
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  const cities = new Set(visibleAltas.map((item) => item.city).filter(Boolean));
  const statuses = new Set(visibleAltas.map((item) => item.status).filter(Boolean));

  document.querySelector("#altasTotal").textContent = visibleAltas.length;
  document.querySelector("#altasCities").textContent = cities.size;
  document.querySelector("#altasStatuses").textContent = statuses.size;
  altasSummary.textContent = month
    ? `Instalaciones de ${monthLabel(month)} desde Jobs.`
    : "Instalaciones por mes desde Jobs.";

  altasTable.innerHTML = "";

  if (!visibleAltas.length) {
    altasTable.innerHTML = `
      <tr>
        <td colspan="6" class="empty-cell">${escapeHtml(payload.message || "Sin instalaciones para mostrar.")}</td>
      </tr>
    `;
    return;
  }

  visibleAltas.forEach((item) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${formatDate(item.date)}</td>
      <td><strong>${escapeHtml(item.customer)}</strong></td>
      <td>${escapeHtml(item.city)}</td>
      <td>${escapeHtml(item.service)}</td>
      <td><span class="status-pill ${statusClass(item.status)}">${escapeHtml(item.status)}</span></td>
      <td>${escapeHtml(item.responsible)}</td>
    `;
    altasTable.appendChild(tr);
  });
}

function mapInstallationToAlta(item) {
  const fields = flattenObject(item);

  return {
    date: toIsoDate(readField(fields, [
      "Fecha",
      "Date",
      "Created",
      "CreatedAt",
      "InstallationDate",
      "InstallationStartDate",
      "ScheduledDate",
      "DateFrom",
    ])),
    customer: readField(fields, [
      "CustomerName",
      "Customer",
      "Cliente",
      "Client",
      "Name",
      "FullName",
      "BusinessName",
      "Title",
    ]) || "Sin cliente",
    city: readField(fields, [
      "ServiceCity",
      "Localidad",
      "City",
      "Town",
      "Location",
      "AddressCity",
    ]) || "Sin localidad",
    service: readField(fields, [
      "Plan",
      "Service",
      "ServiceName",
      "InternetService",
      "InternetServicePlan",
      "Offering",
      "Product",
    ]) || "Sin servicio",
    status: readField(fields, [
      "Status",
      "State",
      "Estado",
      "InstallationStatus",
      "JobStatus",
      "Result",
    ]) || "Sin estado",
    responsible: readField(fields, [
      "Agent",
      "Agente",
      "Technician",
      "Tecnico",
      "Técnico",
      "AssignedTo",
      "Responsible",
      "Empleado",
      "Employee",
    ]) || "Sin responsable",
    raw: item,
  };
}

populateSelect(agentFilter, uniqueValues("agent"));
populateSelect(reasonFilter, uniqueValues("reason"));

[periodFilter, agentFilter, reasonFilter, searchInput].forEach((control) => {
  control.addEventListener("input", () => {
    render();
    if (getActiveView() === "altas") renderAltas();
  });
});

resetFilters.addEventListener("click", () => {
  periodFilter.value = "all";
  agentFilter.value = "all";
  reasonFilter.value = "all";
  searchInput.value = "";
  render();
});

connectM365.addEventListener("click", connectToM365);
loadAltas.addEventListener("click", loadAltasFromApi);

async function connectToM365() {
  setConnectionState("Conectando con Microsoft 365", "Iniciando autenticación corporativa...", "pending");
  connectM365.classList.add("is-loading");
  connectM365.disabled = true;
  let loginPopup = null;

  try {
    const currentStatus = await requestJson("/api/m365/auth/status");

    if (currentStatus.authenticated) {
      setDeviceCode("");
      setConnectionState("Microsoft 365 conectado", "Cuenta corporativa autenticada. Cargando SharePoint...", "connected");
      try {
        await loadSharePointBajas();
        return;
      } catch {
        setConnectionState("Sesión vencida", "Generando un nuevo código de Microsoft...", "pending");
      }
    }

    loginPopup = openMicrosoftPopup();
    await requestJson("/api/m365/auth/start", { method: "POST" });
    const login = await waitForDeviceCode();

    if (login.verificationUri && loginPopup) {
      loginPopup.location.href = login.verificationUri;
      loginPopup.focus();
    } else if (login.verificationUri) {
      openMicrosoftPopup(login.verificationUri);
    }

    setConnectionState(
      "Código Microsoft",
      formatDeviceCodeMessage(login),
      "pending"
    );
    await pollM365Status();
    await loadSharePointBajas();
  } catch (error) {
    if (loginPopup && !loginPopup.closed) {
      loginPopup.close();
    }
    setConnectionState(
      "No se pudo iniciar la conexión",
      error.message || "Ejecuta el tablero con el servidor M365 local y vuelve a intentarlo.",
      "error"
    );
  } finally {
    connectM365.classList.remove("is-loading");
    connectM365.disabled = false;
  }
}

async function waitForDeviceCode() {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const status = await requestJson("/api/m365/auth/status");

    if (status.userCode && status.verificationUri) {
      return status;
    }

    await wait(500);
  }

  throw new Error("No se pudo generar el código de Microsoft.");
}

async function pollM365Status() {
  for (let attempt = 0; attempt < 90; attempt += 1) {
    const status = await requestJson("/api/m365/auth/status");

    if (status.authenticated) {
      setConnectionState("Microsoft 365 conectado", "Cuenta corporativa autenticada. Ya se puede consultar SharePoint.", "connected");
      return;
    }

    setConnectionState(
      status.pending ? "Esperando autenticación" : "Microsoft 365 sin conectar",
      status.userCode ? "Ingresá el código en la ventana de Microsoft." : status.message || "Sigue las instrucciones del inicio de sesión.",
      status.pending ? "pending" : "error"
    );
    setDeviceCode(status.userCode || "");

    await wait(2000);
  }

  setConnectionState("Tiempo de conexión agotado", "No se completó el login dentro del tiempo esperado.", "error");
}

async function loadSharePointBajas() {
  setConnectionState("Leyendo SharePoint", "Consultando solicitudes de baja 2026...", "pending");

  const payload = await requestJson("/api/sharepoint/bajas/items?year=2026");
  const source = payload.source || {};
  const items = payload.value || [];

  window.cmrSharePointBajas = items;
  cases = items.length ? items.map(mapSharePointItemToCase) : [];
  refreshFilters();
  render();

  setConnectionState(
    "SharePoint conectado",
    `La sección Bajas está usando ${payload.count || 0} ítems reales de 2026 en ${source.hostname || "SharePoint"}${source.sitePath || ""} / ${source.listName || "Solicitudes de baja"}.`,
    "connected"
  );
}

function mapSharePointItemToCase(item) {
  const fields = item.fields || {};
  const status = readField(fields, [
    "Estadoderetenci_x00f3_n",
    "Estado",
    "Status",
    "Estado de solicitud",
    "EstadoSolicitud",
    "Resultado",
    "Resultado de retencion",
    "ResultadoRetencion",
  ]);
  const retainedValue = readField(fields, [
    "Estadoderetenci_x00f3_n",
    "Retencion",
    "Retención",
    "Retenido",
    "Retenida",
    "Resultado de retencion",
    "ResultadoRetencion",
    "Resultado",
    "Estado",
  ]);

  return {
    date: toIsoDate(readField(fields, [
      "Fecha",
      "Fecha de solicitud",
      "FechaSolicitud",
      "Created",
      "Modified",
    ]) || item.createdDateTime || item.lastModifiedDateTime),
    client: readField(fields, [
      "CustomerName",
      "CustomerId",
      "Cliente",
      "Cuenta",
      "Razon social",
      "Razón social",
      "Title",
      "Nombre",
    ]) || `Ítem ${item.id}`,
    reason: readField(fields, [
      "Motivorealdebaja",
      "UnsubscribeReason",
      "Motivo",
      "Motivo de baja",
      "MotivoBaja",
      "Causa",
      "Tipo de baja",
    ]) || "Sin clasificar",
    agent: readField(fields, [
      "CargadoPor",
      "Agente",
      "Gestor",
      "Responsable",
      "Gestionado por",
      "Asesor",
      "Vendedor",
    ]) || "Sin agente",
    city: readField(fields, [
      "ServiceCity",
      "Localidad",
      "Ciudad",
      "City",
    ]) || "Sin localidad",
    status: status || "Sin estado",
    retained: isRetained(retainedValue || status),
    reading: readField(fields, [
      "Observaciones",
      "ContactInfo",
      "LinkToIssue",
      "Comentario",
      "Comentarios",
      "Detalle",
      "Lectura comercial",
      "Gestion",
      "Gestión",
    ]) || "Sin comentario cargado",
    raw: fields,
    webUrl: item.webUrl,
  };
}

function readField(fields, labels) {
  const entries = Object.entries(fields);

  for (const label of labels) {
    const normalizedLabel = normalizeText(label);
    const exact = entries.find(([key]) => normalizeText(key) === normalizedLabel);
    if (exact && hasValue(exact[1])) return valueToText(exact[1]);
  }

  for (const label of labels) {
    const normalizedLabel = normalizeText(label);
    const partial = entries.find(([key]) => normalizeText(key).includes(normalizedLabel));
    if (partial && hasValue(partial[1])) return valueToText(partial[1]);
  }

  return "";
}

function valueToText(value) {
  if (Array.isArray(value)) return value.map(valueToText).filter(Boolean).join(", ");
  if (value && typeof value === "object") {
    return value.displayName || value.email || value.lookupValue || JSON.stringify(value);
  }
  return String(value).trim();
}

function flattenObject(value, prefix = "", output = {}) {
  if (!value || typeof value !== "object") return output;

  Object.entries(value).forEach(([key, entry]) => {
    const path = prefix ? `${prefix}.${key}` : key;

    if (entry && typeof entry === "object" && !Array.isArray(entry)) {
      flattenObject(entry, path, output);
      if (!output[key]) output[key] = entry;
      return;
    }

    output[path] = entry;
    if (!output[key]) output[key] = entry;
  });

  return output;
}

function hasValue(value) {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

function isRetained(value) {
  const normalized = normalizeText(value);
  if (normalized.includes("noreten")) return false;
  return normalized.includes("reten") || normalized.includes("recuper") || normalized === "si";
}

function toIsoDate(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return new Date().toISOString().slice(0, 10);
  return date.toISOString().slice(0, 10);
}

function formatDate(value) {
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("es-AR");
}

function refreshFilters() {
  agentFilter.value = "all";
  reasonFilter.value = "all";
  periodFilter.value = "all";
  searchInput.value = "";
  populateSelect(agentFilter, uniqueValues("agent"));
  populateSelect(reasonFilter, uniqueValues("reason"));
}

function getSelectedMonth() {
  return periodFilter.value === "all" ? "" : periodFilter.value;
}

function monthLabel(month) {
  const [year, monthNumber] = month.split("-");
  const date = new Date(Number(year), Number(monthNumber) - 1, 1);
  return date.toLocaleDateString("es-AR", { month: "long", year: "numeric" });
}

function setAltasStatus(message, state) {
  altasStatus.textContent = message;
  altasStatus.classList.toggle("connected", state === "connected");
  altasStatus.classList.toggle("error", state === "error");
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.message || `HTTP ${response.status}`);
  }

  return payload;
}

function setConnectionState(title, message, state, authUrl = "") {
  connectionStatus.classList.toggle("connected", state === "connected");
  connectionStatus.classList.toggle("error", state === "error");
  connectionTitle.textContent = title;
  connectionMessage.textContent = message;

  if (authUrl) {
    const link = document.createElement("a");
    link.href = authUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = " Abrir Microsoft Login";
    connectionMessage.appendChild(link);
  }
}

function formatDeviceCodeMessage(payload) {
  if (!payload.userCode) {
    return "Generando código...";
  }

  setDeviceCode(payload.userCode);
  return "Copiá el código y pegalo en la ventana de Microsoft.";
}

function setDeviceCode(code) {
  deviceCodeValue.textContent = code;
  deviceCodeBox.hidden = !code;
}

copyDeviceCode.addEventListener("click", async () => {
  const code = deviceCodeValue.textContent.trim();
  if (!code) return;

  try {
    await navigator.clipboard.writeText(code);
    copyDeviceCode.textContent = "Copiado";
  } catch {
    const range = document.createRange();
    range.selectNodeContents(deviceCodeValue);
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(range);
    copyDeviceCode.textContent = "Seleccionado";
  }

  setTimeout(() => {
    copyDeviceCode.textContent = "Copiar código";
  }, 1800);
});

function openMicrosoftPopup(url = "about:blank") {
  const width = 540;
  const height = 720;
  const left = Math.max(0, Math.round((window.screen.width - width) / 2));
  const top = Math.max(0, Math.round((window.screen.height - height) / 2));

  return window.open(
    url,
    "m365-login",
    `popup=yes,width=${width},height=${height},left=${left},top=${top},noopener,noreferrer`
  );
}

function wait(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

async function loadIfAlreadyConnected() {
  try {
    const status = await requestJson("/api/m365/auth/status");

    if (status.authenticated) {
      setConnectionState("Microsoft 365 conectado", "Cargando Solicitudes de baja desde SharePoint...", "connected");
      await loadSharePointBajas();
    }
  } catch {
    // El tablero puede abrirse como archivo local; en ese caso no hay backend M365.
  }
}

document.querySelectorAll(".nav-item").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".nav-item").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    setActiveView(button.dataset.section);
  });
});

function setActiveView(section) {
  const view = section === "retencion" || section === "altas" ? section : "bajas";
  document.querySelectorAll(".view-section").forEach((element) => {
    element.classList.toggle("active", element.dataset.view === view);
  });
  const titles = {
    bajas: "Bajas",
    altas: "Altas",
    retencion: "Análisis de bajas",
  };
  document.querySelector("h1").textContent = titles[view];
  if (view === "altas") renderAltas();
}

function getActiveView() {
  const active = document.querySelector(".view-section.active");
  return active?.dataset.view || "bajas";
}

render();
loadIfAlreadyConnected();
