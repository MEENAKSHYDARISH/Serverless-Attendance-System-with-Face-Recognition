const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const resultBox = document.getElementById("resultBox");

const token = localStorage.getItem("idToken");

if (!token || isTokenExpired(token)) {
  logout();
}
setInterval(refreshToken, 50 * 60 * 1000);
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

async function getUploadUrl() {
  const res = await fetch(`${window.APP_CONFIG.API_BASE_URL}/upload-url`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
    },
    body: JSON.stringify({}),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error("Failed to get upload URL");
  }
  // If body is string (API Gateway case), parse it
  return typeof data.body === "string" ? JSON.parse(data.body) : data;
}

async function uploadImage(uploadUrl, blob) {
  await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": "image/jpeg" },
    body: blob,
  });
}

async function pollResult(uploadId) {
  for (let i = 0; i < 10; i += 1) {
    const res = await fetch(
      `${window.APP_CONFIG.API_BASE_URL}/result/${uploadId}`,
      {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("accessToken")}`, // ✅ ADD
        },
      },
    );
    if (!res.ok) {
      return { state: "ERROR", message: "API failed" };
    }
    const data = await res.json();
    if (data.state && data.state !== "PENDING") return data;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  return { state: "TIMEOUT", message: "No response within polling window" };
}

async function captureAndSubmit() {
  try {
    // existing code
    resultBox.textContent = "Capturing...";

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.92),
    );
    const presign = await getUploadUrl();
    console.log("PRESIGN RESPONSE:", presign);
    await uploadImage(presign.upload_url, blob);

    resultBox.textContent = "Uploaded. Waiting for recognition...";
    const result = await pollResult(presign.upload_id);
    resultBox.textContent = JSON.stringify(result, null, 2);
  } catch (err) {
    resultBox.textContent = "Error: " + err.message;
  }
}

document
  .getElementById("startCameraBtn")
  .addEventListener("click", startCamera);
document
  .getElementById("captureBtn")
  .addEventListener("click", captureAndSubmit);
