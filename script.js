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

const showPose = document.querySelector('.pose');

function dist(x1, y1, x2, y2) {
  const y = x2 - x1;
  const x = y2 - y1;

  return Math.sqrt(x * x + y * y);
}

function angle(A, B, C, setAngle = 90, tolerance = 25) {
  const AB = Math.sqrt(Math.pow(B.x - A.x, 2) + Math.pow(B.y - A.y, 2));
  const BC = Math.sqrt(Math.pow(B.x - C.x, 2) + Math.pow(B.y - C.y, 2));
  const AC = Math.sqrt(Math.pow(C.x - A.x, 2) + Math.pow(C.y - A.y, 2));
  const calcAngle = Math.acos((BC * BC + AB * AB - AC * AC) / (2 * BC * AB)) * 180 / Math.PI;
  return setAngle + tolerance > calcAngle && setAngle - tolerance < calcAngle;
}

function IDPoses(poseLandmarks) {
  const joints = { ...mpPose.POSE_LANDMARKS_RIGHT, ...mpPose.POSE_LANDMARKS_LEFT };
  for (const idx in joints) {
    joints[idx] = poseLandmarks[joints[idx]];
  }

  const ARMS = [
    joints.RIGHT_WRIST,
    joints.RIGHT_ELBOW,
    joints.LEFT_SHOULDER,
    joints.LEFT_ELBOW,
    joints.LEFT_WRIST,
  ];

  // Check if all arm joints are visible
  if (ARMS.find(joint => joint.visibility < 0.65)) {
    showPose.textContent = '';
    return;
  }

  const ALIGN_THRESHOLD = 0.07;

  const Ealigned = angle(joints.RIGHT_WRIST, joints.RIGHT_ELBOW, joints.RIGHT_SHOULDER, 180, 35)
    && angle(joints.RIGHT_ELBOW, joints.RIGHT_SHOULDER, joints.LEFT_SHOULDER, 90, 35)
    && joints.RIGHT_WRIST.y < joints.RIGHT_SHOULDER.y
    && angle(joints.LEFT_WRIST, joints.LEFT_ELBOW, joints.LEFT_SHOULDER, 180)
    && joints.LEFT_WRIST.y > joints.LEFT_SHOULDER.y;

  const Waligned = angle(joints.RIGHT_WRIST, joints.RIGHT_ELBOW, joints.RIGHT_SHOULDER, 90, 35)
    && angle(joints.LEFT_WRIST, joints.LEFT_ELBOW, joints.LEFT_SHOULDER, 90, 35)
    && joints.LEFT_WRIST.y < joints.LEFT_ELBOW.y
    && joints.RIGHT_WRIST.y < joints.RIGHT_ELBOW.y
    && angle(joints.LEFT_SHOULDER, joints.RIGHT_SHOULDER, joints.RIGHT_ELBOW, 100, 35)
    && angle(joints.RIGHT_SHOULDER, joints.LEFT_SHOULDER, joints.LEFT_ELBOW, 100, 35)
    && joints.RIGHT_ELBOW.y > joints.RIGHT_SHOULDER.y
    && joints.LEFT_ELBOW.y > joints.LEFT_SHOULDER.y;

  const Aaligned = dist(joints.LEFT_WRIST.x, joints.LEFT_WRIST.y, joints.RIGHT_WRIST.x, joints.RIGHT_WRIST.y) < ALIGN_THRESHOLD
    && joints.RIGHT_ELBOW.y <= joints.RIGHT_SHOULDER.y
    && joints.RIGHT_ELBOW.x <= joints.RIGHT_SHOULDER.x
    && joints.RIGHT_WRIST.y <= joints.RIGHT_ELBOW.y;

  const Saligned = angle(joints.LEFT_SHOULDER, joints.RIGHT_SHOULDER, joints.RIGHT_ELBOW, 130)
    && angle(joints.RIGHT_SHOULDER, joints.RIGHT_ELBOW, joints.RIGHT_WRIST)
    && angle(joints.RIGHT_SHOULDER, joints.LEFT_SHOULDER, joints.LEFT_ELBOW, 130)
    && angle(joints.LEFT_SHOULDER, joints.LEFT_ELBOW, joints.LEFT_WRIST)
    && joints.RIGHT_WRIST.y < joints.RIGHT_SHOULDER.y
    && joints.LEFT_WRIST.y > joints.LEFT_SHOULDER.y
    && joints.RIGHT_WRIST.x > joints.RIGHT_SHOULDER.x
    && joints.LEFT_WRIST.x < joints.LEFT_SHOULDER.x;

  const Daligned = joints.LEFT_WRIST.y < joints.LEFT_ELBOW.y
    && joints.LEFT_ELBOW.y < joints.LEFT_SHOULDER.y
    && Math.abs(joints.LEFT_WRIST.x - joints.LEFT_SHOULDER.x) < ALIGN_THRESHOLD
    && Math.abs(joints.LEFT_ELBOW.x - joints.LEFT_SHOULDER.x) < ALIGN_THRESHOLD
    && angle(joints.LEFT_SHOULDER, joints.RIGHT_SHOULDER, joints.RIGHT_ELBOW, 135)
    && angle(joints.RIGHT_SHOULDER, joints.RIGHT_ELBOW, joints.RIGHT_WRIST, 90, 40)
    && joints.RIGHT_ELBOW.y > joints.RIGHT_SHOULDER.y
    && angle(joints.LEFT_SHOULDER, joints.LEFT_ELBOW, joints.LEFT_WRIST, 180);

  const crouchAligned = Math.abs(joints.RIGHT_HIP.y - joints.RIGHT_HEEL.y) < 0.15 && joints.RIGHT_HEEL.visibility > 0.65;

  const jumpAligned = angle(joints.RIGHT_SHOULDER, joints.LEFT_SHOULDER, joints.LEFT_ELBOW)
    && angle(joints.LEFT_SHOULDER, joints.LEFT_ELBOW, joints.LEFT_WRIST, 180)
    && angle(joints.LEFT_SHOULDER, joints.RIGHT_SHOULDER, joints.RIGHT_ELBOW)
    && angle(joints.RIGHT_SHOULDER, joints.RIGHT_ELBOW, joints.RIGHT_WRIST, 180)
    && joints.RIGHT_WRIST.y < joints.RIGHT_SHOULDER.y
    && joints.LEFT_WRIST.y < joints.LEFT_SHOULDER.y
    && dist(joints.LEFT_WRIST.x, joints.LEFT_WRIST.y, joints.RIGHT_WRIST.x, joints.RIGHT_WRIST.y) > ALIGN_THRESHOLD;

  const escAligned = angle(joints.RIGHT_SHOULDER, joints.LEFT_SHOULDER, joints.LEFT_ELBOW)
    && angle(joints.LEFT_SHOULDER, joints.LEFT_ELBOW, joints.LEFT_WRIST, 45)
    && joints.LEFT_ELBOW.y > joints.LEFT_SHOULDER.y
    && joints.LEFT_WRIST.x < joints.LEFT_SHOULDER.x;

  const rightAligned = Math.abs(joints.LEFT_WRIST.x - joints.LEFT_SHOULDER.x) <= ALIGN_THRESHOLD
    && Math.abs(joints.LEFT_ELBOW.x - joints.LEFT_SHOULDER.x) <= ALIGN_THRESHOLD
    && Math.abs(joints.LEFT_WRIST.y - joints.LEFT_SHOULDER.y) <= ALIGN_THRESHOLD
    && Math.abs(joints.LEFT_ELBOW.y - joints.LEFT_SHOULDER.y) <= ALIGN_THRESHOLD
    && Math.abs(joints.RIGHT_ELBOW.y - joints.RIGHT_SHOULDER.y) > ALIGN_THRESHOLD;

  const leftAligned = Math.abs(joints.RIGHT_WRIST.x - joints.RIGHT_SHOULDER.x) <= ALIGN_THRESHOLD
    && Math.abs(joints.RIGHT_ELBOW.x - joints.RIGHT_SHOULDER.x) <= ALIGN_THRESHOLD
    && Math.abs(joints.RIGHT_WRIST.y - joints.RIGHT_SHOULDER.y) <= ALIGN_THRESHOLD
    && Math.abs(joints.RIGHT_ELBOW.y - joints.RIGHT_SHOULDER.y) <= ALIGN_THRESHOLD
    && Math.abs(joints.LEFT_ELBOW.y - joints.LEFT_SHOULDER.y) > ALIGN_THRESHOLD;

  // use right shoulder as a baseline
  const arms_horizontal = ARMS.every(joint => Math.abs(joint.y - joints.RIGHT_SHOULDER.y) < ALIGN_THRESHOLD);

  const rightMouseMove = arms_horizontal && joints.LEFT_WRIST.x < joints.LEFT_SHOULDER.x
    && joints.RIGHT_WRIST.x < joints.RIGHT_SHOULDER.x;

  const leftMouseMove = arms_horizontal && joints.RIGHT_WRIST.x > joints.RIGHT_SHOULDER.x
    && joints.LEFT_WRIST.x > joints.LEFT_SHOULDER.x;

  const elbows_out = angle(joints.RIGHT_WRIST, joints.RIGHT_ELBOW, joints.RIGHT_SHOULDER)
    && angle(joints.LEFT_WRIST, joints.LEFT_ELBOW, joints.LEFT_SHOULDER)
    && angle(joints.LEFT_ELBOW, joints.LEFT_SHOULDER, joints.RIGHT_SHOULDER, 180)
    && angle(joints.LEFT_ELBOW, joints.LEFT_SHOULDER, joints.RIGHT_SHOULDER, 180);

  const upMouseMove = elbows_out && joints.LEFT_WRIST.y < joints.LEFT_SHOULDER.y
    && joints.RIGHT_WRIST.y < joints.RIGHT_SHOULDER.y;

  const downMouseMove = elbows_out && joints.LEFT_WRIST.y > joints.LEFT_SHOULDER.y
    && joints.RIGHT_WRIST.y > joints.RIGHT_SHOULDER.y;

  const currentKey = Waligned ? 'W' : Aaligned ? 'A' : Saligned ? 'S' : Daligned ? 'D' : crouchAligned ? 'SHIFT' : jumpAligned ? 'SPACE' : Ealigned ? 'E' : escAligned ? 'ESC' : '';

  window.electronAPI.sendKey(currentKey);

  const currentMouseButton = leftAligned ? '1' : rightAligned ? '3' : '';

  window.electronAPI.sendMouse(currentMouseButton);

  const mouseIncrement = 10;
  const currentMouseMove = {
    x: (rightMouseMove ? 1 : leftMouseMove ? -1 : 0) * mouseIncrement,
    y: (upMouseMove ? -1 : downMouseMove ? 1 : 0) * mouseIncrement,
  }

  window.electronAPI.sendMouseMove(currentMouseMove);

  showPose.textContent = currentKey || currentMouseButton || (rightMouseMove ? '>' : leftMouseMove ? '<' : upMouseMove ? '^' : downMouseMove ? 'v' : '');
  /*LEFT_ANKLE
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
    IDPoses(results.poseLandmarks);

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
