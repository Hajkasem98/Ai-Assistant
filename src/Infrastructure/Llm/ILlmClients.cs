namespace AiAssistant.Api.Infrastructure.Llm;

/// Interface for embedding models (text ? vector)
/// Used for search/retrieval (RAG)
public interface IEmbeddingClient
{
    // Takes text input and returns embedding vector
    Task<float[]> EmbedAsync(string input, CancellationToken ct);
}

/// Interface for chat completion (AI response generation)
public interface IChatCompletionClient
{
    // Takes chat messages and returns AI-generated answer
    Task<string> CompleteAsync(IReadOnlyList<LlmChatMessage> messages, CancellationToken ct);
}
/// Represents a single message sent to the LLM
public sealed record LlmChatMessage(string Role, string Content);
