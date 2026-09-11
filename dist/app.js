const cases = [
  {
    date: "2026-09-08",
    client: "Norte Servicios",
    reason: "Precio",
    agent: "Mariana Vega",
    status: "Retenida",
    retained: true,
    reading: "Se ofrecio ajuste temporal y cambio de plan.",
  },
  {
    date: "2026-09-06",
    client: "Estudio Alsina",
    reason: "Mudanza",
    agent: "Bruno Leal",
    status: "En gestion",
    retained: false,
    reading: "Pendiente confirmar nueva zona de cobertura.",
  },
  {
    date: "2026-09-03",
    client: "Distribuidora Sur",
    reason: "Competencia",
    agent: "Sofia Acosta",
    status: "Baja confirmada",
    retained: false,
    reading: "Competidor con paquete bonificado por 6 meses.",
  },
  {
    date: "2026-08-29",
    client: "Consultora Prado",
    reason: "Servicio tecnico",
    agent: "Mariana Vega",
    status: "Retenida",
    retained: true,
    reading: "Se resolvio reclamo historico y quedo seguimiento.",
  },
  {
    date: "2026-08-24",
    client: "La Central Market",
    reason: "Precio",
    agent: "Diego Perez",
    status: "Baja confirmada",
    retained: false,
    reading: "No acepta contraoferta por reduccion de costos.",
  },
  {
    date: "2026-08-17",
    client: "Alem Logistica",
    reason: "Sin uso",
    agent: "Bruno Leal",
    status: "Retenida",
    retained: true,
    reading: "Se reactivo servicio con capacitacion comercial.",
  },
  {
    date: "2026-08-11",
    client: "Clínica Rivera",
    reason: "Servicio tecnico",
    agent: "Sofia Acosta",
    status: "En gestion",
    retained: false,
    reading: "Requiere visita tecnica antes de cerrar decision.",
  },
  {
    date: "2026-07-30",
    client: "Campo Azul",
    reason: "Mudanza",
    agent: "Diego Perez",
    status: "Baja confirmada",
    retained: false,
    reading: "Fuera de zona operativa actual.",
  },
  {
    date: "2026-07-22",
    client: "Gimnasio Nodo",
    reason: "Precio",
    agent: "Mariana Vega",
    status: "Retenida",
    retained: true,
    reading: "Descuento anual contra permanencia.",
  },
  {
    date: "2026-07-12",
    client: "Hotel Alameda",
    reason: "Competencia",
    agent: "Sofia Acosta",
    status: "En gestion",
    retained: false,
    reading: "Comparando velocidad, soporte y permanencia.",
  },
];

const periodFilter = document.querySelector("#periodFilter");
const agentFilter = document.querySelector("#agentFilter");
const reasonFilter = document.querySelector("#reasonFilter");
const searchInput = document.querySelector("#searchInput");
const resetFilters = document.querySelector("#resetFilters");

function uniqueValues(key) {
  return [...new Set(cases.map((item) => item[key]))].sort((a, b) => a.localeCompare(b));
}

function populateSelect(select, values) {
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
  });
}

function countBy(items, key) {
  return items.reduce((acc, item) => {
    acc[item[key]] = (acc[item[key]] || 0) + 1;
    return acc;
  }, {});
}

function statusClass(status) {
  if (status === "Retenida") return "retenida";
  if (status === "En gestion") return "gestion";
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
  renderAgentCards(filtered);
  renderTable(filtered);
}

function renderReasonBars(filtered, reasons) {
  const container = document.querySelector("#reasonBars");
  const max = Math.max(...Object.values(reasons), 1);
  const colors = ["#197c79", "#315f9c", "#c8872d", "#d95a45", "#2f8b57"];

  container.innerHTML = "";

  if (!filtered.length) {
    container.innerHTML = '<p class="empty">Sin casos para los filtros seleccionados.</p>';
    return;
  }

  Object.entries(reasons)
    .sort((a, b) => b[1] - a[1])
    .forEach(([reason, total], index) => {
      const row = document.createElement("div");
      row.className = "bar-row";
      row.innerHTML = `
        <span>${reason}</span>
        <div class="bar-track" aria-label="${reason}: ${total} casos">
          <div class="bar-fill" style="width:${(total / max) * 100}%; background:${colors[index % colors.length]}"></div>
        </div>
        <strong>${total}</strong>
      `;
      container.appendChild(row);
    });
}

function renderAgentCards(filtered) {
  const container = document.querySelector("#agentCards");
  const agents = uniqueValues("agent");

  container.innerHTML = "";

  agents.forEach((agent) => {
    const items = filtered.filter((item) => item.agent === agent);
    const retained = items.filter((item) => item.retained).length;
    const open = items.filter((item) => item.status === "En gestion").length;
    const rate = items.length ? Math.round((retained / items.length) * 100) : 0;
    const card = document.createElement("div");
    card.className = "agent-card";
    card.innerHTML = `
      <strong>${agent}</strong>
      <span class="retention-pill">${rate}%</span>
      <small>${items.length} casos gestionados</small>
      <small>${retained} retenidas · ${open} abiertas</small>
    `;
    container.appendChild(card);
  });
}

function renderTable(filtered) {
  const tbody = document.querySelector("#casesTable");
  tbody.innerHTML = "";

  filtered.forEach((item) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${new Date(`${item.date}T12:00:00`).toLocaleDateString("es-AR")}</td>
      <td><strong>${item.client}</strong></td>
      <td>${item.reason}</td>
      <td>${item.agent}</td>
      <td><span class="status-pill ${statusClass(item.status)}">${item.status}</span></td>
      <td>${item.retained ? "Retenida" : "No retenida"}</td>
      <td>${item.reading}</td>
    `;
    tbody.appendChild(tr);
  });
}

populateSelect(agentFilter, uniqueValues("agent"));
populateSelect(reasonFilter, uniqueValues("reason"));

[periodFilter, agentFilter, reasonFilter, searchInput].forEach((control) => {
  control.addEventListener("input", render);
});

resetFilters.addEventListener("click", () => {
  periodFilter.value = "all";
  agentFilter.value = "all";
  reasonFilter.value = "all";
  searchInput.value = "";
  render();
});

document.querySelectorAll(".nav-item").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".nav-item").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
  });
});

render();
