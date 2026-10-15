import { randomUUID } from "node:crypto";
import type {
  CreateScenarioInput,
  Scenario,
} from "./scenario.js";
import type {
  ScenarioRepository,
} from "./scenarioRepository.js";

export class ScenarioService {
  constructor(
    private readonly repository: ScenarioRepository,
  ) {}

  async create(input: CreateScenarioInput): Promise<Scenario> {
    const scenario: Scenario = {
      ...input,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
    };

    await this.repository.save(scenario);

    return scenario;
  }

  async list(): Promise<Scenario[]> {
    return this.repository.findAll();
  }

  async getById(id: string): Promise<Scenario | undefined> {
    return this.repository.findById(id);
  }
}