import * as readline from "readline";
import { execFile, spawn } from "child_process";

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

async function main() {
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
    } else {
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
          if (parts[1]) {
            state.name = parts[1];
            rl.prompt();
          } else {
            rl.write("name >>> ");
          }
          state.numscans = "0";
          break;
        case "course":
          if (parts[1]) {
            state.course = parts[1];
            rl.prompt();
          } else {
            rl.write("course >>> ");
          }
          break;
        case "scan":
          await run("mkdir", ["-p", `out/${state.course}/${state.name}`]);
          await run("scanimage", [
            "--device",
            "epkowa:interpreter:001:002",
            "--format=png",
            "--output-file",
            `out/${state.course}/${state.name}/${state.numscans}.png`,
            "--x-resolution",
            "200",
            "--y-resolution",
            "200",
            "--progress",
            "--scan-area",
            "Letter",
          ]);
          state.numscans = `${Number(state.numscans) + 1}`;
          rl.prompt();
          break;

        case "save":
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
        default:
          rl.prompt();
      }
    }
  });
}

main();