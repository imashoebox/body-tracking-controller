const controls = window;
const LandmarkGrid = window.LandmarkGrid;
const drawingUtils = window;
const mpPose = window;
const options = {
  locateFile: (file) => {
    return `https://cdn.jsdelivr.net/npm/@mediapipe/pose@${mpPose.VERSION}/${file}`;
  }
};
// Our input frames will come from here.
const videoElement = document.getElementsByClassName('input_video')[0];
const canvasElement = document.getElementsByClassName('output_canvas')[0];
const controlsElement = document.getElementsByClassName('control-panel')[0];
const canvasCtx = canvasElement.getContext('2d');
// We'll add this to our control panel later, but we'll save it here so we can
// call tick() each time the graph runs.
// const fpsControl = new controls.FPS();

// Optimization: Turn off animated spinner after its hiding animation is done.
const spinner = document.querySelector('.loading');
spinner.ontransitionend = () => {
  spinner.style.display = 'none';
};

const landmarkContainer = document.getElementsByClassName('landmark-grid-container')[0];
const grid = new LandmarkGrid(landmarkContainer, {
  connectionColor: 0xCCCCCC,
  definedColors: [{ name: 'LEFT', value: 0xffa500 }, { name: 'RIGHT', value: 0x00ffff }],
  range: 2,
  fitToGrid: true,
  labelSuffix: 'm',
  landmarkSize: 2,
  numCellsPerAxis: 4,
  showHidden: false,
  centered: true,
});
let activeEffect = 'mask';

let currentPose = '';
const showPose = document.querySelector('.pose');

function dist(x1, y1, x2, y2) {
  let y = x2 - x1;
  let x = y2 - y1;

  return Math.sqrt(x * x + y * y);
}

function angle(A, B, C) {
  var AB = Math.sqrt(Math.pow(B.x - A.x, 2) + Math.pow(B.y - A.y, 2));
  var BC = Math.sqrt(Math.pow(B.x - C.x, 2) + Math.pow(B.y - C.y, 2));
  var AC = Math.sqrt(Math.pow(C.x - A.x, 2) + Math.pow(C.y - A.y, 2));
  return Math.acos((BC * BC + AB * AB - AC * AC) / (2 * BC * AB)) * 180 / Math.PI;
}

function isJesus(poses) {
  const ARMS = [
    mpPose.POSE_LANDMARKS_RIGHT.RIGHT_WRIST,
    mpPose.POSE_LANDMARKS_RIGHT.RIGHT_ELBOW,
    mpPose.POSE_LANDMARKS_LEFT.LEFT_SHOULDER,
    mpPose.POSE_LANDMARKS_LEFT.LEFT_ELBOW,
    mpPose.POSE_LANDMARKS_LEFT.LEFT_WRIST,
  ];
  const WRIST = [
    mpPose.POSE_LANDMARKS_RIGHT.RIGHT_WRIST,
    mpPose.POSE_LANDMARKS_RIGHT.RIGHT_SHOULDER,
    mpPose.POSE_LANDMARKS_LEFT.LEFT_SHOULDER,
    mpPose.POSE_LANDMARKS_LEFT.LEFT_WRIST,
  ];

  if (ARMS.find(jointIdx => poses[jointIdx].visibility < 0.65)) {
    showPose.textContent = '';
    return;
  }


  const joints = { ...mpPose.POSE_LANDMARKS_RIGHT, ...mpPose.POSE_LANDMARKS_LEFT };

  const baseline = poses[mpPose.POSE_LANDMARKS_RIGHT.RIGHT_SHOULDER].y;
  const ALIGN_THRESHOLD = 0.07;

  let lastX = 0;
  const Ealigned = ARMS.every(jointIdx => {
    const joint = poses[jointIdx];
    const isAligned = joint.visibility >= 0.65 && Math.abs(joint.y - baseline) < ALIGN_THRESHOLD && joint.x > lastX;
    lastX = joint.x;
    return isAligned;
  });

  lastX = 0;
  const Waligned = WRIST.every(jointIdx => {
    const joint = poses[jointIdx];
    const isAligned = Math.abs(joint.y - baseline) < ALIGN_THRESHOLD && joint.x > lastX;
    lastX = joint.x;
    return isAligned;
  }) && angle(poses[joints.RIGHT_WRIST], poses[joints.RIGHT_ELBOW], poses[joints.RIGHT_SHOULDER],) < 100
    && angle(poses[joints.LEFT_WRIST], poses[joints.LEFT_ELBOW], poses[joints.LEFT_SHOULDER],) < 100
    && poses[joints.LEFT_WRIST].y < poses[joints.LEFT_ELBOW].y
    && poses[joints.RIGHT_WRIST].y < poses[joints.RIGHT_ELBOW].y;

  const Aaligned = dist(poses[joints.LEFT_WRIST].x, poses[joints.LEFT_WRIST].y, poses[joints.RIGHT_WRIST].x, poses[joints.RIGHT_WRIST].y) < ALIGN_THRESHOLD
    && poses[joints.RIGHT_ELBOW].y <= poses[joints.RIGHT_SHOULDER].y
    && poses[joints.RIGHT_ELBOW].x <= poses[joints.RIGHT_SHOULDER].x
    && poses[joints.RIGHT_WRIST].y <= poses[joints.RIGHT_ELBOW].y;

  const Saligned = poses[joints.RIGHT_WRIST].y <= poses[joints.LEFT_EYE].y
    && poses[joints.RIGHT_ELBOW].x <= poses[joints.RIGHT_SHOULDER].x
    && poses[joints.LEFT_ELBOW].x >= poses[joints.LEFT_SHOULDER].x
    && poses[joints.RIGHT_WRIST].x <= poses[joints.RIGHT_SHOULDER].x
    && poses[joints.LEFT_WRIST].x >= poses[joints.LEFT_SHOULDER].x
    && poses[joints.LEFT_ELBOW].y > poses[joints.LEFT_SHOULDER].y
    && poses[joints.LEFT_WRIST].y > poses[joints.LEFT_ELBOW].y
    && poses[joints.RIGHT_ELBOW].y < poses[joints.RIGHT_SHOULDER].y
    && poses[joints.RIGHT_WRIST].y < poses[joints.RIGHT_ELBOW].y;

  const Daligned = poses[joints.LEFT_WRIST].y < poses[joints.LEFT_ELBOW].y
    && poses[joints.LEFT_ELBOW].y < poses[joints.LEFT_SHOULDER].y
    && Math.abs(poses[joints.LEFT_WRIST].x - poses[joints.LEFT_SHOULDER].x) < ALIGN_THRESHOLD
    && Math.abs(poses[joints.LEFT_ELBOW].x - poses[joints.LEFT_SHOULDER].x) < ALIGN_THRESHOLD
    && poses[joints.RIGHT_ELBOW].y > poses[joints.RIGHT_SHOULDER].y
    && poses[joints.RIGHT_WRIST].y > poses[joints.RIGHT_ELBOW].y
    && poses[joints.RIGHT_ELBOW].x < poses[joints.RIGHT_SHOULDER].y
    && Math.abs(poses[joints.LEFT_WRIST].x - poses[joints.LEFT_SHOULDER].x) < ALIGN_THRESHOLD;

  const crouchAligned = Math.abs(poses[joints.RIGHT_HIP].y - poses[joints.RIGHT_HEEL].y) < 0.15 && poses[joints.RIGHT_HEEL].visibility > 0.65;

  const jumpAligned = Math.abs(poses[joints.RIGHT_ELBOW].x - poses[joints.RIGHT_SHOULDER].x) <= ALIGN_THRESHOLD
    && Math.abs(poses[joints.RIGHT_WRIST].x - poses[joints.RIGHT_SHOULDER].x) <= ALIGN_THRESHOLD
    && Math.abs(poses[joints.LEFT_ELBOW].x - poses[joints.LEFT_SHOULDER].x) <= ALIGN_THRESHOLD
    && Math.abs(poses[joints.LEFT_WRIST].x - poses[joints.LEFT_SHOULDER].x) <= ALIGN_THRESHOLD
    && poses[joints.LEFT_WRIST].y < poses[joints.LEFT_SHOULDER].y 
    && poses[joints.RIGHT_WRIST].y < poses[joints.RIGHT_SHOULDER].y 
    && dist(poses[joints.LEFT_WRIST].x, poses[joints.LEFT_WRIST].y, poses[joints.RIGHT_WRIST].x, poses[joints.RIGHT_WRIST].y) > ALIGN_THRESHOLD;

  const leftAligned = Math.abs(poses[joints.RIGHT_WRIST].x - poses[joints.RIGHT_SHOULDER].x) <= ALIGN_THRESHOLD
    && Math.abs(poses[joints.RIGHT_ELBOW].x - poses[joints.RIGHT_SHOULDER].x) <= ALIGN_THRESHOLD
    && Math.abs(poses[joints.RIGHT_WRIST].y - poses[joints.RIGHT_SHOULDER].y) <= ALIGN_THRESHOLD
    && Math.abs(poses[joints.RIGHT_ELBOW].y - poses[joints.RIGHT_SHOULDER].y) <= ALIGN_THRESHOLD
    && Math.abs(poses[joints.LEFT_ELBOW].y - poses[joints.LEFT_SHOULDER].y) > ALIGN_THRESHOLD

  const rightAligned = Math.abs(poses[joints.LEFT_WRIST].x - poses[joints.LEFT_SHOULDER].x) <= ALIGN_THRESHOLD
    && Math.abs(poses[joints.LEFT_ELBOW].x - poses[joints.LEFT_SHOULDER].x) <= ALIGN_THRESHOLD
    && Math.abs(poses[joints.LEFT_WRIST].y - poses[joints.LEFT_SHOULDER].y) <= ALIGN_THRESHOLD
    && Math.abs(poses[joints.LEFT_ELBOW].y - poses[joints.LEFT_SHOULDER].y) <= ALIGN_THRESHOLD
    && Math.abs(poses[joints.RIGHT_ELBOW].y - poses[joints.RIGHT_SHOULDER].y) > ALIGN_THRESHOLD

  let rightMouseMove;
  let leftMouseMove;
  if (ARMS.every(jointIdx => {
    const joint = poses[jointIdx];
    const isAligned = Math.abs(joint.y - baseline) < ALIGN_THRESHOLD;
    lastX = joint.x;
    return isAligned;
  })) {
    rightMouseMove = poses[joints.LEFT_WRIST].x < poses[joints.LEFT_SHOULDER].x
      && poses[joints.RIGHT_WRIST].x < poses[joints.RIGHT_SHOULDER].x

    leftMouseMove = poses[joints.RIGHT_WRIST].x > poses[joints.RIGHT_SHOULDER].x
      && poses[joints.LEFT_WRIST].x > poses[joints.LEFT_SHOULDER].x
  }

  let upMouseMove;
  let downMouseMove;
  if (angle(poses[joints.RIGHT_WRIST], poses[joints.RIGHT_ELBOW], poses[joints.RIGHT_SHOULDER],) < 100
    && angle(poses[joints.LEFT_WRIST], poses[joints.LEFT_ELBOW], poses[joints.LEFT_SHOULDER],) < 100
    && Math.abs(poses[joints.RIGHT_ELBOW].y - poses[joints.RIGHT_SHOULDER].y) < ALIGN_THRESHOLD
    && Math.abs(poses[joints.LEFT_ELBOW].y - poses[joints.LEFT_SHOULDER].y) < ALIGN_THRESHOLD) {
    upMouseMove = poses[joints.LEFT_WRIST].y < poses[joints.LEFT_SHOULDER].y
      && poses[joints.RIGHT_WRIST].y < poses[joints.RIGHT_SHOULDER].y

    downMouseMove = poses[joints.LEFT_WRIST].y > poses[joints.LEFT_SHOULDER].y
      && poses[joints.RIGHT_WRIST].y > poses[joints.RIGHT_SHOULDER].y
  }


  currentPose = Waligned ? 'W' : Aaligned ? 'A' : Saligned ? 'S' : Daligned ? 'D' : crouchAligned ? 'SHIFT' : jumpAligned ? 'SPACE' : Ealigned ? 'E' : '';

  window.electronAPI.sendKey(currentPose);

  let currentMousePose = leftAligned ? '1' : rightAligned ? '3' : '';

  window.electronAPI.sendMouse(currentMousePose);

  let currentMouseMoveX = rightMouseMove ? 10 : leftMouseMove ? -10 : 0;

  let currentMouseMoveY = upMouseMove ? -10 : downMouseMove ? 10 : 0;
  const mouseMove = {
    x: currentMouseMoveX,
    y: currentMouseMoveY
  }

  window.electronAPI.sendMouseMove(mouseMove);

  showPose.textContent = currentPose || currentMousePose || (rightMouseMove ? '>' : leftMouseMove ? '<' : upMouseMove ? '^' : downMouseMove ? 'v' : '');
  /* LEFT_ANKLE
        LEFT_EAR
        LEFT_ELBOW
        LEFT_EYE
        LEFT_EYE_INNER
        LEFT_EYE_OUTER
        LEFT_FOOT_INDEX
        LEFT_HEEL
        LEFT_HIP
        LEFT_INDEX
        LEFT_KNEE
        LEFT_PINKY
        LEFT_RIGHT
        LEFT_SHOULDER
        LEFT_THUMB
        LEFT_WRIST
        RIGHT_ANKLE
        RIGHT_EAR
        RIGHT_ELBOW
        RIGHT_EYE
        RIGHT_EYE_INNER
        RIGHT_EYE_OUTER
        RIGHT_FOOT_INDEX
        RIGHT_HEEL
        RIGHT_HIP
        RIGHT_INDEX
        RIGHT_KNEE
        RIGHT_LEFT
        RIGHT_PINKY
        RIGHT_SHOULDER
        RIGHT_THUMB
        RIGHT_WRIST
  */

}
function onResults(results) {
  // Hide the spinner.
  document.body.classList.add('loaded');
  // Update the frame rate.
  // fpsControl.tick();
  // Draw the overlays.
  canvasCtx.save();
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  if (results.segmentationMask) {
    canvasCtx.drawImage(results.segmentationMask, 0, 0, canvasElement.width, canvasElement.height);
    // Only overwrite existing pixels.
    if (activeEffect === 'mask' || activeEffect === 'both') {
      canvasCtx.globalCompositeOperation = 'source-in';
      // This can be a color or a texture or whatever...
      canvasCtx.fillStyle = '#00FF007F';
      canvasCtx.fillRect(0, 0, canvasElement.width, canvasElement.height);
    }
    else {
      canvasCtx.globalCompositeOperation = 'source-out';
      canvasCtx.fillStyle = '#0000FF7F';
      canvasCtx.fillRect(0, 0, canvasElement.width, canvasElement.height);
    }
    // Only overwrite missing pixels.
    canvasCtx.globalCompositeOperation = 'destination-atop';
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);
    canvasCtx.globalCompositeOperation = 'source-over';
  }
  else {
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);
  }
  if (results.poseLandmarks) {
    isJesus(results.poseLandmarks);

    drawingUtils.drawConnectors(canvasCtx, results.poseLandmarks, mpPose.POSE_CONNECTIONS, { visibilityMin: 0.65, color: 'white' });
    drawingUtils.drawLandmarks(canvasCtx, Object.values(mpPose.POSE_LANDMARKS_LEFT)
      .map(index => results.poseLandmarks[index]), { visibilityMin: 0.65, color: 'white', fillColor: 'rgb(255,138,0)' });
    drawingUtils.drawLandmarks(canvasCtx, Object.values(mpPose.POSE_LANDMARKS_RIGHT)
      .map(index => results.poseLandmarks[index]), { visibilityMin: 0.65, color: 'white', fillColor: 'rgb(0,217,231)' });
    drawingUtils.drawLandmarks(canvasCtx, Object.values(mpPose.POSE_LANDMARKS_NEUTRAL)
      .map(index => results.poseLandmarks[index]), { visibilityMin: 0.65, color: 'white', fillColor: 'white' });
  }
  canvasCtx.restore();
  if (results.poseWorldLandmarks) {
    grid.updateLandmarks(results.poseWorldLandmarks, mpPose.POSE_CONNECTIONS, [
      { list: Object.values(mpPose.POSE_LANDMARKS_LEFT), color: 'LEFT' },
      { list: Object.values(mpPose.POSE_LANDMARKS_RIGHT), color: 'RIGHT' },
    ]);
  }
  else {
    grid.updateLandmarks([]);
  }
}
const pose = new mpPose.Pose(options);
pose.onResults(onResults);

// Present a control panel through which the user can manipulate the solution
// options.
new controls
  .ControlPanel(controlsElement, {
    selfieMode: true,
    modelComplexity: 1,
    smoothLandmarks: true,
    enableSegmentation: false,
    smoothSegmentation: true,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5,
    effect: 'background',
  })
  .add([
    // new controls.StaticText({ title: 'MediaPipe Pose' }),
    // fpsControl,
    new controls.Toggle({ title: 'Selfie Mode', field: 'selfieMode' }),
    new controls.SourcePicker({
      onSourceChanged: () => {
        // Resets because this model gives better results when reset between
        // source changes.
        pose.reset();
      },
      onFrame: async (input, size) => {
        const aspect = size.height / size.width;
        let width, height;
        if (window.innerWidth > window.innerHeight) {
          height = window.innerHeight;
          width = height / aspect;
        }
        else {
          width = window.innerWidth;
          height = width * aspect;
        }
        canvasElement.width = width;
        canvasElement.height = height;
        await pose.send({ image: input });
      },
    }),
    /* new controls.Slider({
      title: 'Model Complexity',
      field: 'modelComplexity',
      discrete: ['Lite', 'Full', 'Heavy'],
    }),
    new controls.Toggle({ title: 'Smooth Landmarks', field: 'smoothLandmarks' }),
    new controls.Toggle({ title: 'Enable Segmentation', field: 'enableSegmentation' }),
    new controls.Toggle({ title: 'Smooth Segmentation', field: 'smoothSegmentation' }),
    new controls.Slider({
      title: 'Min Detection Confidence',
      field: 'minDetectionConfidence',
      range: [0, 1],
      step: 0.01
    }),
    new controls.Slider({
      title: 'Min Tracking Confidence',
      field: 'minTrackingConfidence',
      range: [0, 1],
      step: 0.01
    }),
    new controls.Slider({
      title: 'Effect',
      field: 'effect',
      discrete: { 'background': 'Background', 'mask': 'Foreground' },
    }), */
  ])
  .on(x => {
    const options = x;
    videoElement.classList.toggle('selfie', options.selfieMode);
    activeEffect = x['effect'];
    pose.setOptions(options);
  });
