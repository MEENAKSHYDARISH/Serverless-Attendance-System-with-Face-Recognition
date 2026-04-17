<<<<<<< HEAD
function parseJwt(token) {
  if (!token) return null;
  try {
    return JSON.parse(atob(token.split(".")[1]));
  } catch {
    return null;
  }
}

function getAuthToken() {
  const accessToken = localStorage.getItem("accessToken");
  const idToken = localStorage.getItem("idToken");
  const accessGroups = parseJwt(accessToken)?.["cognito:groups"];
  const idGroups = parseJwt(idToken)?.["cognito:groups"];

  if (accessGroups && accessGroups.length) return accessToken;
  if (idGroups && idGroups.length) return idToken;
  return accessToken || idToken;
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
=======
const token = localStorage.getItem("idToken");
>>>>>>> dddbd99 (Admin dashboard fully working)

if (!token || isTokenExpired(token)) {
  logout();
}

setInterval(refreshToken, 50 * 60 * 1000);

<<<<<<< HEAD
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

=======
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
    console.log("SENDING s3_key:", uploadData.s3_key);

    if (!uploadData.upload_url || !uploadData.s3_key) {
      alert("Upload URL failed");
      return;
    }

    await fetch(uploadData.upload_url, {
      method: "PUT",
      body: file,
      headers: {
        "Content-Type": "image/jpeg",
      },
    });

    // 🧠 Step 2: Register in Rekognition + DynamoDB
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
          s3_key: uploadData.s3_key, // VERY IMPORTANT
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
>>>>>>> dddbd99 (Admin dashboard fully working)
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
<<<<<<< HEAD
        Authorization: `Bearer ${getAuthToken()}`,
=======
        Authorization: `Bearer ${token}`,
>>>>>>> dddbd99 (Admin dashboard fully working)
      },
    },
  );

  const data = await res.json();
  const items = data.items || [];

  renderTable(items);
  renderSummary(items);
}

document.getElementById("loadBtn").addEventListener("click", loadRecords);
