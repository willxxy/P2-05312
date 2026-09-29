import express from 'express';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { createStore } from './store.js';
import { seedPlans } from './seed.js';
import {
  applyAction,
  InputError,
  joinPlan,
  newPlan,
  publicPlan,
} from './plans.js';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const store = createStore(
  process.env.GATHER_DB || join(root, 'data/gather.sqlite'),
);
const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '16kb' }));
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  if (req.get('sec-fetch-site') === 'cross-site')
    return res
      .status(403)
      .json({ error: 'Cross-site requests are not allowed.' });
  const token = req.headers.cookie
    ?.split('; ')
    .find((cookie) => cookie.startsWith('gather_session='))
    ?.slice(15);
  req.user = token ? store.getUser(token) : null;
  req.sessionToken = token;
  next();
});

app.get('/api/session', (req, res) => {
  if (!req.user) {
    const guest = req.query.guest === '1';
    const session = store.createSession(
      guest ? { name: 'Guest', initials: 'G' } : undefined,
    );
    req.user = session.user;
    res.cookie('gather_session', session.token, {
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 365 * 24 * 60 * 60 * 1000,
    });
    if (!guest) for (const plan of seedPlans(req.user)) store.savePlan(plan);
  }
  res.json(req.user);
});

app.use('/api', (req, res, next) => {
  if (!req.user)
    return res.status(401).json({ error: 'Refresh to start a session.' });
  next();
});

app.get('/api/plans', (req, res) => {
  res.json(
    store
      .getPlans()
      .filter((plan) =>
        plan.members.some((member) => member.id === req.user.id),
      )
      .map((plan) => publicPlan(plan, req.user.id)),
  );
});

app.post('/api/plans', (req, res) => {
  const plan = newPlan(req.user, req.body);
  store.savePlan(plan);
  res.status(201).json(publicPlan(plan, req.user.id));
});

app.get('/api/invites/:token', (req, res) => {
  const plan = store
    .getPlans()
    .find((item) => item.inviteToken === req.params.token);
  if (!plan) throw new InputError('This invite link was not found.', 404);
  res.json({
    name: plan.name,
    emoji: plan.emoji,
    description: plan.description,
    count: plan.members.length,
  });
});

app.post('/api/join', (req, res) => {
  const plan = store
    .getPlans()
    .find((item) => item.inviteToken === req.body.token);
  if (!plan) throw new InputError('This invite link was not found.', 404);
  store.savePlan(joinPlan(plan, req.user, req.body.name));
  const member = plan.members.find((person) => person.id === req.user.id);
  store.saveUser(req.sessionToken, {
    ...req.user,
    name: member.name,
    initials: member.initials,
  });
  res.json(publicPlan(plan, req.user.id));
});

app.post('/api/plans/:id/actions', (req, res) => {
  const plan = store.getPlan(req.params.id);
  if (!plan) throw new InputError('Plan not found.', 404);
  store.savePlan(applyAction(plan, req.user.id, req.body));
  res.json(publicPlan(plan, req.user.id));
});

if (existsSync(join(root, 'dist'))) {
  app.use(express.static(join(root, 'dist')));
  app.get('/{*path}', (req, res) =>
    res.sendFile(join(root, 'dist/index.html')),
  );
}

app.use((error, req, res, next) => {
  const status =
    error instanceof InputError
      ? error.status
      : error.status === 400
        ? 400
        : 500;
  if (status === 500) console.error(error);
  res.status(status).json({
    error:
      status === 500
        ? 'Something went wrong. Please try again.'
        : error.message,
  });
});

const port = Number(process.env.PORT || 5313);
app.listen(port, '127.0.0.1', () =>
  console.log(`Gather API: http://127.0.0.1:${port}`),
);
