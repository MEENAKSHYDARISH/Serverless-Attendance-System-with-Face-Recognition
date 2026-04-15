const token = localStorage.getItem("idToken");

if (!token || isTokenExpired(token)) {
  logout();
}
setInterval(refreshToken, 50 * 60 * 1000);

function buildQuery(params) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v) query.set(k, v);
  });
  return query.toString();
}

function renderTable(items) {
  const tbody = document.querySelector("#table tbody");
  tbody.innerHTML = "";
  items.forEach((item) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${item.employee_id || ""}</td>
      <td>${item.employee_name || ""}</td>
      <td>${item.date || ""}</td>
      <td>${item.status || ""}</td>
      <td>${item.clock_in_ts || ""}</td>
      <td>${item.clock_out_ts || ""}</td>
    `;
    tbody.appendChild(tr);
  });
}

function renderSummary(items) {
  const summary = {
    total: items.length,
    present: items.filter((x) => x.status === "PRESENT").length,
    late: items.filter((x) => x.status === "LATE").length,
    absent: items.filter((x) => x.status === "ABSENT").length,
  };
  document.getElementById("summary").textContent =
    `Total: ${summary.total} | Present: ${summary.present} | Late: ${summary.late} | Absent: ${summary.absent}`;
}

async function loadRecords() {
  const employeeId = document.getElementById("employeeId").value;
  const dateFrom = document.getElementById("dateFrom").value;
  const dateTo = document.getElementById("dateTo").value;
  const status = document.getElementById("status").value;

  const query = buildQuery({
    employee_id: employeeId,
    date_from: dateFrom,
    date_to: dateTo,
    status,
  });
  const res = await fetch(
    `${window.APP_CONFIG.API_BASE_URL}/attendance?${query}`,
    {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("idToken")}`,
      },
    },
  );

  const data = await res.json();
  const items = data.items || [];
  renderTable(items);
  renderSummary(items);
}

document.getElementById("loadBtn").addEventListener("click", loadRecords);
