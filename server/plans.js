import { randomUUID } from 'node:crypto';

export class InputError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

export function text(value, label, max = 500) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) {
    throw new InputError(`${label} must be between 1 and ${max} characters.`);
  }
  return value.trim();
}

export function memberOf(plan, userId) {
  const member = plan.members.find((person) => person.id === userId);
  if (!member)
    throw new InputError(
      'This plan is private. Join with an invite link.',
      403,
    );
  return member;
}

function hostOnly(member) {
  if (member.role !== 'host')
    throw new InputError('Only the host can change this detail.', 403);
}

function find(items, id, label) {
  const item = items.find((entry) => entry.id === id);
  if (!item) throw new InputError(`${label} was not found.`, 404);
  return item;
}

function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const timestamp = Date.parse(value);
  return (
    Number.isFinite(timestamp) &&
    new Date(timestamp).toISOString().slice(0, 10) === value
  );
}

function confirmProposal(plan, proposal, userId) {
  const threshold = Math.max(1, Math.ceil(plan.members.length / 2));
  if (proposal.votes.length < threshold) return;
  proposal.status = 'confirmed';
  addMessage(plan, userId, `Decision made · ${proposal.title}`, 'system');
}

export function addMessage(plan, authorId, message, type = 'text') {
  plan.messages.push({
    id: randomUUID(),
    authorId,
    text: message,
    type,
    createdAt: new Date().toISOString(),
  });
}

function notify(plan, title, recipients) {
  for (const recipient of recipients) {
    plan.notifications.push({
      id: randomUUID(),
      recipientId: recipient.id,
      title,
      read: false,
      createdAt: new Date().toISOString(),
    });
  }
}

export function newPlan(user, input) {
  return {
    id: randomUUID(),
    name: text(input.name, 'Plan name', 70),
    description:
      typeof input.description === 'string'
        ? input.description.slice(0, 200)
        : '',
    emoji: ['🏕️', '🍝', '🌊', '🎂', '☕', '✈️'].includes(input.emoji)
      ? input.emoji
      : '🏕️',
    color: 'sage',
    location: '',
    address: '',
    minGoing: 3,
    lockedDateId: null,
    inviteToken: randomUUID(),
    createdAt: new Date().toISOString(),
    members: [
      { ...user, role: 'host', rsvp: 'going', constraint: '', eta: '' },
    ],
    dates: [],
    proposals: [],
    tasks: [],
    expenses: [],
    messages: [],
    notifications: [],
  };
}

export function applyAction(plan, userId, action) {
  const member = memberOf(plan, userId);
  const data = action.payload ?? {};

  switch (action.type) {
    case 'message':
      addMessage(plan, userId, text(data.text, 'Message', 2000));
      break;
    case 'rsvp': {
      if (!['going', 'maybe', 'declined'].includes(data.rsvp))
        throw new InputError('Choose an RSVP.');
      member.rsvp = data.rsvp;
      member.constraint =
        typeof data.constraint === 'string'
          ? data.constraint.slice(0, 200)
          : '';
      break;
    }
    case 'addDate': {
      hostOnly(member);
      if (!validDate(data.start) || !validDate(data.end)) {
        throw new InputError('Choose valid start and end dates.');
      }
      if (data.end < data.start) {
        throw new InputError('The end date must be on or after the start.');
      }
      plan.dates.push({
        id: randomUUID(),
        start: data.start,
        end: data.end,
        voters: [userId],
      });
      break;
    }
    case 'availability': {
      const date = find(plan.dates, data.id, 'Date');
      date.voters = date.voters.includes(userId)
        ? date.voters.filter((id) => id !== userId)
        : [...date.voters, userId];
      break;
    }
    case 'lockDate': {
      hostOnly(member);
      const date = find(plan.dates, data.id, 'Date');
      plan.lockedDateId = date.id;
      addMessage(
        plan,
        userId,
        `${member.name.split(' ')[0]} locked the date · ${date.start} → ${date.end}`,
        'system',
      );
      notify(
        plan,
        'The date is locked. This is happening!',
        plan.members.filter((person) => person.id !== userId),
      );
      break;
    }
    case 'location':
      hostOnly(member);
      plan.location = text(data.location, 'Location', 100);
      plan.address = text(data.address || data.location, 'Address', 200);
      notify(
        plan,
        'The meeting point was updated.',
        plan.members.filter((person) => person.id !== userId),
      );
      break;
    case 'proposal': {
      const proposal = {
        id: randomUUID(),
        title: text(data.title, 'Proposal', 100),
        detail: text(data.detail, 'Details', 500),
        authorId: userId,
        votes: [userId],
        status: 'open',
      };
      plan.proposals.push(proposal);
      confirmProposal(plan, proposal, userId);
      break;
    }
    case 'vote': {
      const proposal = find(plan.proposals, data.id, 'Proposal');
      if (proposal.status !== 'open')
        throw new InputError('This decision is already confirmed.');
      proposal.votes = proposal.votes.includes(userId)
        ? proposal.votes.filter((id) => id !== userId)
        : [...proposal.votes, userId];
      confirmProposal(plan, proposal, userId);
      break;
    }
    case 'task': {
      const ownerId = data.ownerId || null;
      if (ownerId) memberOf(plan, ownerId);
      if (ownerId && ownerId !== userId) hostOnly(member);
      plan.tasks.push({
        id: randomUUID(),
        title: text(data.title, 'Task', 100),
        ownerId,
        done: false,
      });
      if (ownerId && ownerId !== userId)
        notify(plan, `You're on: ${data.title}`, [memberOf(plan, ownerId)]);
      break;
    }
    case 'claimTask': {
      const task = find(plan.tasks, data.id, 'Task');
      if (task.ownerId && task.ownerId !== userId) hostOnly(member);
      task.ownerId = task.ownerId === userId ? null : userId;
      break;
    }
    case 'toggleTask': {
      const task = find(plan.tasks, data.id, 'Task');
      if (task.ownerId !== userId) hostOnly(member);
      task.done = !task.done;
      break;
    }
    case 'expense': {
      if (
        !Number.isSafeInteger(data.amount) ||
        data.amount <= 0 ||
        data.amount > 100000000
      )
        throw new InputError('Enter an amount between $0.01 and $1,000,000.');
      const participants = plan.members
        .filter((person) => person.rsvp === 'going')
        .map((person) => person.id);
      if (!participants.includes(userId)) participants.push(userId);
      plan.expenses.push({
        id: randomUUID(),
        title: text(data.title, 'Expense', 100),
        amount: data.amount,
        paidBy: userId,
        participants,
        settledIds: [userId],
      });
      break;
    }
    case 'settle': {
      const expense = find(plan.expenses, data.id, 'Expense');
      if (!expense.participants.includes(userId))
        throw new InputError('You are not part of this split.');
      if (!expense.settledIds.includes(userId)) expense.settledIds.push(userId);
      break;
    }
    case 'eta':
      if (member.rsvp !== 'going')
        throw new InputError('RSVP Going to share your arrival.');
      member.eta = text(data.eta, 'Arrival status', 80);
      addMessage(plan, userId, member.eta);
      break;
    case 'nudge': {
      hostOnly(member);
      const lastNudge = plan.lastNudge ? new Date(plan.lastNudge).getTime() : 0;
      if (Date.now() - lastNudge < 24 * 60 * 60 * 1000)
        throw new InputError(
          'One gentle nudge per day. Give them a little time.',
        );
      const pending = plan.members.filter(
        (person) => person.rsvp === 'pending',
      );
      if (!pending.length) throw new InputError('Everyone has replied.');
      notify(plan, `${member.name.split(' ')[0]} needs your RSVP.`, pending);
      plan.lastNudge = new Date().toISOString();
      break;
    }
    case 'readNotifications':
      plan.notifications
        .filter((item) => item.recipientId === userId)
        .forEach((item) => {
          item.read = true;
        });
      break;
    default:
      throw new InputError('Unknown plan action.');
  }
  return plan;
}

export function publicPlan(plan, userId) {
  const member = memberOf(plan, userId);
  return {
    ...plan,
    inviteToken: member.role === 'host' ? plan.inviteToken : null,
    notifications: plan.notifications.filter(
      (item) => item.recipientId === userId,
    ),
  };
}

export function joinPlan(plan, user, name) {
  const existing = plan.members.find((member) => member.id === user.id);
  if (existing) return plan;
  const displayName = text(name, 'Your name', 60);
  const initials = displayName
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
  plan.members.push({
    ...user,
    name: displayName,
    initials,
    role: 'guest',
    rsvp: 'pending',
    constraint: '',
    eta: '',
  });
  addMessage(plan, user.id, `${displayName} joined the plan`, 'system');
  return plan;
}
