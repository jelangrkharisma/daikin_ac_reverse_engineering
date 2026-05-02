const assert = require("assert");
const fs = require("fs");
const path = require("path");
const {
  broadlinkBase64ToDurations,
  decodeBroadlinkBase64,
  decodeStateFrame,
  encodeStateFrame,
  stateToBroadlinkBase64,
} = require("./daikin_arc480a48");
const { generateCommands, flattenCommands } = require("./generate_daikin_arc480a48_states");

function hex(bytes) {
  return bytes.map((value) => value.toString(16).padStart(2, "0")).join(" ");
}

{
  const frame = encodeStateFrame({
    mode: "cool",
    power: true,
    temperature: 24.5,
    fanMode: "level5",
    swing: true,
    quiet: true,
    powerSavingMode: "econo_plus",
  });

  assert.strictEqual(
    hex(frame),
    "11 da 27 00 00 31 31 00 7f 00 00 00 00 20 00 c5 0c 08 ec",
  );

  assert.deepStrictEqual(decodeStateFrame(frame), {
    protocol: "IRDaikin152",
    bytes: hex(frame),
    checksum: { expected: 0xec, actual: 0xec, valid: true },
    power: true,
    mode: "cool",
    temperature: 24.5,
    fanMode: "level5",
    swing: true,
    powerful: false,
    quiet: true,
    comfort: false,
    econo: true,
    sensor: true,
    powerSavingMode: "econo_plus",
  });
}

{
  const base64 = stateToBroadlinkBase64({
    mode: "cool",
    power: true,
    temperature: 16,
    fanMode: "auto",
    swing: false,
  });
  const frames = decodeBroadlinkBase64(base64);

  assert.strictEqual(frames.length, 1);
  assert.strictEqual(Buffer.from(base64, "base64").length, 328);
  assert.strictEqual(Buffer.from(base64, "base64").readUInt16LE(2), 324);
  assert.strictEqual(broadlinkBase64ToDurations(base64).length, 319);
  assert.strictEqual(
    hex(frames[0]),
    "11 da 27 00 00 31 20 00 a0 00 00 00 00 00 00 c5 08 08 d8",
  );
}

{
  const frame = encodeStateFrame({
    mode: "cool",
    power: true,
    temperature: 24,
    fanMode: "auto",
    swing: true,
    quiet: true,
  });

  assert.strictEqual(hex(frame.slice(8, 18)), "af 00 00 00 00 20 00 c5 08 08");
}

{
  assert.throws(
    () => encodeStateFrame({ mode: "cool", temperature: 24.25 }),
    /0\.5C increments/,
  );

  assert.throws(
    () => encodeStateFrame({ mode: "cool", mold: true }),
    /Mold is not represented/,
  );
}

{
  const provenPath = path.join(__dirname, "assert", "9999.json");
  if (fs.existsSync(provenPath)) {
    const proven = flattenCommands(JSON.parse(fs.readFileSync(provenPath, "utf8")).commands);
    const generated = generateCommands();

    for (const [key, command] of Object.entries(proven)) {
      assert.strictEqual(generated[key], command, key);
    }
  }
}

console.log("daikin_arc480a48 tests passed");
