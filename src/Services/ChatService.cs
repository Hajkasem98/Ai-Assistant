using AiAssistant.Api.Contracts;
using AiAssistant.Api.Infrastructure.Llm;
using System.Runtime.CompilerServices;
using System.Text.RegularExpressions;

namespace AiAssistant.Api.Services;

/*
 ChatService is the main service that controls the full chat flow in the backend.

When the frontend sends a user question, this class does the following:

Receives the question from ChatRequest.
Decides how many search results/chunks to retrieve using TopK.
Uses RetrievalService to search Azure AI Search and get relevant document chunks.
Removes duplicate chunks using DistinctChunks.
Builds the prompt/messages using PromptBuilder.
Sends the messages to the LLM through IChatCompletionClient.
Cleans the AI answer before returning it.
Returns the final answer together with source information.

So this class connects three important parts of the RAG pipeline:

User question
   ↓
ChatService
   ↓
RetrievalService → Azure AI Search
   ↓
PromptBuilder → system prompt + sources
   ↓
IChatCompletionClient → Azure OpenAI
   ↓
Answer + sources returned to frontend
 
 
 */
public sealed class ChatService
{
    private readonly RetrievalService _retrieval;
    private readonly PromptBuilder _prompt;
    private readonly IChatCompletionClient _chat;

    public ChatService(RetrievalService retrieval, PromptBuilder prompt, IChatCompletionClient chat)
    {
        _retrieval = retrieval;
        _prompt = prompt;
        _chat = chat;
    }

    // Handles streaming chat responses instead of waiting for the full answer
    // this method returns small chunks while the LLM is generating text.
    public async IAsyncEnumerable<string> StreamAnswerAsync(
        ChatRequest req,
        [EnumeratorCancellation] CancellationToken ct)
    {
        var topK = req.TopK ?? 4;
        if (topK is < 1 or > 20) topK = 4;

        var chunks = await _retrieval.RetrieveAsync(req.Question, topK, ct);
        var distinctChunks = DistinctChunks(chunks);

        var messages = BuildMessages(req, distinctChunks);

        // Tracks whether the LLM returned any actual content.
        var gotAnyContent = false;

        // Start streaming response chunks from the LLM.
        await foreach (var chunk in _chat.CompleteStreamingAsync(messages, ct).WithCancellation(ct))
        {
            // Skip empty chunks.
            if (string.IsNullOrWhiteSpace(chunk))
                continue;

            // Mark that at least one useful chunk was received and return it.
            gotAnyContent = true;
            yield return chunk;
        }
        // If the model returned no content, return a fallback answer.
        if (!gotAnyContent)
            yield return BuildGroundedFallbackAnswer(req.Question, distinctChunks);
    }

    // Retrieves only the sources and the frontend fetches sources after the answer.
    public async Task<IReadOnlyList<SourceHit>> GetSourcesAsync(ChatRequest req, CancellationToken ct)
    {
        var topK = req.TopK ?? 4;
        if (topK is < 1 or > 20) topK = 4;

        var chunks = await _retrieval.RetrieveAsync(req.Question, topK, ct);
        var distinctChunks = DistinctChunks(chunks);

        // Convert chunks to SourceHit objects for the frontend.
        return BuildSourceHits(distinctChunks);
    }

    // Builds the full message list sent to the LLM.
    // This includes:
    // - system instructions
    // - source content
    // - previous chat history
    // - current user question
    private List<LlmChatMessage> BuildMessages(ChatRequest req, IReadOnlyList<RetrievedChunk> distinctChunks)
    {
        var system = _prompt.BuildSystemPrompt();
        var sources = _prompt.BuildSourcesBlock(distinctChunks);

        // Start the message list with system instructions and sources.
        var messages = new List<LlmChatMessage>
        {
            new("system", system),
            new("system", "SOURCES:\n" + sources)
        };

        // Add previous chat history if it exists.
        if (req.Messages is { Count: > 0 })
        {
            foreach (var m in req.Messages)
            {
                // Normalize the role value.
                var role = (m.Role ?? "").Trim().ToLowerInvariant();
                // Only allow valid chat roles.
                if (role is not ("system" or "user" or "assistant")) continue;
                // Skip empty messages.
                if (string.IsNullOrWhiteSpace(m.Content)) continue;
                // Add the message to the final LLM message list.
                messages.Add(new LlmChatMessage(role, m.Content));
            }
        }
        // Normalize the current user question.
        var normalizedQuestion = req.Question.Trim();
        // Find the last user message in the existing message list.
        var lastUserMessage = messages.LastOrDefault(m => m.Role == "user");

        // Add the current question only if it is not already the last user message.
        // This avoids sending the same question twice to the LLM.
        if (lastUserMessage is null ||
            !string.Equals(lastUserMessage.Content.Trim(), normalizedQuestion, StringComparison.Ordinal))
        {
            messages.Add(new("user", req.Question));
        }

        return messages;
    }
    // Removes duplicate retrieved chunks.
    private static List<RetrievedChunk> DistinctChunks(IReadOnlyList<RetrievedChunk> chunks)
    {
        return chunks
            .GroupBy(c =>
            {
                // If DocumentId exists, use it as the unique key.
                if (!string.IsNullOrWhiteSpace(c.DocumentId))
                    return $"doc:{c.DocumentId.Trim().ToLowerInvariant()}";

                // If Url exists, use it as the unique key.
                if (!string.IsNullOrWhiteSpace(c.Url))
                    return $"url:{c.Url.Trim().ToLowerInvariant()}";

                // If no DocumentId or Url exists, fall back to Title.
                return $"title:{(c.Title ?? string.Empty).Trim().ToLowerInvariant()}";
            })
            .Select(g => g.First())
            .ToList();
    }

    // Converts retrieved chunks into SourceHit objects for the frontend.
    private static List<SourceHit> BuildSourceHits(IReadOnlyList<RetrievedChunk> chunks)
    {
        return chunks
            .GroupBy(c =>
            {
                // Use URL first so multiple chunks from the same PDF are shown as one source.
                if (!string.IsNullOrWhiteSpace(c.Url))
                    return $"url:{c.Url.Trim().ToLowerInvariant()}";

                if (!string.IsNullOrWhiteSpace(c.Title))
                    return $"title:{c.Title.Trim().ToLowerInvariant()}";

                if (!string.IsNullOrWhiteSpace(c.DocumentId))
                    return $"doc:{c.DocumentId.Trim().ToLowerInvariant()}";

                return $"content:{c.Content[..Math.Min(c.Content.Length, 80)].Trim().ToLowerInvariant()}";
            })
            .Select(g =>
            {
                var c = g.First();

                return new SourceHit(
                    Title: c.Title,
                    Url: c.Url,
                    ContentSnippet: c.Content.Length <= 240
                        ? c.Content
                        : c.Content[..240] + "…"
                );
            })
            .ToList();
    }

    // Cleans the assistant answer before sending it to the frontend.
    private static string CleanAssistantAnswer(string answer)
    {
        if (string.IsNullOrWhiteSpace(answer))
            return string.Empty;

        // Normalize Windows line endings to Unix-style line endings and trim spaces.
        var cleaned = answer.Replace("\r\n", "\n").Trim();
        // Fix formatting for lists and numbered steps.
        cleaned = NormalizeListFormatting(cleaned);

        // Replace three or more line breaks with only two.
        cleaned = Regex.Replace(
            cleaned,
            @"\n{3,}",
            "\n\n",
            RegexOptions.Multiline);

        // Remove source sections from the answer.
        // The frontend already displays sources separately,
        // so the answer should not include "Kilder", "Referanser", or "Sources".
        cleaned = Regex.Replace(
            cleaned,
            @"(?is)\n?(kilder|referanser|sources)\s*:\s*.*$",
            "",
            RegexOptions.IgnoreCase);

        return cleaned.Trim();
    }
    // Normalizes list formatting in the assistant answer.
    // This fixes cases where numbered lists or bullets are glued to previous text.
    private static string NormalizeListFormatting(string text)
    {
        if (string.IsNullOrWhiteSpace(text))
            return string.Empty;

        var normalized = text;

        // Insert line break before list steps like "2. ..." when they are glued to previous text.
        normalized = Regex.Replace(
            normalized,
            @"(?:(?<=[!?;:])|(?:(?<!\d)\.))\s*(?=\d{1,2}\.\s*\p{L})",
            "\n");

        // Insert line break before bullets when they are glued to previous text.
        normalized = Regex.Replace(
            normalized,
            @"(?:(?<=[.!?;:])|(?<=[\p{L}\)\]]))\s*(?=[\-•]\s+)",
            "\n");

        return normalized;
    }

    // Builds a fallback answer if the LLM fails to return useful content.
    // The fallback still uses retrieved source chunks, so it remains grounded.
    private static string BuildGroundedFallbackAnswer(string question, IReadOnlyList<RetrievedChunk> chunks)
    {
        if (chunks.Count == 0)
            return "Jeg finner ingen relevante kilder akkurat nå. Prøv å formulere spørsmålet mer konkret.";

        static string Clean(string text)
            => text.Replace("\r", " ").Replace("\n", " ").Trim();

        var highlights = chunks
            .Select(c => Clean(c.Content))
            .Where(c => !string.IsNullOrWhiteSpace(c))
            .Take(2)
            .Select(c => c.Length <= 220 ? c : c[..220] + "…")
            .ToList();

        if (highlights.Count == 0)
            return "Jeg fant relevante kilder, men klarte ikke å lage et godt svar automatisk. Prøv å formulere spørsmålet litt mer konkret.";

        var joined = string.Join("\n- ", highlights);
        return $"Kort svar:\nJeg fant relevant informasjon, men klarte ikke å lage et fullstendig svar automatisk.\n\nRelevant fra kildene:\n- {joined}";
    }
}