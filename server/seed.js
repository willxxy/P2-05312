import { randomUUID } from 'node:crypto';
import { newPlan } from './plans.js';

export function seedPlans(user) {
  const people = [
    ['maya', 'Maya Chen', 'MC', 'peach', 'going'],
    ['jordan', 'Jordan Lee', 'JL', 'blue', 'going'],
    ['sam', 'Sam Rivera', 'SR', 'lavender', 'going'],
    ['olivia', 'Olivia Park', 'OP', 'rose', 'going'],
    ['ben', 'Ben Carter', 'BC', 'sand', 'going'],
    ['leo', 'Leo Davis', 'LD', 'blue', 'maybe'],
    ['nina', 'Nina Patel', 'NP', 'peach', 'pending'],
  ].map(([id, name, initials, color, rsvp]) => ({
    id,
    name,
    initials,
    color,
    rsvp,
    role: 'guest',
    constraint: id === 'leo' ? 'Waiting on my work schedule' : '',
    eta: '',
  }));

  const trip = newPlan(user, {
    name: 'Big Sur, little escape',
    description: 'A weekend off the grid, with our favorite people.',
    emoji: '🏕️',
  });
  trip.members.push(...people);
  trip.location = 'Big Sur, California';
  trip.address = 'Pfeiffer Big Sur State Park, 47225 CA-1, Big Sur, CA 93920';
  trip.dates = [
    {
      id: 'date-1',
      start: '2026-10-16',
      end: '2026-10-18',
      voters: [user.id, 'maya', 'jordan', 'sam', 'olivia', 'ben'],
    },
    {
      id: 'date-2',
      start: '2026-10-23',
      end: '2026-10-25',
      voters: ['maya', 'sam', 'leo', user.id],
    },
    {
      id: 'date-3',
      start: '2026-10-30',
      end: '2026-11-01',
      voters: ['jordan', 'olivia', 'ben'],
    },
  ];
  trip.lockedDateId = 'date-1';
  trip.proposals = [
    {
      id: 'cabin',
      title: 'Our little home in the redwoods',
      detail:
        'Riverside cabin · 2 nights · $120 per person. A fireplace, a big deck, and absolutely no plans to check our email.',
      authorId: 'maya',
      votes: ['maya', user.id, 'jordan', 'sam', 'olivia', 'ben'],
      status: 'confirmed',
    },
    {
      id: 'dinner',
      title: 'Tacos on the first night?',
      detail:
        'An easy cabin dinner. I’ll bring the tortillas and fillings — everyone brings a topping. Vegetarian options included 🌮',
      authorId: 'sam',
      votes: ['sam', 'maya', 'jordan'],
      status: 'open',
    },
    {
      id: 'hike',
      title: 'A slow morning at Pfeiffer Beach',
      detail:
        'Coffee first, beach second. Saturday at 10am, with a stop at the bakery on the way.',
      authorId: 'jordan',
      votes: ['jordan', 'ben'],
      status: 'open',
    },
  ];
  trip.tasks = [
    { id: 'task-1', title: 'Book the cabin', ownerId: 'maya', done: true },
    {
      id: 'task-2',
      title: 'Plan the first-night dinner',
      ownerId: 'sam',
      done: false,
    },
    { id: 'task-3', title: 'Bring a cooler + ice', ownerId: null, done: false },
    {
      id: 'task-4',
      title: 'Make the road trip playlist',
      ownerId: user.id,
      done: false,
    },
  ];
  trip.expenses = [
    {
      id: 'expense-1',
      title: 'Riverside cabin · 2 nights',
      amount: 72000,
      paidBy: 'maya',
      participants: [user.id, 'maya', 'jordan', 'sam', 'olivia', 'ben'],
      settledIds: ['maya', 'sam', 'ben'],
    },
  ];
  const messages = [
    [
      'maya',
      'Okay, officially putting this into the universe. A weekend in Big Sur. No laptops, just trees. 🌲',
      'text',
    ],
    ['jordan', 'You had me at no laptops.', 'text'],
    [
      user.id,
      'October 16–18 works for six of us. Let’s make it happen!',
      'text',
    ],
    [user.id, 'Alex locked the date · Oct 16–18', 'system'],
    [
      'maya',
      'Found us a little home in the redwoods. Look at this place 🥹',
      'text',
    ],
    ['maya', 'cabin', 'decision'],
    [
      'sam',
      'Already mentally there. I can handle dinner on Friday — put a taco proposal in Decisions 🌮',
      'text',
    ],
    [
      'olivia',
      'A fireplace and zero reception? This is exactly what we need.',
      'text',
    ],
  ];
  trip.messages = messages.map(([authorId, message, type], index) => ({
    id: randomUUID(),
    authorId,
    text: message,
    type,
    createdAt: new Date(
      Date.now() - (messages.length - index) * 8 * 60000,
    ).toISOString(),
  }));

  const dinner = newPlan(user, {
    name: 'Thursday supper club',
    description: 'Good food. Better company.',
    emoji: '🍝',
  });
  dinner.color = 'peach';
  dinner.members.push(...people.slice(0, 4));
  dinner.location = 'Brooklyn, New York';
  dinner.dates = [
    {
      id: 'supper-date',
      start: '2026-10-08',
      end: '2026-10-08',
      voters: [user.id, 'maya', 'sam'],
    },
  ];
  dinner.messages = [
    {
      id: randomUUID(),
      authorId: 'maya',
      text: 'Same table, new restaurant? I’ve been meaning to try that little Italian place on Smith Street.',
      type: 'text',
      createdAt: new Date().toISOString(),
    },
  ];

  const portugal = newPlan(user, {
    name: 'Somewhere in Portugal',
    description: 'A little sun to look forward to.',
    emoji: '🌊',
  });
  portugal.color = 'blue';
  portugal.members.push(
    ...people.slice(0, 3).map((person) => ({ ...person, rsvp: 'maybe' })),
  );
  portugal.messages = [
    {
      id: randomUUID(),
      authorId: 'jordan',
      text: 'Lisbon, Porto, or a little bit of both? Leaving this here before we forget again.',
      type: 'text',
      createdAt: new Date().toISOString(),
    },
  ];

  const birthday = newPlan(user, {
    name: 'Maya turns 28',
    description: 'Cake is a non-negotiable.',
    emoji: '🎂',
  });
  birthday.color = 'lavender';
  birthday.members.push(
    ...people.filter((person) => person.id !== 'maya').slice(0, 4),
  );
  birthday.location = 'The usual rooftop';
  birthday.dates = [
    {
      id: 'birthday-date',
      start: '2026-11-07',
      end: '2026-11-07',
      voters: [user.id, 'jordan', 'sam', 'olivia', 'ben'],
    },
  ];
  birthday.lockedDateId = 'birthday-date';
  birthday.messages = [
    {
      id: randomUUID(),
      authorId: 'sam',
      text: 'Operation birthday is a go. Who’s on cake duty? 🎂',
      type: 'text',
      createdAt: new Date().toISOString(),
    },
  ];
  return [trip, dinner, portugal, birthday];
}
