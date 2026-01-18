import { User, UserRole, Squad, Player } from './types';

export const INITIAL_SQUADS: Squad[] = [
  { id: 's1', name: 'Sub-11' },
  { id: 's2', name: 'Sub-15' },
  { id: 's3', name: 'Seniores' }
];

export const MOCK_USERS: User[] = [
  {
    id: 'u1',
    name: 'Administrador',
    username: 'admin',
    role: UserRole.ADMIN,
    password: '123',
    allowedSquads: [] // Admin sees all regardless
  },
  {
    id: 'u2',
    name: 'Mister João',
    username: 'mister',
    role: UserRole.COACH,
    password: '123',
    allowedSquads: ['s1'] // Only Sub-11
  },
  {
    id: 'u3',
    name: 'Staff Apoio',
    username: 'staff',
    role: UserRole.STAFF,
    password: '123',
    allowedSquads: ['s1', 's2'] 
  }
];

export const MOCK_PLAYERS: Player[] = [
  {
    id: 'p1',
    squadId: 's1',
    name: 'Tomás Silva',
    address: 'Rua das Flores, 12',
    birthDate: '2014-05-12',
    jerseyNumber: 10,
    jerseyName: 'T. Silva',
    kitSize: 'S',
    tracksuitSize: '12A',
    notes: 'Médio criativo. Pé esquerdo.',
    emergencyName: 'Maria Silva',
    emergencyContact: '912345678'
  },
  {
    id: 'p2',
    squadId: 's3',
    name: 'André Costa',
    address: 'Av. Liberdade, 50',
    birthDate: '1998-02-20',
    jerseyNumber: 9,
    jerseyName: 'Costa',
    kitSize: 'L',
    tracksuitSize: 'L',
    notes: 'Ponta de lança.',
    emergencyName: 'Pedro Costa',
    emergencyContact: '966554433'
  }
];