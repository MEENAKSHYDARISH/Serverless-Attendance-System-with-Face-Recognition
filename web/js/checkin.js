const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const resultBox = document.getElementById("resultBox");

const token = localStorage.getItem("idToken");

// 🔍 Debug
console.log("TOKEN:", token);
if (token) {
  const payload = JSON.parse(atob(token.split(".")[1]));
  console.log("TOKEN PAYLOAD:", payload);
}

if (!token || isTokenExpired(token)) {
  logout();
}

setInterval(refreshToken, 50 * 60 * 1000);

// 🎥 Start camera
async function startCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: false,
    });
    video.srcObject = stream;
  } catch (err) {
    alert("Camera access denied");
  }
}

// 🟢 STEP 1: Get upload URL
async function getUploadUrl() {
  const res = await fetch(`${window.APP_CONFIG.API_BASE_URL}/upload-url`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await res.json();

  if (!res.ok) {
    console.error("UPLOAD URL ERROR:", data);
    throw new Error(data.message || "Failed to get upload URL");
  }

  // Handle API Gateway format
  return typeof data.body === "string" ? JSON.parse(data.body) : data;
}

// 🟢 STEP 2: Upload image to S3
async function uploadImage(uploadUrl, blob) {
  await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": "image/jpeg",
    },
    body: blob,
  });
}

// 🟢 STEP 3: Poll result
async function pollResult(uploadId) {
  for (let i = 0; i < 10; i++) {
    const res = await fetch(
      `${window.APP_CONFIG.API_BASE_URL}/result/${uploadId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    const data = await res.json();

    if (!res.ok) {
      console.error("RESULT ERROR:", data);
      throw new Error(data.message || "Failed to fetch result");
    }

    if (data.state && data.state !== "PENDING") {
      return data;
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  return {
    state: "TIMEOUT",
    message: "No response within polling window",
  };
}

// 🎯 Main flow
async function captureAndSubmit() {
  try {
    resultBox.textContent = "Capturing...";

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.92),
    );

    // STEP 1
    const presign = await getUploadUrl();
    console.log("PRESIGN RESPONSE:", presign);

    // STEP 2 ✅ FIXED keys
    await uploadImage(presign.uploadUrl, blob);

    resultBox.textContent = "Uploaded. Waiting for recognition...";

    // STEP 3 ✅ FIXED keys
    const result = await pollResult(presign.uploadId);

    resultBox.textContent = JSON.stringify(result, null, 2);
  } catch (err) {
    console.error(err);
    resultBox.textContent = "Error: " + err.message;
  }
}

// 🎮 Buttons
document
  .getElementById("startCameraBtn")
  .addEventListener("click", startCamera);

document
  .getElementById("captureBtn")
  .addEventListener("click", captureAndSubmit);
