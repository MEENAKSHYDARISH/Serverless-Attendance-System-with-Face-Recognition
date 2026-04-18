const token = localStorage.getItem("idToken");

if (!token || isTokenExpired(token)) {
  logout();
}

setInterval(refreshToken, 50 * 60 * 1000);

// ================================
// 🧾 REGISTER EMPLOYEE
// ================================
async function registerEmployee() {
  const employee_id = document.getElementById("regEmployeeId").value;
  const name = document.getElementById("regName").value;
  const department = document.getElementById("regDepartment").value;
  const shift = document.getElementById("regShift").value || "09:00:00";
  const file = document.getElementById("photoInput").files[0];

  if (!employee_id || !name || !file) {
    alert("Employee ID, Name and Photo are required");
    return;
  }

  try {
    // 🪄 Step 1: Upload image to S3 (reuse presign API)
    const uploadRes = await fetch(
      `${window.APP_CONFIG.API_BASE_URL}/upload-url`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    const uploadData = await uploadRes.json();

    console.log("UPLOAD RESPONSE:", uploadData);
    console.log("SENDING s3Key:", uploadData.s3Key);

    // ✅ FIXED KEYS
    if (!uploadData.uploadUrl || !uploadData.s3Key) {
      console.error("Missing fields:", uploadData);
      alert("Upload URL failed");
      return;
    }

    // upload image to S3
    await fetch(uploadData.uploadUrl, {
      method: "PUT",
      body: file,
      headers: {
        "Content-Type": "image/jpeg",
      },
    });

    // send to backend
    const res = await fetch(
      `${window.APP_CONFIG.API_BASE_URL}/admin/register-employee`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          employee_id,
          name,
          department,
          shift_start_local: shift,
          s3_key: uploadData.s3Key, // ✅ correct
        }),
      },
    );

    const data = await res.json();
    if (res.ok) {
      document.getElementById("registerStatus").innerText =
        "✅ Employee registered successfully";
    } else {
      console.error("REGISTER ERROR:", data);
      document.getElementById("registerStatus").innerText =
        "❌ " + (data.message || "Registration failed");
    }
  } catch (err) {
    console.error(err);
    alert("Registration error");
  }
}

document
  .getElementById("registerBtn")
  .addEventListener("click", registerEmployee);

// ================================
// 📊 ATTENDANCE (existing code)
// ================================
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
  console.log("DATE FROM:", dateFrom);
  console.log("DATE TO:", dateTo);
  const res = await fetch(
    `${window.APP_CONFIG.API_BASE_URL}/admin/attendance?${query}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  const data = await res.json();
  const items = data.items || [];

  renderTable(items);
  renderSummary(items);
}

document.getElementById("loadBtn").addEventListener("click", loadRecords);
