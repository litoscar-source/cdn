import { GoogleGenAI } from "@google/genai";
import { Squad } from "../types";

// Note: In a real app, API Key should be securely managed.
// For this demo, we assume process.env.API_KEY is available.
const apiKey = process.env.API_KEY || ''; 

const ai = new GoogleGenAI({ apiKey });

export const generateTrainingPlan = async (
  squad: Squad, 
  focusArea: string, 
  durationMinutes: number,
  playerCount: number
): Promise<string> => {
  if (!apiKey) {
    return "API Key não configurada. Por favor configure a chave da API para usar o assistente.";
  }

  const prompt = `
    Como treinador de futebol profissional, crie um plano de treino detalhado para o escalão ${squad.name}.
    
    Detalhes:
    - Foco do treino: ${focusArea}
    - Duração: ${durationMinutes} minutos
    - Número de jogadores: ${playerCount}
    
    O plano deve incluir:
    1. Aquecimento (com tempo)
    2. Exercícios principais (descrição, objetivos e tempo)
    3. Retorno à calma
    
    Formate a resposta em Markdown limpo e organizado, em Português de Portugal.
    Seja prático e direto.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    return response.text || "Não foi possível gerar o plano de treino.";
  } catch (error) {
    console.error("Erro ao gerar plano:", error);
    return "Ocorreu um erro ao contactar a IA. Verifique a sua ligação ou a chave API.";
  }
};
