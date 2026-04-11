const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const resultBox = document.getElementById('resultBox');

async function startCamera() {
  const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
  video.srcObject = stream;
}

async function getUploadUrl() {
  const res = await fetch(`${window.APP_CONFIG.API_BASE_URL}/upload-url`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${window.APP_CONFIG.ID_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({})
  });
  return res.json();
}

async function uploadImage(uploadUrl, blob) {
  await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'image/jpeg' },
    body: blob
  });
}

async function pollResult(uploadId) {
  for (let i = 0; i < 10; i += 1) {
    const res = await fetch(`${window.APP_CONFIG.API_BASE_URL}/result/${uploadId}`, {
      headers: { Authorization: `Bearer ${window.APP_CONFIG.ID_TOKEN}` }
    });
    const data = await res.json();
    if (data.state && data.state !== 'PENDING') return data;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  return { state: 'TIMEOUT', message: 'No response within polling window' };
}

async function captureAndSubmit() {
  resultBox.textContent = 'Capturing...';

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
  const presign = await getUploadUrl();
  await uploadImage(presign.upload_url, blob);

  resultBox.textContent = 'Uploaded. Waiting for recognition...';
  const result = await pollResult(presign.upload_id);
  resultBox.textContent = JSON.stringify(result, null, 2);
}

document.getElementById('startCameraBtn').addEventListener('click', startCamera);
document.getElementById('captureBtn').addEventListener('click', captureAndSubmit);
