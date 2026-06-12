import { defineConfig } from "eslint/config";
import next from "eslint-config-next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig([{
    extends: [...next],
    rules: {
        // react-hooks v6 flags any synchronous setState inside an effect.
        // Our flagged cases are deliberate mount-time initialization (read
        // localStorage, trigger auto-calc, fetch-on-mount) where the
        // suggested alternatives (useSyncExternalStore, lazy initializers)
        // would introduce SSR hydration mismatches for no behavioral gain.
        "react-hooks/set-state-in-effect": "off",
    },
}]);
