import { config } from "dotenv";
import { resolve } from "path";
import "@testing-library/jest-dom/vitest";

config({ path: resolve(process.cwd(), ".env.local") });

process.env.CHAT_BASIC_USER ??= "testuser";
process.env.CHAT_BASIC_PASSWORD ??= "testpass";

if (typeof Element !== "undefined" && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}
