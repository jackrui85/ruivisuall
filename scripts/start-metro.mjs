import { spawn } from "node:child_process";

const port = process.env.EXPO_PORT || "8081";
let child;
let stopping = false;

function startMetro() {
  child = spawn(
    "pnpm",
    ["exec", "expo", "start", "--web", "--port", port],
    {
      stdio: "inherit",
      env: {
        ...process.env,
        EXPO_NO_METRO_WORKSPACE_ROOT: "1",
      },
    },
  );

  child.once("error", (error) => {
    if (!stopping) console.error(`[metro-wrapper] unable to start Expo: ${error.message}`);
  });

  child.once("exit", (code, signal) => {
    child = undefined;
    if (stopping) {
      process.exit(code ?? (signal ? 1 : 0));
      return;
    }
    console.warn(`[metro-wrapper] Expo exited (code=${code ?? "null"}, signal=${signal ?? "none"}); restarting.`);
    setTimeout(startMetro, 750);
  });
}

function stopMetro(signal) {
  stopping = true;
  if (child && !child.killed) child.kill(signal);
}

process.once("SIGINT", () => stopMetro("SIGINT"));
process.once("SIGTERM", () => stopMetro("SIGTERM"));

startMetro();
