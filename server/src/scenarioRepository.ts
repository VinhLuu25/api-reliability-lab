import type { Scenario } from "./scenario.js";

export interface ScenarioRepository {
  save(scenario: Scenario): Promise<void>;
  findAll(): Promise<Scenario[]>;
  findById(id: string): Promise<Scenario | undefined>;
}

export class InMemoryScenarioRepository
  implements ScenarioRepository
{
  private readonly scenarios = new Map<string, Scenario>();

  async save(scenario: Scenario): Promise<void> {
    this.scenarios.set(scenario.id, { ...scenario });
  }

  async findAll(): Promise<Scenario[]> {
    return [...this.scenarios.values()].map(
      (scenario) => ({ ...scenario }),
    );
  }

  async findById(id: string): Promise<Scenario | undefined> {
    const scenario = this.scenarios.get(id);

    return scenario ? { ...scenario } : undefined;
  }
}