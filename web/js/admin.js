function getAuthToken() {
  return localStorage.getItem("accessToken") || localStorage.getItem("idToken");
}

const token = getAuthToken();

if (token) {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    console.log("ADMIN TOKEN PAYLOAD:", payload);
  } catch (err) {
    console.warn("Failed to decode admin token", err);
  }
}

if (!token || isTokenExpired(token)) {
  logout();
}
setInterval(refreshToken, 50 * 60 * 1000);

// Employee Registration Functions
async function getEmployeePhotoUploadUrl(employeeId, fileName) {
  const res = await fetch(`${window.APP_CONFIG.API_BASE_URL}/upload-url`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getAuthToken()}`,
    },
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || "Failed to get upload URL");
  }

  // Use the raw upload key - register-employee will copy to employee-photos bucket
  return {
    uploadUrl: data.uploadUrl,
    s3Key: data.s3Key,
    uploadId: data.uploadId,
  };
}

async function uploadEmployeePhoto(uploadUrl, file) {
  await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": file.type,
    },
    body: file,
  });
}

async function registerEmployee(employeeId, name, email, password, department, shiftStart, s3Key) {
  console.log(token,"hheheheheh")
  const res = await fetch(`${window.APP_CONFIG.API_BASE_URL}/admin/register-employee`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getAuthToken()}`,
    },
    body: JSON.stringify({
      employee_id: employeeId,
      name: name,
      email: email,
      password: password,
      department: department,
      shift_start_local: shiftStart,
      s3_key: s3Key,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || "Failed to register employee");
  }

  return data;
}

async function handleEmployeeRegistration() {
  const employeeId = document.getElementById("regEmployeeId").value.trim();
  const name = document.getElementById("regName").value.trim();
  const email = document.getElementById("regEmail").value.trim();
  const password = document.getElementById("regPassword").value.trim();
  const department = document.getElementById("regDepartment").value.trim();
  const shiftStart = document.getElementById("regShiftStart").value.trim();
  const photoFile = document.getElementById("regPhoto").files[0];

  if (!employeeId || !name || !email || !password || !photoFile) {
    alert("Please fill in all required fields (ID, Name, Email, Password) and select a photo");
    return;
  }

  const statusDiv = document.getElementById("registerStatus");
  statusDiv.textContent = "Uploading photo...";

  try {
    // Get upload URL
    const uploadData = await getEmployeePhotoUploadUrl(employeeId, photoFile.name);
    
    // Upload photo
    await uploadEmployeePhoto(uploadData.uploadUrl, photoFile);
    statusDiv.textContent = "Photo uploaded. Registering employee...";
    
    // Register employee
    await registerEmployee(employeeId, name, email, password, department, shiftStart, uploadData.s3Key);
    
    statusDiv.textContent = `✅ Employee ${employeeId} registered successfully!`;
    
    // Clear form
    document.getElementById("regEmployeeId").value = "";
    document.getElementById("regName").value = "";
    document.getElementById("regEmail").value = "";
    document.getElementById("regPassword").value = "";
    document.getElementById("regPhoto").value = "";
    
  } catch (error) {
    statusDiv.textContent = `❌ Error: ${error.message}`;
    console.error(error);
  }
}

document.getElementById("registerBtn").addEventListener("click", handleEmployeeRegistration);

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
        Authorization: `Bearer ${getAuthToken()}`,
      },
    },
  );

  const data = await res.json();
  const items = data.items || [];
  renderTable(items);
  renderSummary(items);
}

document.getElementById("loadBtn").addEventListener("click", loadRecords);
