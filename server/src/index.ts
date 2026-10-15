import { createApp } from "./app.js";
import {
  InMemoryScenarioRepository,
} from "./scenarioRepository.js";
import { ScenarioService } from "./scenarioService.js";

const port = Number(process.env.PORT ?? 3001);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be an integer from 1 to 65535.");
}

const repository = new InMemoryScenarioRepository();
const service = new ScenarioService(repository);
const app = createApp(service);

app.listen(port, "127.0.0.1", () => {
  console.log(`API listening at http://127.0.0.1:${port}`);
});