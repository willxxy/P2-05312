import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { applyAction, joinPlan, newPlan, publicPlan } from './plans.js';
import { createStore } from './store.js';
import { seedPlans } from './seed.js';
import { shareAmount } from '../src/utils.ts';

const host = { id: 'host', name: 'Alex Morgan', initials: 'AM', color: 'sage' };
const guest = {
  id: 'guest',
  name: 'Test Guest',
  initials: 'TG',
  color: 'blue',
};
const fixture = () => seedPlans(host)[0];

test('private plan membership is required for every action', () => {
  const plan = fixture();
  assert.throws(
    () =>
      applyAction(plan, 'stranger', {
        type: 'message',
        payload: { text: 'Hello' },
      }),
    /private/,
  );
  assert.throws(() => publicPlan(plan, 'stranger'), /private/);
});

test('joining is idempotent and grants guest permissions only', () => {
  const plan = fixture();
  const count = plan.members.length;
  joinPlan(plan, guest, 'Guest Person');
  joinPlan(plan, guest, 'Guest Person');
  assert.equal(plan.members.length, count + 1);
  assert.equal(plan.members.at(-1).role, 'guest');
  assert.equal(publicPlan(plan, guest.id).inviteToken, null);
  assert.equal(publicPlan(plan, host.id).inviteToken, plan.inviteToken);
});

test('guests cannot lock dates, edit locations, assign others, or nudge', () => {
  const plan = joinPlan(fixture(), guest, guest.name);
  for (const action of [
    { type: 'lockDate', payload: { id: 'date-2' } },
    { type: 'location', payload: { location: 'Elsewhere' } },
    { type: 'task', payload: { title: 'Book it', ownerId: 'maya' } },
    { type: 'nudge' },
  ])
    assert.throws(() => applyAction(plan, guest.id, action), /Only the host/);
});

test('RSVP updates do not discard constraints', () => {
  const plan = fixture();
  applyAction(plan, host.id, {
    type: 'rsvp',
    payload: { rsvp: 'maybe', constraint: 'Need a ride' },
  });
  assert.equal(plan.members[0].rsvp, 'maybe');
  assert.equal(plan.members[0].constraint, 'Need a ride');
});

test('availability toggles without duplicating votes', () => {
  const plan = fixture();
  const action = { type: 'availability', payload: { id: 'date-1' } };
  applyAction(plan, host.id, action);
  assert.ok(!plan.dates[0].voters.includes(host.id));
  applyAction(plan, host.id, action);
  assert.equal(plan.dates[0].voters.filter((id) => id === host.id).length, 1);
});

test('impossible dates and reverse ranges are rejected', () => {
  for (const [start, end] of [
    ['2026-02-31', '2026-03-04'],
    ['2026-12-10', '2026-12-09'],
  ]) {
    assert.throws(() =>
      applyAction(fixture(), host.id, {
        type: 'addDate',
        payload: { start, end },
      }),
    );
  }
});

test('locking a date creates an actionable notification', () => {
  const plan = fixture();
  applyAction(plan, host.id, { type: 'lockDate', payload: { id: 'date-2' } });
  assert.equal(plan.lockedDateId, 'date-2');
  assert.equal(plan.notifications.length, plan.members.length - 1);
  assert.equal(publicPlan(plan, 'maya').notifications.length, 1);
  assert.equal(publicPlan(plan, host.id).notifications.length, 0);
});

test('quorum turns a proposal into a durable decision', () => {
  const plan = fixture();
  applyAction(plan, host.id, { type: 'vote', payload: { id: 'dinner' } });
  assert.equal(
    plan.proposals.find((proposal) => proposal.id === 'dinner').status,
    'confirmed',
  );
  assert.throws(
    () =>
      applyAction(plan, host.id, { type: 'vote', payload: { id: 'dinner' } }),
    /already confirmed/,
  );
  assert.ok(plan.messages.at(-1).text.includes('Tacos'));
});

test('a one-person proposal reaches its stated threshold immediately', () => {
  const plan = newPlan(host, { name: 'A new plan' });
  applyAction(plan, host.id, {
    type: 'proposal',
    payload: { title: 'Coffee', detail: 'At the usual place' },
  });
  assert.equal(plan.proposals[0].status, 'confirmed');
});

test('guests can claim an open task but cannot take another person’s task', () => {
  const plan = joinPlan(fixture(), guest, guest.name);
  applyAction(plan, guest.id, { type: 'claimTask', payload: { id: 'task-3' } });
  applyAction(plan, guest.id, {
    type: 'toggleTask',
    payload: { id: 'task-3' },
  });
  assert.equal(plan.tasks.find((task) => task.id === 'task-3').done, true);
  assert.throws(
    () =>
      applyAction(plan, guest.id, {
        type: 'claimTask',
        payload: { id: 'task-1' },
      }),
    /Only the host/,
  );
});

test('nudges are limited to unanswered RSVPs and one per day', () => {
  const plan = fixture();
  applyAction(plan, host.id, { type: 'nudge' });
  assert.deepEqual(
    plan.notifications.map((notice) => notice.recipientId),
    ['nina'],
  );
  assert.throws(() => applyAction(plan, host.id, { type: 'nudge' }), /per day/);
});

test('settling expenses changes only your own share', () => {
  const plan = fixture();
  applyAction(plan, host.id, {
    type: 'settle',
    payload: { id: 'expense-1', userId: 'jordan' },
  });
  assert.ok(plan.expenses[0].settledIds.includes(host.id));
  assert.ok(!plan.expenses[0].settledIds.includes('jordan'));
  assert.throws(
    () =>
      applyAction(plan, 'leo', {
        type: 'settle',
        payload: { id: 'expense-1' },
      }),
    /not part/,
  );
});

test('expense shares preserve every cent and exclude nonparticipants', () => {
  const expense = { amount: 10000, participants: ['a', 'b', 'c'] };
  assert.deepEqual(
    expense.participants.map((id) => shareAmount(expense, id)),
    [3334, 3333, 3333],
  );
  assert.equal(shareAmount(expense, 'stranger'), 0);
});

test('normal chat stays quiet; arrival updates require Going', () => {
  const plan = fixture();
  applyAction(plan, host.id, {
    type: 'message',
    payload: { text: 'Hello, friends' },
  });
  assert.equal(plan.notifications.length, 0);
  assert.equal(plan.messages.at(-1).text, 'Hello, friends');
  assert.throws(
    () => applyAction(plan, 'leo', { type: 'eta', payload: { eta: 'Here' } }),
    /RSVP Going/,
  );
});

test('sessions and plans survive reopening the database', () => {
  const dir = mkdtempSync(join(tmpdir(), 'gather-test-'));
  const path = join(dir, 'test.sqlite');
  let store = createStore(path);
  try {
    const session = store.createSession();
    const plan = newPlan(session.user, { name: 'Saved weekend' });
    store.savePlan(plan);
    store.close();
    store = createStore(path);
    assert.equal(store.getUser(session.token).id, session.user.id);
    assert.equal(store.getPlan(plan.id).name, 'Saved weekend');
  } finally {
    store.close();
    rmSync(dir, { recursive: true });
  }
});

test('saving a plan preserves the sidebar order', () => {
  const store = createStore(':memory:');
  try {
    const plans = seedPlans(host);
    plans.forEach((plan) => store.savePlan(plan));
    const before = store.getPlans().map((plan) => plan.id);
    store.savePlan(plans[0]);
    assert.deepEqual(
      store.getPlans().map((plan) => plan.id),
      before,
    );
  } finally {
    store.close();
  }
});
