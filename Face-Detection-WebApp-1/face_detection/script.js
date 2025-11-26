
const imageUpload = document.getElementById('imageUpload');
const inputImage = document.getElementById('inputImage');
const canvas = document.getElementById('overlay');
const videoCanvas = document.getElementById('videoCanvas');
const statusDiv = document.getElementById('status');
const video = document.getElementById('video');
const startBtn = document.getElementById('startWebcam');
const stopBtn = document.getElementById('stopWebcam');

let modelsLoaded = false;
let stream = null;
let detecting = false;
let rafId = null;


statusDiv.textContent = "Loading AI models... Please wait";


Promise.all([
  faceapi.nets.ssdMobilenetv1.loadFromUri('https://justadudewhohacks.github.io/face-api.js/models'),
  faceapi.nets.faceLandmark68Net.loadFromUri('https://justadudewhohacks.github.io/face-api.js/models')
])
  .then(() => {
    modelsLoaded = true;
    statusDiv.textContent = "Models loaded successfully! You can upload an image or start webcam.";
  })
  .catch(err => {
    console.error("Error loading models:", err);
    statusDiv.textContent = "Error loading models.";
  });



imageUpload.addEventListener('change', async () => {
  if (!modelsLoaded) return alert("Models still loading.");

  stopWebcamStream();

  const file = imageUpload.files[0];
  if (!file) return;

  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  inputImage.style.display = 'none';
  video.style.display = 'none';
  videoCanvas.style.display = 'none';
  canvas.style.display = 'block';
  statusDiv.textContent = "Detecting faces...";

  const reader = new FileReader();
  reader.onload = () => (inputImage.src = reader.result);
  reader.readAsDataURL(file);

  inputImage.onload = async () => {
    inputImage.style.display = 'block';

    canvas.width = inputImage.width;
    canvas.height = inputImage.height;

    try {
      const detections = await faceapi
        .detectAllFaces(inputImage, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
        .withFaceLandmarks();

      statusDiv.textContent = detections.length
        ? `${detections.length} face(s) detected!`
        : "No faces detected.";

      const resized = faceapi.resizeResults(detections, {
        width: inputImage.width,
        height: inputImage.height
      });

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      faceapi.draw.drawDetections(canvas, resized);
    } catch (err) {
      console.error("Detection error:", err);
      statusDiv.textContent = "Error detecting faces.";
    }
  };
});



async function startWebcamStream() {
  if (!modelsLoaded) return alert("Models still loading.");

  stopWebcamStream();

  try {
    stream = await navigator.mediaDevices.getUserMedia({ 
      video: { 
        width: { ideal: 640 },
        height: { ideal: 480 },
        facingMode: 'user'
      } 
    });
    video.srcObject = stream;
    video.style.display = 'block';
    inputImage.style.display = 'none';
    canvas.style.display = 'none';
    videoCanvas.style.display = 'block';

    await new Promise(resolve => {
      video.onloadedmetadata = () => {
        video.play();
        resolve();
      };
    });

    // Set canvas dimensions to match video
    videoCanvas.width = video.videoWidth;
    videoCanvas.height = video.videoHeight;
    videoCanvas.style.width = '100%';
    videoCanvas.style.height = 'auto';
    videoCanvas.style.position = 'absolute';
    videoCanvas.style.top = '0';
    videoCanvas.style.left = '0';
    videoCanvas.style.pointerEvents = 'none';

    detecting = true;
    startBtn.disabled = true;
    stopBtn.disabled = false;
    statusDiv.textContent = "Webcam started. Detecting faces...";

    detectLoop();

  } catch (err) {
    console.error("Webcam error:", err);
    statusDiv.textContent = "Cannot access webcam. Please allow camera permission.";
  }
}


function stopWebcamStream() {
  detecting = false;
  startBtn.disabled = false;
  stopBtn.disabled = true;

  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }

  if (stream) {
    stream.getTracks().forEach(track => track.stop());
    stream = null;
  }
  video.srcObject = null;
  video.style.display = 'none';
  videoCanvas.style.display = 'none';
  canvas.style.display = 'block';

  const ctx = videoCanvas.getContext('2d');
  ctx.clearRect(0, 0, videoCanvas.width, videoCanvas.height);

  statusDiv.textContent = "Webcam stopped.";
}



async function detectLoop() {
  if (!detecting) return;

  rafId = requestAnimationFrame(detectLoop);

  if (video.readyState !== 4) return;

  try {
    const detections = await faceapi
      .detectAllFaces(video, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
      .withFaceLandmarks();

    const ctx = videoCanvas.getContext('2d');
    ctx.clearRect(0, 0, videoCanvas.width, videoCanvas.height);

    if (detections.length > 0) {
      const resized = faceapi.resizeResults(detections, {
        width: video.videoWidth,
        height: video.videoHeight
      });

      // Draw bounding boxes on detected faces
      faceapi.draw.drawDetections(videoCanvas, resized);
      
      // Optionally draw landmarks (uncomment if desired)
      // faceapi.draw.drawFaceLandmarks(videoCanvas, resized);

      statusDiv.textContent = `${detections.length} face(s) detected (live).`;
    } else {
      statusDiv.textContent = "No faces detected (live).";
    }
  } catch (err) {
    console.error("Detection error:", err);
  }
}


startBtn.addEventListener('click', startWebcamStream);
stopBtn.addEventListener('click', stopWebcamStream);
