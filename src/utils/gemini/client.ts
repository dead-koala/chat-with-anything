import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
} from "@google/generative-ai";
import { createYoutubeSystemPrompt } from "../youtube-utils";
import { createRagSystemPrompt } from "../query-utils";

// Initialize the Gemini API with the API key from environment variables
// Use server-side environment variable instead of NEXT_PUBLIC
const API_KEY = process.env.GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(API_KEY);

export interface ChatMessage {
  role: "user" | "model";
  content: string;
}

export interface ImageData {
  buffer: Buffer;
  mimeType: string;
}

// Get the Gemini model
export const getGeminiModel = () =>
  genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

// Check if the API is configured
export const isGeminiConfigured = () => !!API_KEY;

// Function to create a chat session
export const createChatSession = () => {
  const model = getGeminiModel();

  // Create chat without any history - we'll handle system prompts differently
  return model.startChat({
    generationConfig: {
      temperature: 0.7,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 8192,
    },
    safetySettings: [
      {
        category: HarmCategory.HARM_CATEGORY_HARASSMENT,
        threshold: HarmBlockThreshold.BLOCK_NONE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
        threshold: HarmBlockThreshold.BLOCK_NONE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
        threshold: HarmBlockThreshold.BLOCK_NONE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
        threshold: HarmBlockThreshold.BLOCK_NONE,
      },
    ],
    history: [], // Always start with empty history
  });
};

// Function to send a message to Gemini
export const sendMessageToGemini = async (
  messages: ChatMessage[],
  fileContent?: string,
  imageData?: ImageData,
) => {
  try {
    if (!isGeminiConfigured()) {
      throw new Error("Gemini API key is not configured");
    }

    console.log("Sending message to Gemini...");
    console.log(`Has file content: ${!!fileContent}`);
    console.log(`Has image data: ${!!imageData}`);
    console.log(`Number of messages: ${messages.length}`);

    // Create chat session (always with empty history)
    const chat = createChatSession();

    // If we have file content, send it as a user message first
    if (fileContent) {
      console.log("Creating RAG context with document content");

      // Determine the type of content and use appropriate system prompt
      let systemPrompt = "";

      if (fileContent === "IMAGE_FILE") {
        // For images, we don't need a system prompt as we're adding context to the user message
        console.log("Image file detected, skipping system prompt");
        // Skip adding system prompt for images
      } else if (
        fileContent === "YOUTUBE_TRANSCRIPT" ||
        messages[messages.length - 1].content.includes("YouTube")
      ) {
        // This is a placeholder - actual transcript content is handled in the actions.ts file
        console.log("YouTube content detected, using YouTube system prompt");
        systemPrompt = createYoutubeSystemPrompt(fileContent);
      } else {
        // Default to RAG system prompt for other document types
        systemPrompt = createRagSystemPrompt(fileContent);
      }

      // Only send system prompt if we have one
      if (systemPrompt) {
        // Send the system prompt as a user message first
        const systemResult = await chat.sendMessage([
          {
            text: `I need you to act as a document assistant with the following instructions: ${systemPrompt}`,
          },
        ]);

        // Get the response to acknowledge the system prompt
        const systemResponse = systemResult.response;
        console.log(
          `System prompt acknowledged: ${systemResponse.text().substring(0, 50)}...`,
        );
      }
    }

    // Process previous messages if there are any (excluding the last one)
    if (messages.length > 1) {
      for (let i = 0; i < messages.length - 1; i++) {
        const msg = messages[i];
        const result = await chat.sendMessage([{ text: msg.content }]);
        // We get the response but don't need to do anything with it
        result.response.text();
      }
    }

    // Send the last user message to get a response
    const lastUserMessage = messages[messages.length - 1];
    console.log(
      `Sending user message to Gemini: ${lastUserMessage.content.substring(0, 50)}...`,
    );

    // Handle image data if present
    if (imageData) {
      console.log("Sending message with image data to Gemini");
      const result = await chat.sendMessage([
        {
          text: lastUserMessage.content,
        },
        {
          inlineData: {
            data: imageData.buffer.toString("base64"),
            mimeType: imageData.mimeType,
          },
        },
      ]);
      const response = result.response;
      console.log("Received response from Gemini with image");
      return response.text();
    } else {
      // Regular text-only message
      const result = await chat.sendMessage([
        { text: lastUserMessage.content },
      ]);
      const response = result.response;
      console.log("Received response from Gemini");
      return response.text();
    }
  } catch (error) {
    console.error("Error in Gemini chat:", error);
    return `I'm sorry, I encountered an error while processing your request. ${error instanceof Error ? error.message : String(error)}`;
  }
};
