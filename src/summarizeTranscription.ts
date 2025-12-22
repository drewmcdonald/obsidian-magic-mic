import OpenAI from 'openai';

export const models = [
  'gpt-5.2',
  'gpt-5.1',
  'gpt-5',
  'gpt-5-mini',
  'gpt-5-nano',
  'gpt-4.1',
  'gpt-4.1-mini',
  'gpt-4o',
  'gpt-4o-mini',
] as const;
export type Model = (typeof models)[number];
export interface SummarizationOptions {
  completionModel: Model;
  completionInstructions: string;
  transcript: string;
}

export type SummarizationResult =
  | { state: 'success'; response: string }
  | { state: 'refused'; refusal: string }
  | { state: 'error'; error: Error };

export default async function summarizeTranscription(
  client: OpenAI,
  { completionModel, completionInstructions, transcript }: SummarizationOptions,
): Promise<SummarizationResult> {
  try {
    const response = await client.chat.completions.create({
      model: completionModel,
      messages: [
        { role: 'system', content: completionInstructions },
        { role: 'user', content: transcript },
      ],
    });
    return processResponse(response);
  } catch (error) {
    return { state: 'error', error };
  }
}

function processResponse(
  response: OpenAI.Chat.Completions.ChatCompletion,
): SummarizationResult {
  const { message } = response.choices[0];
  return message.content
    ? { state: 'success', response: message.content }
    : {
        state: 'refused',
        refusal: message.refusal ?? 'no refusal reason',
      };
}
