import type { Express } from 'express';
import { PERSONALITIES, PersonalityId } from './personalities.js';
import { simulationRunner, SimulationConfig } from './runner.js';

export function registerSimulationApi(app: Express): void {
  app.get('/api/debug/simulation/personalities', (_req, res) => {
    res.json(Object.values(PERSONALITIES).map(p => ({
      id: p.id,
      label: p.label,
      category: p.category,
    })));
  });

  app.get('/api/debug/simulation/status', (_req, res) => {
    res.json(simulationRunner.status());
  });

  app.post('/api/debug/simulation/start', (req, res) => {
    const targetUsers = Number(req.body?.targetUsers ?? 5);
    const troublemakerRatio = Number(req.body?.troublemakerRatio ?? 0.2);
    const rawWeights = req.body?.weights;
    let weights: Partial<Record<PersonalityId, number>> | undefined;
    if (rawWeights && typeof rawWeights === 'object') {
      weights = {};
      for (const [id, w] of Object.entries(rawWeights)) {
        if (id in PERSONALITIES && typeof w === 'number' && w >= 0) {
          weights[id as PersonalityId] = w;
        }
      }
      if (Object.keys(weights).length === 0) weights = undefined;
    }
    if (!Number.isFinite(targetUsers) || targetUsers < 0) {
      return res.status(400).json({ error: 'targetUsers must be a non-negative number' });
    }
    const config: SimulationConfig = { targetUsers, troublemakerRatio, weights };
    simulationRunner.start(config);
    res.json({ ok: true, status: simulationRunner.status() });
  });

  app.post('/api/debug/simulation/stop', (_req, res) => {
    simulationRunner.stop();
    res.json({ ok: true, status: simulationRunner.status() });
  });
}
