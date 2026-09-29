export type Person = {
  id: string;
  name: string;
  initials: string;
  color: string;
};

export type Member = Person & {
  role: 'host' | 'guest';
  rsvp: 'going' | 'maybe' | 'declined' | 'pending';
  constraint: string;
  eta: string;
};

export type DateOption = {
  id: string;
  start: string;
  end: string;
  voters: string[];
};
export type Proposal = {
  id: string;
  title: string;
  detail: string;
  authorId: string;
  votes: string[];
  status: 'open' | 'confirmed';
};
export type Task = {
  id: string;
  title: string;
  ownerId: string | null;
  done: boolean;
};
export type Expense = {
  id: string;
  title: string;
  amount: number;
  paidBy: string;
  participants: string[];
  settledIds: string[];
};
export type Message = {
  id: string;
  authorId: string;
  text: string;
  type: 'text' | 'system' | 'decision';
  createdAt: string;
};
export type Notice = {
  id: string;
  recipientId: string;
  title: string;
  read: boolean;
  createdAt: string;
};

export type Plan = {
  id: string;
  name: string;
  description: string;
  emoji: string;
  color: string;
  location: string;
  address: string;
  minGoing: number;
  lockedDateId: string | null;
  inviteToken: string | null;
  createdAt: string;
  lastNudge?: string;
  members: Member[];
  dates: DateOption[];
  proposals: Proposal[];
  tasks: Task[];
  expenses: Expense[];
  messages: Message[];
  notifications: Notice[];
};

export type Action = (
  type: string,
  payload?: Record<string, unknown>,
) => Promise<void>;
export type ModalKind =
  | 'create'
  | 'invite'
  | 'dates'
  | 'members'
  | 'rsvp'
  | 'location'
  | 'day'
  | 'proposal'
  | 'task'
  | 'expense'
  | null;
