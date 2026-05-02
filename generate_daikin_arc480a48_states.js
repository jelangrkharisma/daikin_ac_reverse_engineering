const fs = require("fs");
const path = require("path");
const { stateToBroadlinkBase64 } = require("./daikin_arc480a48");

const PROVEN_COMMANDS_PATH = path.join(__dirname, "assert", "9999.json");
const TEMPERATURES = range(16, 32, 0.5);
const FAN_MODES = [
  "auto",
  "night",
  "level1",
  "level2",
  "level3",
  "level4",
  "level5",
];

const MODE_CONFIG = {
  cool: {
    temperatures: TEMPERATURES,
    fanModes: FAN_MODES,
    swingModes: allSwingModes(),
  },
  dry: {
    temperatures: TEMPERATURES,
    fanModes: ["auto"],
    swingModes: [{ name: "on", state: { swing: true } }],
  },
  fan_only: {
    temperatures: TEMPERATURES,
    fanModes: FAN_MODES,
    swingModes: [
      { name: "on", state: { swing: true } },
      { name: "off", state: { swing: false } },
    ],
  },
};

function range(min, max, step) {
  const values = [];
  for (let value = min; value <= max; value += step) {
    values.push(Number(value.toFixed(1)));
  }
  return values;
}

function formatTemperature(value) {
  if (typeof value === "string") return value;
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function allSwingModes() {
  const variants = [];
  for (const [prefix, swing, comfort] of [
    ["on", true, false],
    ["off", false, false],
    ["comfort", false, true],
  ]) {
    variants.push({ name: prefix, state: { swing, comfort } });
    variants.push({
      name: `${prefix}_power_saving`,
      state: { swing, comfort, powerSavingMode: "econo" },
    });
    variants.push({
      name: `${prefix}_power_saving_plus`,
      state: { swing, comfort, powerSavingMode: "econo_plus" },
    });
  }
  return variants;
}

function fanVariants(fanMode) {
  return [
    { name: fanMode, state: { fanMode, quiet: false } },
    { name: `${fanMode}_quiet`, state: { fanMode, quiet: true } },
  ];
}

function commandKey(mode, swingMode, fanMode, temperature) {
  return `${mode}-${swingMode}-${fanMode}-${formatTemperature(temperature)}`;
}

function generateCommands() {
  const commands = {
    off: stateToBroadlinkBase64({ mode: "cool", power: false }),
  };

  for (const [mode, config] of Object.entries(MODE_CONFIG)) {
    for (const swingMode of config.swingModes) {
      for (const fanMode of config.fanModes) {
        for (const fan of fanVariants(fanMode)) {
          for (const temperature of config.temperatures) {
            const key = commandKey(mode, swingMode.name, fan.name, temperature);
            const state = {
              mode,
              power: true,
              temperature,
              ...swingMode.state,
              ...fan.state,
            };
            commands[key] = stateToBroadlinkBase64(state);
          }
        }
      }
    }
  }

  Object.assign(commands, readProvenCommands());

  return commands;
}

function readProvenCommands(filePath = PROVEN_COMMANDS_PATH) {
  if (!fs.existsSync(filePath)) return {};

  const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const sourceCommands = data.commands || data;
  return flattenCommands(sourceCommands);
}

function flattenCommands(commands) {
  const output = {};
  if (commands.off) output.off = commands.off;

  for (const [mode, fanModes] of Object.entries(commands)) {
    if (mode === "off") continue;

    for (const [fanMode, swingModes] of Object.entries(fanModes)) {
      for (const [swingMode, temperatures] of Object.entries(swingModes)) {
        for (const [temperature, command] of Object.entries(temperatures)) {
          output[commandKey(mode, swingMode, fanMode, temperature)] = command;
        }
      }
    }
  }

  return output;
}

function writeCommands(outputPath) {
  const commands = generateCommands();
  const outputDir = path.dirname(outputPath);
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(commands, null, 2)}\n`, "utf8");
  return { outputPath, count: Object.keys(commands).length };
}

function main() {
  const outputPath =
    process.argv[2] || path.join(__dirname, "result", "daikin_arc480a48.all_states.json");
  const result = writeCommands(outputPath);
  console.log(`Generated ${result.count} commands`);
  console.log(`Output: ${result.outputPath}`);
}

if (require.main === module) {
  main();
}

module.exports = {
  FAN_MODES,
  MODE_CONFIG,
  TEMPERATURES,
  flattenCommands,
  generateCommands,
  readProvenCommands,
  writeCommands,
};
