
import { GoogleGenAI, Modality } from "@google/genai";
import { Agent, Message, Role } from '../types';

// Safety check for API key access
const getAIClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("Clé API manquante");
  }
  return new GoogleGenAI({ apiKey });
};

export const generateAgentResponse = async (
  agent: Agent,
  history: Message[],
  context: string,
  allAgents: Agent[]
): Promise<string> => {
  try {
    const ai = getAIClient();
    
    // Construct the conversation history with proper names so agents know who is talking
    const conversationStr = history.map(m => {
      if (m.senderId === 'user') return `Utilisateur: ${m.content}`;
      const sender = allAgents.find(a => a.id === m.senderId);
      return `${sender ? `${sender.name} (${sender.role})` : 'Agent'}: ${m.content}`;
    }).join('\n');
    
    const prompt = `
      Tu participes à une discussion professionnelle de brainstorming (en français).
      
      Ton Profil :
      Nom : ${agent.name}
      Rôle : ${agent.role}
      Spécialité : ${agent.specialty}
      Personnalité : ${agent.personality}
      
      Contexte du projet :
      ${context}
      
      Historique de la conversation actuelle :
      ${conversationStr}
      
      Instructions :
      1. Donne une réponse courte et concise (max 2-3 phrases) basée sur ton expertise.
      2. Réponds à la dernière intervention, mais n'hésite pas à rebondir sur ce qu'ont dit les autres experts (Marc, Chloé, David...) si c'est pertinent. Débat avec eux.
      3. Reste strictement dans ton personnage.
      4. Ne mets pas de préfixe "Nom:" ou "Moi:" dans ta réponse, écris directement le texte.
      5. Parle en français.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text || "Je réfléchis...";
  } catch (error) {
    console.error("Error generating agent response:", error);
    return "Je m'excuse, j'ai du mal à me connecter au réseau pour le moment.";
  }
};

export const generateSummary = async (history: Message[], allAgents: Agent[]): Promise<string> => {
  try {
    const ai = getAIClient();
    const conversationStr = history.map(m => {
      if (m.senderId === 'user') return `Utilisateur: ${m.content}`;
      const sender = allAgents.find(a => a.id === m.senderId);
      return `${sender ? sender.name : 'Agent'}: ${m.content}`;
    }).join('\n');

    const prompt = `
      Résume la session de brainstorming suivante en une liste structurée de points clés et de prochaines étapes (en français).
      Utilise le format Markdown.
      
      Conversation :
      ${conversationStr}
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text || "Pas de résumé disponible.";
  } catch (error) {
    return "Échec de la génération du résumé.";
  }
};

// Helper function to decode base64 string to Uint8Array
function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// Helper to decode PCM data to AudioBuffer
async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number = 24000,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const buffer = ctx.createBuffer(1, dataInt16.length, sampleRate);
  const channelData = buffer.getChannelData(0);
  
  for (let i = 0; i < dataInt16.length; i++) {
    channelData[i] = dataInt16[i] / 32768.0;
  }
  
  return buffer;
}

export const playAgentAudio = async (text: string, voiceName: string): Promise<void> => {
  try {
    const ai = getAIClient();
    
    // Request TTS from Gemini
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: voiceName },
            },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    
    if (!base64Audio) {
      throw new Error("No audio data received");
    }

    // Play the audio
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({sampleRate: 24000});
    const audioBuffer = await decodeAudioData(
      decode(base64Audio),
      audioContext,
      24000
    );

    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContext.destination);
    source.start();

    return new Promise((resolve) => {
      source.onended = () => {
        audioContext.close();
        resolve();
      };
    });

  } catch (error) {
    console.error("TTS Error:", error);
    throw error;
  }
};
