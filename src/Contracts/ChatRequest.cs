namespace AiAssistant.Api.Contracts;

//  This file defines the request models sent from the frontend to the backend.

//  This is the main request object used by the chat API.
public sealed record ChatRequest(
    string Question,
    IReadOnlyList<ChatMessageDto>? Messages = null,
    int? TopK = null
);

// Represents a single message in the conversation history.
public sealed record ChatMessageDto(string Role, string Content);