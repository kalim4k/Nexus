
export enum Role {
  USER = 'user',
  AGENT = 'agent',
  SYSTEM = 'system'
}

export enum AgentSpecialty {
  BUSINESS = 'Stratégie Business',
  MARKETING = 'Marketing & Croissance',
  PRODUCT = 'Produit & UX',
  TECH = 'Technologie & Dev',
  LEGAL = 'Juridique & Légal',
  FINANCE = 'Finance & Levée de fonds'
}

export interface Agent {
  id: string;
  name: string;
  role: string; // e.g., "Senior Product Manager"
  specialty: AgentSpecialty;
  avatar: string;
  personality: string;
  color: string;
  voiceName: string; // 'Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'
}

export interface Message {
  id: string;
  sessionId: string;
  senderId: string; // 'user' or agentId
  role: Role;
  content: string;
  timestamp: number;
  isTyping?: boolean;
  replyToId?: string; // ID of the message being replied to
}

export interface Session {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  agentIds: string[];
  preview: string;
}

export interface UserSettings {
  theme: 'light' | 'dark';
  apiKey: string | null;
}
