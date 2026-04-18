const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const resultBox = document.getElementById("resultBox");

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

// 🟢 STEP 1: Get upload URL (✅ FIXED ENDPOINT)
async function getUploadUrl() {
  const res = await fetch(
    `${window.APP_CONFIG.API_BASE_URL}/checkin-upload-url`, // ✅ CHANGED
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    },
  );

  const data = await res.json();

  if (!res.ok) {
    console.error("UPLOAD URL ERROR:", data);
    throw new Error(data.message || "Failed to get upload URL");
  }

  return typeof data.body === "string" ? JSON.parse(data.body) : data;
}

// 🟢 STEP 2: Upload image to S3 (✅ added validation)
async function uploadImage(uploadUrl, blob) {
  const res = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": "image/jpeg",
    },
    body: blob,
  });

  if (!res.ok) {
    throw new Error("Image upload failed");
  }
}

// 🟢 STEP 3: Poll result (unchanged but solid)
async function pollResult(uploadId) {
  for (let i = 0; i < 10; i++) {
    const res = await fetch(
      `${window.APP_CONFIG.API_BASE_URL}/result/${uploadId}`,
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
    resultBox.textContent = "📸 Capturing...";

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.92),
    );

    if (!blob) throw new Error("Failed to capture image");

    // STEP 1
    const presign = await getUploadUrl();
    console.log("PRESIGN RESPONSE:", presign);

    // STEP 2
    await uploadImage(presign.uploadUrl, blob);

    resultBox.textContent = "⏳ Processing face recognition...";

    // STEP 3
    const result = await pollResult(presign.uploadId);

    if (result.state === "TIMEOUT") {
      resultBox.textContent = "⚠️ Recognition taking too long. Try again.";
    } else {
      resultBox.textContent = JSON.stringify(result, null, 2);
    }
  } catch (err) {
    console.error(err);
    resultBox.textContent = "❌ Error: " + err.message;
  }
}

// 🎮 Buttons
document
  .getElementById("startCameraBtn")
  .addEventListener("click", startCamera);

document
  .getElementById("captureBtn")
  .addEventListener("click", captureAndSubmit);
