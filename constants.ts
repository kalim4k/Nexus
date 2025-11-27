
import { Agent, AgentSpecialty } from './types';

export const DEFAULT_AGENTS: Agent[] = [
  {
    id: 'agent-business',
    name: 'Marc Sterling',
    role: 'Stratège Business',
    specialty: AgentSpecialty.BUSINESS,
    avatar: 'https://picsum.photos/seed/marcus/200/200',
    personality: 'Analytique, direct, focalisé sur le ROI. Pose toujours des questions sur la monétisation et la scalabilité.',
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100',
    voiceName: 'Fenrir', // Deep, serious
  },
  {
    id: 'agent-marketing',
    name: 'Chloé Vane',
    role: 'Responsable Growth',
    specialty: AgentSpecialty.MARKETING,
    avatar: 'https://picsum.photos/seed/chloe/200/200',
    personality: 'Créative, énergique, à l\'affût des tendances. Se concentre sur la viralité, l\'image de marque et l\'acquisition utilisateur.',
    color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100',
    voiceName: 'Kore', // Energetic, higher pitch
  },
  {
    id: 'agent-product',
    name: 'David Chen',
    role: 'Lead Produit',
    specialty: AgentSpecialty.PRODUCT,
    avatar: 'https://picsum.photos/seed/david/200/200',
    personality: 'Centré utilisateur, empathique, soucieux du détail. Obsédé par les parcours UX et le périmètre MVP.',
    color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100',
    voiceName: 'Puck', // Friendly, clear
  },
];

export const DEMO_SESSION_ID = 'demo-session-001';

export const DEMO_MESSAGES_INIT = [
  {
    id: 'msg-1',
    sessionId: DEMO_SESSION_ID,
    senderId: 'user',
    role: 'user',
    content: 'Idée : Je veux lancer une marque de smoothies hyper-protéinés pour les télétravailleurs qui oublient de manger le midi.',
    timestamp: Date.now() - 100000,
  },
  {
    id: 'msg-2',
    sessionId: DEMO_SESSION_ID,
    senderId: 'agent-business',
    role: 'agent',
    content: 'C\'est une niche solide. Les télétravailleurs ont du pouvoir d\'achat mais peu de temps. Défi principal : La logistique du frais vs la poudre longue conservation. As-tu calculé les marges sur du prêt-à-boire vs abonnement poudre ?',
    timestamp: Date.now() - 80000,
  },
  {
    id: 'msg-3',
    sessionId: DEMO_SESSION_ID,
    senderId: 'agent-marketing',
    role: 'agent',
    content: 'J\'adore la cible ! "Oublier de manger" est un vrai point de douleur. On devrait brander ça comme "Carburant pour la Concentration" plutôt que juste du fitness. Peut-être des campagnes avec des influenceurs productivité sur YouTube ?',
    timestamp: Date.now() - 60000,
  },
] as any[];
