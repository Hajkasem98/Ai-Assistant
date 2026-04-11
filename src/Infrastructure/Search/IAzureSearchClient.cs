using AiAssistant.Api.Services;

namespace AiAssistant.Api.Infrastructure.Search;

/// Interface for Azure AI Search (retrieval layer in RAG)
public interface IAzureSearchClient
{
    /// Search for relevant document chunks
    Task<IReadOnlyList<RetrievedChunk>> SearchAsync(
        string queryText,                        // User query
        int topK,                                // Number of results to return
        string contentField,                     // Field containing main text
        string titleField,                       // Field containing title
        IReadOnlyList<string> urlFields,         // Possible fields for URL
        string documentIdField,                  // Document ID field
        CancellationToken ct);                   // Allows request cancellation
}
