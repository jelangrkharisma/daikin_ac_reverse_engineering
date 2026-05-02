const fs = require("fs");

const STATE_LENGTH = 19;
const BROADLINK_TICK_US = 269 / 8192 * 1000;

function broadlinkTicks(ticks) {
  return ticks * BROADLINK_TICK_US;
}

const TIMING = {
  leaderBits: 5,
  headerMark: broadlinkTicks(112),
  headerSpace: broadlinkTicks(56),
  bitMark: broadlinkTicks(14),
  oneSpace: broadlinkTicks(42),
  zeroSpace: broadlinkTicks(14),
  gap: broadlinkTicks(813),
  trailerSpace: broadlinkTicks(3333),
};

const MODE = {
  dry: 0b010,
  cool: 0b011,
  fan_only: 0b110,
};

const MODE_NAME = {
  [MODE.dry]: "dry",
  [MODE.cool]: "cool",
  [MODE.fan_only]: "fan_only",
};

const FAN = {
  level1: 0b0011,
  level2: 0b0100,
  level3: 0b0101,
  level4: 0b0110,
  level5: 0b0111,
  auto: 0b1010,
  night: 0b1011,
};

const FAN_NAME = Object.fromEntries(
  Object.entries(FAN).map(([name, value]) => [value, name]),
);

const OFF_FRAMES = [
  [0x11, 0xda, 0x27, 0x00, 0xc5, 0x00, 0x00, 0xd7],
  [0x11, 0xda, 0x27, 0x00, 0x42, 0x52, 0x33, 0xd9],
  [
    0x11, 0xda, 0x27, 0x00, 0x00, 0x68, 0x32, 0x00, 0xa0, 0x00, 0x00, 0x06,
    0x60, 0x00, 0x00, 0xc1, 0x00, 0x00, 0x73,
  ],
];

function sumBytes(bytes, length = bytes.length) {
  return bytes.slice(0, length).reduce((sum, value) => sum + value, 0) & 0xff;
}

function checksum(bytes) {
  return sumBytes(bytes, bytes.length - 1);
}

function broadlinkBase64ToDurations(base64) {
  const packet = Buffer.from(base64, "base64");
  if (packet[0] !== 0x26) {
    throw new Error(`Unsupported Broadlink packet type: 0x${packet[0].toString(16)}`);
  }

  const durations = [];
  const payloadEnd = packet.length - 2;
  for (let i = 4; i < payloadEnd; i += 1) {
    if (packet[i] === 0x00) {
      if (i === payloadEnd - 1) break;
      durations.push(packet.readUInt16BE(i + 1));
      i += 2;
    } else {
      durations.push(packet[i]);
    }
  }

  return durations;
}

function findFrameLeaders(durations) {
  const leaders = [];
  for (let i = 0; i < durations.length - 1; i += 1) {
    if (durations[i] > 80 && durations[i + 1] > 40 && durations[i + 1] < 80) {
      leaders.push(i);
    }
  }
  return leaders;
}

function decodeFrameAt(durations, leaderIndex, nextLeaderIndex) {
  const dataStart = leaderIndex + 2;
  const dataLimit = nextLeaderIndex == null ? durations.length - 1 : nextLeaderIndex - 2;
  const rawBitCount = Math.floor((dataLimit - dataStart) / 2);
  const bitCount = Math.floor(rawBitCount / 8) * 8;
  const bits = [];

  for (let offset = 0; offset < bitCount; offset += 1) {
    const space = durations[dataStart + offset * 2 + 1];
    bits.push(space > 25 ? 1 : 0);
  }

  const bytes = [];
  for (let i = 0; i < bits.length; i += 8) {
    let value = 0;
    for (let bit = 0; bit < 8; bit += 1) {
      value |= bits[i + bit] << bit;
    }
    bytes.push(value);
  }

  return bytes;
}

function decodeBroadlinkBase64(base64) {
  const durations = broadlinkBase64ToDurations(base64);
  const leaders = findFrameLeaders(durations);
  return leaders.map((leader, index) =>
    decodeFrameAt(durations, leader, leaders[index + 1]),
  );
}

function decodeStateFrame(bytes) {
  if (bytes.length !== STATE_LENGTH) {
    throw new Error(`State frame must be 19 bytes, got ${bytes.length}`);
  }

  const mode = (bytes[5] >> 4) & 0x07;
  const fan = (bytes[8] >> 4) & 0x0f;
  const swingCode = bytes[8] & 0x0f;
  const econo = (bytes[16] & 0x04) !== 0;
  const sensor = (bytes[16] & 0x08) !== 0;
  const modeName = MODE_NAME[mode] || `unknown_${mode}`;

  return {
    protocol: "IRDaikin152",
    bytes: bytesToHex(bytes),
    checksum: {
      expected: checksum(bytes),
      actual: bytes[STATE_LENGTH - 1],
      valid: checksum(bytes) === bytes[STATE_LENGTH - 1],
    },
    power: (bytes[5] & 0x01) !== 0,
    mode: modeName,
    temperature: decodeTemperature(bytes, modeName),
    fanMode: FAN_NAME[fan] || `unknown_${fan}`,
    swing: swingCode === 0x0f,
    powerful: (bytes[13] & 0x01) !== 0,
    quiet: (bytes[13] & 0x20) !== 0,
    comfort: (bytes[16] & 0x02) !== 0,
    econo,
    sensor,
    powerSavingMode: econo && sensor ? "econo_plus" : econo ? "econo" : "none",
  };
}

function decodeTemperature(bytes, modeName) {
  if (modeName === "cool") return bytes[6] / 2;
  if (modeName === "dry") return 18;
  return null;
}

function encodeStateFrame(state = {}) {
  const frame = stateReset();
  const modeName = state.mode || "cool";
  const mode = MODE[modeName];
  if (mode == null) {
    throw new Error(`Unsupported mode: ${state.mode}`);
  }

  const fanMode = normalizeFanMode(state.fanMode || "auto", state.quiet);
  const fan = FAN[fanMode];
  if (fan == null) {
    throw new Error(`Unsupported fanMode: ${state.fanMode || fanMode}`);
  }

  frame[5] = (mode << 4) | (state.power === false || state.power === "off" ? 0 : 1);
  frame[8] = (fan << 4) | (state.swing === false ? 0x00 : 0x0f);

  if (modeName === "cool") {
    const temperature = state.temperature ?? 24;
    if (!Number.isFinite(temperature)) {
      throw new Error("Cool mode requires a numeric temperature");
    }
    if (temperature < 16 || temperature > 32 || temperature * 2 % 1 !== 0) {
      throw new Error("Cool temperature must be 16..32C in 0.5C increments");
    }
    frame[6] = Math.round(temperature * 2);
  } else if (modeName === "dry") {
    frame[6] = 0xc0;
  } else if (modeName === "fan_only") {
    frame[6] = 0x32;
  }

  if (modeName !== "dry") frame[16] |= 0x08;

  if (state.powerful) frame[13] |= 0x01;
  if (state.quiet) frame[13] |= 0x20;
  if (state.comfort) {
    frame[16] |= 0x02;
    frame[8] = (FAN.auto << 4) | 0x00;
  }

  const powerSavingMode = state.powerSavingMode || (state.econo ? "econo" : "none");
  if (powerSavingMode === "econo" || powerSavingMode === "econo_plus") {
    frame[16] |= 0x04;
  } else if (powerSavingMode !== "none") {
    throw new Error(`Unsupported powerSavingMode: ${powerSavingMode}`);
  }

  if (powerSavingMode === "econo_plus" || state.sensor) frame[16] |= 0x08;

  if (state.mold) {
    throw new Error("Mold is not represented by IRremoteESP8266 IRDaikin152");
  }

  if (state.powerful) {
    frame[13] &= ~0x20;
    frame[16] &= ~0x06;
  }

  frame[STATE_LENGTH - 1] = checksum(frame);

  return frame;
}

function stateReset() {
  const frame = new Array(STATE_LENGTH).fill(0x00);
  frame[0] = 0x11;
  frame[1] = 0xda;
  frame[2] = 0x27;
  frame[15] = 0xc5;
  frame[17] = 0x08;
  return frame;
}

function normalizeFanMode(fanMode, quiet) {
  return fanMode;
}

function framesForState(state) {
  if (state.power === false || state.power === "off") {
    return OFF_FRAMES.map((frame) => frame.slice());
  }

  return [encodeStateFrame(state)];
}

function stateToBroadlinkBase64(state) {
  return framesToBroadlinkBase64(framesForState(state));
}

function framesToBroadlinkBase64(frames) {
  const durations = [];
  for (const frame of frames) {
    for (let i = 0; i < TIMING.leaderBits; i += 1) {
      durations.push(TIMING.bitMark, TIMING.zeroSpace);
    }
    durations.push(TIMING.bitMark, TIMING.gap, TIMING.headerMark, TIMING.headerSpace);

    for (const byte of frame) {
      for (let bit = 0; bit < 8; bit += 1) {
        durations.push(
          TIMING.bitMark,
          byte & (1 << bit) ? TIMING.oneSpace : TIMING.zeroSpace,
        );
      }
    }

    durations.push(TIMING.bitMark);
  }

  return durationsToBroadlinkBase64(durations);
}

function durationsToBroadlinkBase64(durations) {
  const payload = [];
  for (const micros of durations) {
    const ticks = Math.max(1, Math.round(micros / BROADLINK_TICK_US));
    if (ticks > 0xff) {
      payload.push(0x00, (ticks >> 8) & 0xff, ticks & 0xff);
    } else {
      payload.push(ticks);
    }
  }

  payload.push(0x00);

  const packet = Buffer.alloc(4 + payload.length + 2);
  packet[0] = 0x26;
  packet[1] = 0x00;
  packet.writeUInt16LE(payload.length + 2, 2);
  Buffer.from(payload).copy(packet, 4);
  packet[packet.length - 2] = 0x0d;
  packet[packet.length - 1] = 0x05;

  return packet.toString("base64");
}

function bytesToHex(bytes) {
  return bytes.map((value) => value.toString(16).padStart(2, "0")).join(" ");
}

function main() {
  const command = process.argv[2];

  if (command === "decode") {
    const file = process.argv[3];
    const key = process.argv[4];
    if (!file || !key) {
      console.error("Usage: node daikin_arc480a48.js decode <json-file> <command-key>");
      process.exit(1);
    }

    const value = JSON.parse(fs.readFileSync(file, "utf8"))[key];
    if (!value) throw new Error(`Key not found: ${key}`);
    const frames = decodeBroadlinkBase64(value);
    const decoded = frames.map((bytes) =>
      bytes.length === STATE_LENGTH ? decodeStateFrame(bytes) : { bytes: bytesToHex(bytes) },
    );
    console.log(JSON.stringify(decoded, null, 2));
    return;
  }

  if (command === "encode") {
    const stateJson = process.argv[3];
    if (!stateJson) {
      console.error("Usage: node daikin_arc480a48.js encode '<state-json>'");
      process.exit(1);
    }

    const state = JSON.parse(stateJson);
    console.log(stateToBroadlinkBase64(state));
    return;
  }

  if (!command) {
    console.error("Usage:");
    console.error("  node daikin_arc480a48.js decode src/cool.on.auto.json cool-on-auto-24");
    console.error("  node daikin_arc480a48.js encode '{\"mode\":\"cool\",\"temperature\":24.5}'");
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  broadlinkBase64ToDurations,
  checksum,
  decodeBroadlinkBase64,
  decodeStateFrame,
  durationsToBroadlinkBase64,
  encodeStateFrame,
  framesToBroadlinkBase64,
  findFrameLeaders,
  framesForState,
  stateToBroadlinkBase64,
  OFF_FRAMES,
  TIMING,
};
