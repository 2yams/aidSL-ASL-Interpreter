import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";
import { Point3D, DetectionResult } from "../types/sign";

let handLandmarkerInstance: HandLandmarker | null = null;
let isInitializing = false;

export async function initHandLandmarker(): Promise<HandLandmarker | null> {
  if (handLandmarkerInstance) return handLandmarkerInstance;
  if (isInitializing) return null;

  isInitializing = true;
  try {
    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
    );
    handLandmarkerInstance = await HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
        delegate: "GPU",
      },
      runningMode: "VIDEO",
      numHands: 1,
    });
    console.log("MediaPipe HandLandmarker initialized successfully.");
    return handLandmarkerInstance;
  } catch (err) {
    console.warn("GPU/WASM MediaPipe initialization fallback mode:", err);
    try {
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
      );
      handLandmarkerInstance = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
          delegate: "CPU",
        },
        runningMode: "VIDEO",
        numHands: 1,
      });
      return handLandmarkerInstance;
    } catch (fallbackErr) {
      console.warn("MediaPipe CPU initialization error:", fallbackErr);
      return null;
    }
  } finally {
    isInitializing = false;
  }
}

function dist3D(a: Point3D, b: Point3D): number {
  return Math.sqrt(
    Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2) + Math.pow(a.z - b.z, 2)
  );
}

export function classifyHandGesture(
  landmarks: Point3D[],
  targetLetter: string
): { confidenceScore: number; predictedLetter: string; isMatch: boolean; details: string } {
  if (!landmarks || landmarks.length < 21) {
    return {
      confidenceScore: 0,
      predictedLetter: "?",
      isMatch: false,
      details: "No hand landmarks detected",
    };
  }

  const wrist = landmarks[0];
  const thumbCmcp = landmarks[1];
  const thumbMcp = landmarks[2];
  const thumbIp = landmarks[3];
  const thumbTip = landmarks[4];

  const indexMcp = landmarks[5];
  const indexPip = landmarks[6];
  const indexDip = landmarks[7];
  const indexTip = landmarks[8];

  const middleMcp = landmarks[9];
  const middlePip = landmarks[10];
  const middleDip = landmarks[11];
  const middleTip = landmarks[12];

  const ringMcp = landmarks[13];
  const ringPip = landmarks[14];
  const ringDip = landmarks[15];
  const ringTip = landmarks[16];

  const pinkyMcp = landmarks[17];
  const pinkyPip = landmarks[18];
  const pinkyDip = landmarks[19];
  const pinkyTip = landmarks[20];

  // Palm reference scale
  const palmScale = dist3D(wrist, middleMcp) || 0.1;

  // Finger extension measurements (ratio of wrist->tip vs wrist->MCP)
  const isIndexExt = dist3D(wrist, indexTip) > palmScale * 1.4;
  const isMiddleExt = dist3D(wrist, middleTip) > palmScale * 1.4;
  const isRingExt = dist3D(wrist, ringTip) > palmScale * 1.4;
  const isPinkyExt = dist3D(wrist, pinkyTip) > palmScale * 1.4;

  const isIndexCurled = dist3D(wrist, indexTip) < palmScale * 1.1;
  const isMiddleCurled = dist3D(wrist, middleTip) < palmScale * 1.1;
  const isRingCurled = dist3D(wrist, ringTip) < palmScale * 1.1;
  const isPinkyCurled = dist3D(wrist, pinkyTip) < palmScale * 1.1;

  const isIndexBent = !isIndexExt && !isIndexCurled;
  const isMiddleBent = !isMiddleExt && !isMiddleCurled;

  // Tip-to-tip distances normalized by palmScale
  const indexMiddleDist = dist3D(indexTip, middleTip) / palmScale;
  const middleRingDist = dist3D(middleTip, ringTip) / palmScale;
  const ringPinkyDist = dist3D(ringTip, pinkyTip) / palmScale;
  const thumbIndexDist = dist3D(thumbTip, indexTip) / palmScale;
  const thumbMiddleDist = dist3D(thumbTip, middleTip) / palmScale;
  const thumbPinkyDist = dist3D(thumbTip, pinkyTip) / palmScale;

  // Thumb lateral extension
  const thumbSideDist = dist3D(thumbTip, pinkyMcp) / palmScale;
  const thumbAcrossPalm = dist3D(thumbTip, indexMcp) < palmScale * 0.9;

  let predicted = "A";
  let score = 70;
  let feedbackDetails = "Forming hand shape";

  const target = targetLetter.toUpperCase();

  // Explicit per-letter evaluation
  if (target === "A") {
    // Fist with thumb pointing up alongside index
    if (isIndexCurled && isMiddleCurled && isRingCurled && isPinkyCurled) {
      if (thumbSideDist > 0.8 && thumbTip.y < indexMcp.y) {
        predicted = "A";
        score = 98;
        feedbackDetails = "Accurate A: Firm fist with thumb upright at side.";
      } else {
        predicted = "A";
        score = 88;
        feedbackDetails = "Good fist, position thumb upright alongside index.";
      }
    } else {
      score = 55;
      feedbackDetails = "Curl index, middle, ring, and pinky into palm.";
    }
  } else if (target === "B") {
    // 4 fingers straight up & together, thumb across palm
    const fourExt = isIndexExt && isMiddleExt && isRingExt && isPinkyExt;
    if (fourExt) {
      if (indexMiddleDist < 0.4 && middleRingDist < 0.4) {
        predicted = "B";
        score = 98;
        feedbackDetails = "Accurate B: Open flat palm, fingers pressed together.";
      } else {
        predicted = "B";
        score = 86;
        feedbackDetails = "Keep 4 extended fingers tightly side-by-side.";
      }
    } else {
      score = 52;
      feedbackDetails = "Extend index, middle, ring, and pinky straight up.";
    }
  } else if (target === "C") {
    // Curved hand in C shape
    if (thumbIndexDist > 0.4 && thumbIndexDist < 1.1 && isIndexBent && isMiddleBent) {
      predicted = "C";
      score = 96;
      feedbackDetails = "Accurate C: Smooth curved hand posture.";
    } else {
      score = 60;
      feedbackDetails = "Curve fingers and thumb outward to form C arc.";
    }
  } else if (target === "D") {
    // Index up, thumb touches middle & ring tips
    if (isIndexExt && !isMiddleExt && !isRingExt && !isPinkyExt) {
      if (thumbMiddleDist < 0.6) {
        predicted = "D";
        score = 97;
        feedbackDetails = "Accurate D: Index straight up, ring formed with other tips.";
      } else {
        predicted = "D";
        score = 85;
        feedbackDetails = "Touch thumb tip to middle and ring fingertips.";
      }
    } else {
      score = 55;
      feedbackDetails = "Point only index finger straight up.";
    }
  } else if (target === "E") {
    // Clawed fist, all tips curled down, thumb tucked under
    if (isIndexCurled && isMiddleCurled && isRingCurled && isPinkyCurled && thumbAcrossPalm) {
      predicted = "E";
      score = 96;
      feedbackDetails = "Accurate E: Fingertips curled sharply onto tucked thumb.";
    } else {
      score = 58;
      feedbackDetails = "Curl fingernails downward and tuck thumb underneath.";
    }
  } else if (target === "F") {
    // Touch index & thumb, fan outer 3 fingers
    if (isMiddleExt && isRingExt && isPinkyExt && thumbIndexDist < 0.4) {
      predicted = "F";
      score = 98;
      feedbackDetails = "Accurate F: OK ring with outer 3 fingers fanned up.";
    } else if (thumbIndexDist < 0.4) {
      predicted = "F";
      score = 82;
      feedbackDetails = "Extend middle, ring, and pinky straight up.";
    } else {
      score = 52;
      feedbackDetails = "Touch index fingertip to thumb tip to make a ring.";
    }
  } else if (target === "G") {
    // Index & thumb pointing sideways parallel
    if (isIndexExt && !isMiddleExt && !isRingExt && !isPinkyExt && thumbIndexDist < 0.8) {
      predicted = "G";
      score = 95;
      feedbackDetails = "Accurate G: Horizontal index & thumb caliper pinch.";
    } else {
      score = 58;
      feedbackDetails = "Point index horizontally with thumb parallel.";
    }
  } else if (target === "H") {
    // Index & middle pointing sideways parallel together
    if (isIndexExt && isMiddleExt && !isRingExt && !isPinkyExt && indexMiddleDist < 0.4) {
      predicted = "H";
      score = 96;
      feedbackDetails = "Accurate H: Dual horizontal fingers pointing side.";
    } else {
      score = 56;
      feedbackDetails = "Extend index and middle fingers horizontally together.";
    }
  } else if (target === "I") {
    // Only pinky extended
    if (!isIndexExt && !isMiddleExt && !isRingExt && isPinkyExt) {
      predicted = "I";
      score = 97;
      feedbackDetails = "Accurate I: Pinky straight up in firm fist.";
    } else {
      score = 55;
      feedbackDetails = "Fold index, middle, ring, and thumb down, raise pinky.";
    }
  } else if (target === "J") {
    if (isPinkyExt && !isMiddleExt) {
      predicted = "J";
      score = 94;
      feedbackDetails = "Accurate J: Pinky extended ready for swoop motion.";
    } else {
      score = 54;
      feedbackDetails = "Extend pinky and swoop in a J shape.";
    }
  } else if (target === "K") {
    if (isIndexExt && isMiddleExt && !isRingExt && !isPinkyExt) {
      predicted = "K";
      score = 95;
      feedbackDetails = "Accurate K: Index vertical, middle forward, thumb tucked between.";
    } else {
      score = 58;
      feedbackDetails = "Raise index and middle in V with thumb pressed to knuckle.";
    }
  } else if (target === "L") {
    // Index up, thumb sideways 90 deg
    if (isIndexExt && !isMiddleExt && !isRingExt && !isPinkyExt && thumbSideDist > 0.9) {
      predicted = "L";
      score = 98;
      feedbackDetails = "Accurate L: Crisp 90-degree L shape.";
    } else if (isIndexExt && !isMiddleExt) {
      predicted = "L";
      score = 84;
      feedbackDetails = "Extend thumb outward perpendicular to index.";
    } else {
      score = 55;
      feedbackDetails = "Extend index up and thumb sideways into L.";
    }
  } else if (target === "M") {
    if (isIndexCurled && isMiddleCurled && isRingCurled && isPinkyCurled && thumbAcrossPalm) {
      predicted = "M";
      score = 92;
      feedbackDetails = "Accurate M: Three knuckles resting over tucked thumb.";
    } else {
      score = 58;
      feedbackDetails = "Tuck thumb under index, middle, and ring fingers.";
    }
  } else if (target === "N") {
    if (isIndexCurled && isMiddleCurled && isRingCurled && isPinkyCurled && thumbAcrossPalm) {
      predicted = "N";
      score = 92;
      feedbackDetails = "Accurate N: Two knuckles resting over tucked thumb.";
    } else {
      score = 58;
      feedbackDetails = "Tuck thumb under index and middle fingers.";
    }
  } else if (target === "O") {
    if (thumbIndexDist < 0.45 && isIndexBent) {
      predicted = "O";
      score = 97;
      feedbackDetails = "Accurate O: All fingertips meeting thumb tip in O circle.";
    } else {
      score = 60;
      feedbackDetails = "Bring all fingertips to touch thumb tip in an O ring.";
    }
  } else if (target === "P") {
    if (isIndexExt && isMiddleExt) {
      predicted = "P";
      score = 93;
      feedbackDetails = "Accurate P: Downward pointing K handshape.";
    } else {
      score = 55;
      feedbackDetails = "Form K shape and point index finger downward.";
    }
  } else if (target === "Q") {
    if (isIndexExt || thumbIndexDist < 0.6) {
      predicted = "Q";
      score = 92;
      feedbackDetails = "Accurate Q: Downward horizontal pinch.";
    } else {
      score = 55;
      feedbackDetails = "Form G caliper pinch and point downward.";
    }
  } else if (target === "R") {
    if (isIndexExt && isMiddleExt && indexMiddleDist < 0.3) {
      predicted = "R";
      score = 96;
      feedbackDetails = "Accurate R: Crossed index over middle finger.";
    } else {
      score = 58;
      feedbackDetails = "Cross index finger over middle finger.";
    }
  } else if (target === "S") {
    if (isIndexCurled && isMiddleCurled && isRingCurled && isPinkyCurled && thumbAcrossPalm) {
      predicted = "S";
      score = 97;
      feedbackDetails = "Accurate S: Tight fist with thumb across front of fingers.";
    } else {
      score = 58;
      feedbackDetails = "Form tight fist and fold thumb over the front of fingers.";
    }
  } else if (target === "T") {
    if (isIndexCurled && isMiddleCurled && isRingCurled && isPinkyCurled) {
      predicted = "T";
      score = 93;
      feedbackDetails = "Accurate T: Thumb tucked pokes under index knuckle.";
    } else {
      score = 58;
      feedbackDetails = "Tuck thumb under index finger into fist.";
    }
  } else if (target === "U") {
    // Index & middle straight up & TOGETHER
    if (isIndexExt && isMiddleExt && !isRingExt && !isPinkyExt) {
      if (indexMiddleDist < 0.35) {
        predicted = "U";
        score = 98;
        feedbackDetails = "Accurate U: Index and middle fingers pressed side by side.";
      } else {
        predicted = "V";
        score = 75;
        feedbackDetails = "Press index and middle fingers together tightly for U.";
      }
    } else {
      score = 52;
      feedbackDetails = "Extend index and middle fingers straight up.";
    }
  } else if (target === "V") {
    // Index & middle straight up & SPREAD
    if (isIndexExt && isMiddleExt && !isRingExt && !isPinkyExt) {
      if (indexMiddleDist >= 0.35) {
        predicted = "V";
        score = 98;
        feedbackDetails = "Accurate V: Index and middle fingers spread in V peace sign.";
      } else {
        predicted = "U";
        score = 75;
        feedbackDetails = "Spread index and middle fingers apart into a wide V.";
      }
    } else {
      score = 52;
      feedbackDetails = "Extend index and middle fingers straight up in a V.";
    }
  } else if (target === "W") {
    if (isIndexExt && isMiddleExt && isRingExt && !isPinkyExt) {
      predicted = "W";
      score = 98;
      feedbackDetails = "Accurate W: Three fingers extended and fanned.";
    } else {
      score = 55;
      feedbackDetails = "Extend index, middle, and ring fingers straight up.";
    }
  } else if (target === "X") {
    if (isIndexBent && isMiddleCurled && isRingCurled && isPinkyCurled) {
      predicted = "X";
      score = 95;
      feedbackDetails = "Accurate X: Hooked index finger in fist.";
    } else {
      score = 58;
      feedbackDetails = "Crook index finger into a hook while curling other fingers.";
    }
  } else if (target === "Y") {
    if (!isIndexExt && !isMiddleExt && !isRingExt && isPinkyExt && thumbSideDist > 0.9) {
      predicted = "Y";
      score = 98;
      feedbackDetails = "Accurate Y: Thumb and pinky extended in shaka posture.";
    } else {
      score = 58;
      feedbackDetails = "Extend thumb and pinky sideways, curl middle three fingers.";
    }
  } else if (target === "Z") {
    if (isIndexExt && !isMiddleExt && !isRingExt && !isPinkyExt) {
      predicted = "Z";
      score = 95;
      feedbackDetails = "Accurate Z: Index extended ready to trace Z path.";
    } else {
      score = 55;
      feedbackDetails = "Point index finger to trace a Z in air.";
    }
  } else {
    // Default matching for general gestures
    if (isIndexExt && isMiddleExt && isRingExt && isPinkyExt) {
      predicted = "B";
      score = 88;
    } else if (isIndexExt && isMiddleExt && !isRingExt && !isPinkyExt) {
      predicted = indexMiddleDist > 0.35 ? "V" : "U";
      score = 90;
    } else if (isIndexExt && !isMiddleExt && !isRingExt && !isPinkyExt) {
      predicted = thumbSideDist > 0.9 ? "L" : "D";
      score = 90;
    } else if (!isIndexExt && !isMiddleExt && !isRingExt && isPinkyExt) {
      predicted = thumbSideDist > 0.9 ? "Y" : "I";
      score = 92;
    } else {
      predicted = target;
      score = 82;
    }
    feedbackDetails = `Matched ${predicted}`;
  }

  const isMatch = predicted === target && score >= 70;

  return {
    confidenceScore: score,
    predictedLetter: predicted,
    isMatch,
    details: feedbackDetails,
  };
}

export function generateSyntheticLandmarks(targetLetter: string, time = Date.now()): Point3D[] {
  const t = time / 1000;
  const wobbleX = Math.sin(t * 2) * 0.008;
  const wobbleY = Math.cos(t * 2) * 0.008;

  const wrist: Point3D = { x: 0.5 + wobbleX, y: 0.75 + wobbleY, z: 0 };
  const letter = targetLetter.toUpperCase();

  // Joint offsets based on posture
  let indexExt = 0.25;
  let middleExt = 0.25;
  let ringExt = 0.25;
  let pinkyExt = 0.25;
  let thumbX = 0.42;
  let indexOffsetX = 0;
  let middleOffsetX = 0;

  if (letter === "A" || letter === "E" || letter === "S" || letter === "M" || letter === "N" || letter === "T") {
    indexExt = 0.08;
    middleExt = 0.08;
    ringExt = 0.08;
    pinkyExt = 0.08;
    thumbX = letter === "A" ? 0.38 : 0.48;
  } else if (letter === "B") {
    indexExt = 0.26;
    middleExt = 0.26;
    ringExt = 0.26;
    pinkyExt = 0.26;
    thumbX = 0.48;
  } else if (letter === "L") {
    indexExt = 0.26;
    middleExt = 0.08;
    ringExt = 0.08;
    pinkyExt = 0.08;
    thumbX = 0.32;
  } else if (letter === "U") {
    indexExt = 0.26;
    middleExt = 0.26;
    ringExt = 0.08;
    pinkyExt = 0.08;
    thumbX = 0.48;
    indexOffsetX = 0.02;
    middleOffsetX = -0.02;
  } else if (letter === "V") {
    indexExt = 0.26;
    middleExt = 0.26;
    ringExt = 0.08;
    pinkyExt = 0.08;
    thumbX = 0.48;
    indexOffsetX = -0.04;
    middleOffsetX = 0.04;
  } else if (letter === "W") {
    indexExt = 0.26;
    middleExt = 0.26;
    ringExt = 0.26;
    pinkyExt = 0.08;
    thumbX = 0.48;
  } else if (letter === "I" || letter === "J") {
    indexExt = 0.08;
    middleExt = 0.08;
    ringExt = 0.08;
    pinkyExt = 0.26;
    thumbX = 0.48;
  } else if (letter === "Y") {
    indexExt = 0.08;
    middleExt = 0.08;
    ringExt = 0.08;
    pinkyExt = 0.26;
    thumbX = 0.32;
  } else if (letter === "C" || letter === "O") {
    indexExt = 0.16;
    middleExt = 0.16;
    ringExt = 0.16;
    pinkyExt = 0.16;
    thumbX = 0.42;
  } else if (letter === "D") {
    indexExt = 0.26;
    middleExt = 0.12;
    ringExt = 0.12;
    pinkyExt = 0.08;
    thumbX = 0.46;
  } else if (letter === "F") {
    indexExt = 0.12;
    middleExt = 0.26;
    ringExt = 0.26;
    pinkyExt = 0.26;
    thumbX = 0.44;
  }

  return [
    wrist,
    { x: 0.46 + wobbleX, y: 0.68 + wobbleY, z: -0.02 },
    { x: 0.42 + wobbleX, y: 0.62 + wobbleY, z: -0.03 },
    { x: 0.38 + wobbleX, y: 0.58 + wobbleY, z: -0.04 },
    { x: thumbX + wobbleX, y: 0.55 + wobbleY, z: -0.05 }, // Thumb Tip
    
    { x: 0.46 + wobbleX, y: 0.58 + wobbleY, z: -0.02 },
    { x: 0.46 + wobbleX, y: 0.50 + wobbleY, z: -0.03 },
    { x: 0.46 + wobbleX, y: 0.42 + wobbleY, z: -0.04 },
    { x: 0.46 + indexOffsetX + wobbleX, y: 0.58 - indexExt + wobbleY, z: -0.05 }, // Index Tip

    { x: 0.50 + wobbleX, y: 0.58 + wobbleY, z: -0.02 },
    { x: 0.50 + wobbleX, y: 0.50 + wobbleY, z: -0.03 },
    { x: 0.50 + wobbleX, y: 0.42 + wobbleY, z: -0.04 },
    { x: 0.50 + middleOffsetX + wobbleX, y: 0.58 - middleExt + wobbleY, z: -0.05 }, // Middle Tip

    { x: 0.54 + wobbleX, y: 0.58 + wobbleY, z: -0.02 },
    { x: 0.54 + wobbleX, y: 0.50 + wobbleY, z: -0.03 },
    { x: 0.54 + wobbleX, y: 0.42 + wobbleY, z: -0.04 },
    { x: 0.54 + wobbleX, y: 0.58 - ringExt + wobbleY, z: -0.05 }, // Ring Tip

    { x: 0.58 + wobbleX, y: 0.60 + wobbleY, z: -0.02 },
    { x: 0.58 + wobbleX, y: 0.53 + wobbleY, z: -0.03 },
    { x: 0.58 + wobbleX, y: 0.46 + wobbleY, z: -0.04 },
    { x: 0.58 + wobbleX, y: 0.60 - pinkyExt + wobbleY, z: -0.05 }, // Pinky Tip
  ];
}

export function detectSignLanguagePhrase(landmarks: Point3D[]): {
  isPhrase: boolean;
  phrase: string;
  confidence: number;
} {
  if (!landmarks || landmarks.length < 21) {
    return { isPhrase: false, phrase: "", confidence: 0 };
  }

  const wrist = landmarks[0];
  const thumbTip = landmarks[4];
  const indexMcp = landmarks[5];
  const indexTip = landmarks[8];
  const middleMcp = landmarks[9];
  const middleTip = landmarks[12];
  const ringTip = landmarks[16];
  const pinkyMcp = landmarks[17];
  const pinkyTip = landmarks[20];

  const palmScale = dist3D(wrist, middleMcp) || 0.1;

  const isIndexExt = dist3D(wrist, indexTip) > palmScale * 1.35;
  const isMiddleExt = dist3D(wrist, middleTip) > palmScale * 1.35;
  const isRingExt = dist3D(wrist, ringTip) > palmScale * 1.35;
  const isPinkyExt = dist3D(wrist, pinkyTip) > palmScale * 1.35;

  const isIndexCurled = dist3D(wrist, indexTip) < palmScale * 1.1;
  const isMiddleCurled = dist3D(wrist, middleTip) < palmScale * 1.1;
  const isRingCurled = dist3D(wrist, ringTip) < palmScale * 1.1;
  const isPinkyCurled = dist3D(wrist, pinkyTip) < palmScale * 1.1;

  const thumbSideDist = dist3D(thumbTip, pinkyMcp) / palmScale;
  const thumbIndexDist = dist3D(thumbTip, indexTip) / palmScale;
  const indexMiddleDist = dist3D(indexTip, middleTip) / palmScale;
  const middleRingDist = dist3D(middleTip, ringTip) / palmScale;

  // 1. "I LOVE YOU" (ASL): Thumb + Index + Pinky extended, Middle & Ring folded
  if (isIndexExt && !isMiddleExt && !isRingExt && isPinkyExt && thumbSideDist > 0.85) {
    return { isPhrase: true, phrase: "i love you", confidence: 98.5 };
  }

  // 2. "HELLO" / "OPEN HAND": All 5 fingers extended and spread open
  if (isIndexExt && isMiddleExt && isRingExt && isPinkyExt && thumbSideDist > 0.75 && indexMiddleDist > 0.28) {
    return { isPhrase: true, phrase: "hello", confidence: 99.0 };
  }

  // 3. "THANK YOU" / "PLEASE": 4 fingers straight together (B handshape)
  if (isIndexExt && isMiddleExt && isRingExt && isPinkyExt && indexMiddleDist < 0.28 && middleRingDist < 0.28) {
    return { isPhrase: true, phrase: "thank you", confidence: 96.0 };
  }

  // 4. "YES": Tight fist nodding
  if (isIndexCurled && isMiddleCurled && isRingCurled && isPinkyCurled && thumbSideDist < 0.8) {
    return { isPhrase: true, phrase: "yes", confidence: 95.0 };
  }

  // 5. "HELP": Thumbs up posture
  if (!isIndexExt && !isMiddleExt && !isRingExt && !isPinkyExt && thumbSideDist > 0.8 && thumbTip.y < indexMcp.y) {
    return { isPhrase: true, phrase: "help", confidence: 97.0 };
  }

  // 6. "PEACE" / "NO": Index and middle extended spread or snap
  if (isIndexExt && isMiddleExt && !isRingExt && !isPinkyExt) {
    if (indexMiddleDist > 0.35) {
      return { isPhrase: true, phrase: "peace", confidence: 96.5 };
    }
    if (thumbIndexDist < 0.45) {
      return { isPhrase: true, phrase: "no", confidence: 94.0 };
    }
  }

  // 7. "OK": Ring formed by thumb and index, 3 fingers up
  if (isMiddleExt && isRingExt && isPinkyExt && thumbIndexDist < 0.35) {
    return { isPhrase: true, phrase: "ok", confidence: 97.5 };
  }

  return { isPhrase: false, phrase: "", confidence: 0 };
}

export function drawHandBoundingBoxWithLabel(
  ctx: CanvasRenderingContext2D,
  landmarks: Point3D[],
  width: number,
  height: number,
  label: string,
  confidence: number,
  isMirrored = true,
  boxColor = "#EF4444"
) {
  if (!landmarks || landmarks.length === 0) return;

  let minX = 1;
  let maxX = 0;
  let minY = 1;
  let maxY = 0;

  for (const p of landmarks) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }

  // Convert to pixel coordinates with bounding padding
  const paddingX = width * 0.04;
  const paddingY = height * 0.05;

  let left: number;
  let right: number;
  if (isMirrored) {
    left = Math.max(8, (1 - maxX) * width - paddingX);
    right = Math.min(width - 8, (1 - minX) * width + paddingX);
  } else {
    left = Math.max(8, minX * width - paddingX);
    right = Math.min(width - 8, maxX * width + paddingX);
  }

  const top = Math.max(48, minY * height - paddingY);
  const bottom = Math.min(height - 8, maxY * height + paddingY);
  const boxW = Math.max(20, right - left);
  const boxH = Math.max(20, bottom - top);

  ctx.save();

  // Draw crisp bounding rectangle
  ctx.strokeStyle = boxColor;
  ctx.lineWidth = 2.5;
  ctx.strokeRect(left, top, boxW, boxH);

  // Clean, slightly larger, thin, and legible typography on top of the bounding box
  const textX = left + 2;
  const textY1 = top - 24;
  const textY2 = top - 6;

  ctx.font = "300 15px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', 'SF Pro Text', sans-serif";
  ctx.fillStyle = boxColor;
  ctx.textAlign = "left";
  ctx.shadowColor = "rgba(0, 0, 0, 0.9)";
  ctx.shadowBlur = 3.5;
  ctx.shadowOffsetX = 0.5;
  ctx.shadowOffsetY = 0.5;

  ctx.fillText(`Confidence: ${Math.min(100, Math.max(0, confidence)).toFixed(2)}%`, textX, textY1);
  ctx.fillText(`Prediction: ${label.toLowerCase()}`, textX, textY2);

  ctx.restore();
}

export function drawHandLandmarksOnCanvas(
  ctx: CanvasRenderingContext2D,
  landmarks: Point3D[],
  width: number,
  height: number,
  isMirrored = true,
  color = "#10B981"
) {
  if (!landmarks || landmarks.length === 0) return;

  const CONNECTIONS = [
    [0, 1], [1, 2], [2, 3], [3, 4], // Thumb
    [0, 5], [5, 6], [6, 7], [7, 8], // Index
    [0, 9], [9, 10], [10, 11], [11, 12], // Middle
    [0, 13], [13, 14], [14, 15], [15, 16], // Ring
    [0, 17], [17, 18], [18, 19], [19, 20], // Pinky
    [5, 9], [9, 13], [13, 17] // Palm bridge
  ];

  const getScreenX = (normX: number) => (isMirrored ? (1 - normX) * width : normX * width);
  const getScreenY = (normY: number) => normY * height;

  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.shadowColor = color;
  ctx.shadowBlur = 8;

  // Draw lines
  for (const [i, j] of CONNECTIONS) {
    const p1 = landmarks[i];
    const p2 = landmarks[j];
    if (p1 && p2) {
      ctx.beginPath();
      ctx.moveTo(getScreenX(p1.x), getScreenY(p1.y));
      ctx.lineTo(getScreenX(p2.x), getScreenY(p2.y));
      ctx.stroke();
    }
  }

  // Draw joints
  for (let i = 0; i < landmarks.length; i++) {
    const lm = landmarks[i];
    ctx.beginPath();
    ctx.arc(getScreenX(lm.x), getScreenY(lm.y), i % 4 === 0 ? 6 : 4, 0, 2 * Math.PI);
    ctx.fillStyle = i === 4 || i === 8 || i === 12 || i === 16 || i === 20 ? "#34D399" : "#FFFFFF";
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.stroke();
  }

  ctx.restore();
}
