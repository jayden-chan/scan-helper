import { spawn } from "child_process";
import { stat } from "fs/promises";
import * as readline from "readline";

const EXIT_KEYWORDS = [
  "quit",
  "exit",
  ":q",
  ":Q",
  ":wq",
  ":Wq",
  ":WQ",
  ".exit",
];

const state: Record<string, string> = {
  course: "",
  numscans: "0",
};

const DEBUG = process.env.VERBOSE === "1";
const DEVICE = "epkowa:interpreter:001:018";

async function run(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    if (DEBUG) {
      console.log(command, ...args);
    }

    const c = spawn(command, args, {
      stdio: DEBUG ? "inherit" : "ignore",
      shell: true,
    });

    c.on("close", (code) => {
      if (code !== 0) {
        if (command !== "scanimage") {
          reject();
        }
      } else {
        resolve();
      }
    });
  });
}

async function repl() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
    prompt: "> ",
  });

  rl.prompt();

  rl.on("line", async (l) => {
    const line = l.trim();
    if (EXIT_KEYWORDS.includes(line)) {
      process.exit(0);
    }

    if (line.includes(">>>")) {
      const parts = line.split(">>>").map((p) => p.trim());
      state[parts[0]] = parts[1];
      rl.prompt();
      return;
    }

    const parts = line.split(" ").map((p) => p.trim());
    const command = parts[0];

    if (!command) {
      console.log("specify a command");
      rl.prompt();
      return;
    }

    switch (command) {
      case "print":
        console.log(JSON.stringify(state, null, 2));
        rl.prompt();
        break;

      case "new":
        if (state.unsaved === "true") {
          console.log("error: unsaved changes");
          rl.prompt();
        } else {
          if (parts[1]) {
            state.name = parts[1];
            rl.prompt();
          } else {
            rl.write("name >>> ");
          }
          state.numscans = "0";
        }
        break;

      case "course":
        if (state.unsaved === "true") {
          console.log("error: unsaved changes");
          rl.prompt();
        } else {
          if (parts[1]) {
            state.course = parts[1];
            rl.prompt();
          } else {
            rl.write("course >>> ");
          }
        }
        break;

      case "scan":
        if (!state.course) {
          console.log("no course");
          rl.prompt();
          return;
        }

        if (!state.name) {
          console.log("no course");
          rl.prompt();
          return;
        }

        try {
          const stats = await stat(`out/${state.course}/${state.name}.pdf`);
          if (stats.isFile()) {
            console.log(
              `ERROR: File out/${state.course}/${state.name}.pdf exists already`
            );
            rl.prompt();
            return;
          }
        } catch (_e) {}

        await run("mkdir", ["-p", `out/${state.course}/${state.name}`]);
        await run("scanimage", [
          "--device",
          DEVICE,
          "--format=png",
          "--output-file",
          `out/${state.course}/${state.name}/${state.numscans}.png`,
          "--x-resolution",
          "300",
          "--y-resolution",
          "300",
          "--progress",
          "--scan-area",
          "Letter",
        ]);
        state.numscans = `${Number(state.numscans) + 1}`;
        state.unsaved = "true";
        rl.prompt();
        break;

      case "save":
        if (Number(state.numscans) === 0) {
          console.log("error: no scans");
          rl.prompt();
        } else {
          const inputs = [...Array(Number(state.numscans)).keys()].map(
            (i) => `out/${state.course}/${state.name}/${i}.png`
          );
          await run("img2pdf", [
            ...inputs,
            "-S",
            "Letter",
            "-o",
            `out/${state.course}/${state.name}.pdf`,
          ]);
          await run("rm", ["-r", `out/${state.course}/${state.name}`]);
          state.unsaved = "false";
          rl.prompt();
        }
        break;

      default:
        console.log(`Invalid command ${command}`);
        rl.prompt();
    }
  });
}

async function main() {
  const command = process.argv[2];
  if (command === "single") {
    const args = process.argv.slice(3);

    if (args[0] === "--help") {
      console.log(
        `DEVICE=epkowa:interpreter:XXX:XXX nodes dist/index.js single ./output-file.png 200|600`
      );
      return;
    }

    if (!process.env.DEVICE) {
      throw new Error("DEVICE env var isn't set");
    }

    await run("scanimage", [
      "--device",
      process.env.DEVICE,
      "--format=png",
      "--output-file",
      args[0],
      "--x-resolution",
      args[1],
      "--y-resolution",
      args[1],
      "--progress",
      "--scan-area",
      "Letter",
    ]);
  } else {
    await repl();
  }
}

main();
