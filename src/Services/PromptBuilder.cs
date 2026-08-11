using System.Text;

namespace AiAssistant.Api.Services;

/*
 This class has two main responsibilities:

   1 Build the system prompt
    → instructions that control how the AI behaves
   2 Build the sources block
    → the retrieved document chunks that the AI is allowed to use

MaxChunkChars and MaxTotalSourceChars are used to control how much source text is included. Each chunk is 
limited to 900 characters, and the total source content is limited to 4500 characters.

We normally retrieve 4 chunks. Each chunk is limited to 900 characters, so the actual chunk content
is up to 3600 characters. In addition, the sources block includes metadata like title and URL. 
The total limit of 4500 is a safety limit for content only, and also gives room if more than 4 chunks are passed later.
 */

public sealed class PromptBuilder
{
    private const int MaxChunkChars = 900;
    private const int MaxTotalSourceChars = 4500;

    public string BuildSystemPrompt() =>
        """
        You are an AI assistant for Mesta employees.

        You MUST follow these rules strictly.

        ----------------------------------
        SOURCE RULES (CRITICAL)
        ----------------------------------
        - Use ONLY the provided sources.
        - Do NOT use outside knowledge.
        - Do NOT guess or invent information.
        - Do NOT invent steps, rules, permissions, deadlines, or system behavior.

        ----------------------------------
        ANSWER GOAL
        ----------------------------------
        Your answer must be:
        - in clear Norwegian
        - concise but COMPLETE
        - practical and directly usable
        - easy to scan

        Do NOT make the answer too short if important steps are missing.

        ----------------------------------
        ANSWER FORMAT (STRICT)
        ----------------------------------

        1) If the question contains "hvordan":
   
        Kort svar:
        - 1-2 short practical sentence

        Steg for steg:
        - Give short step-by-step instructions  

        Viktig å huske (ONLY if supported by sources):
        - Max 2 short bullet points

        Rules:
        - Add all steps if available
        - Steps must be concrete and only based on the sources      
        - Do NOT skip important steps
        - Steps must be actionable

        ----------------------------------

        2) If the question starts with "hva er" or "hva betyr":

        Kort svar:
        - Short explanation

        Viktige punkter (optional):
        - 2–4 short bullet points

        ----------------------------------

        3) If the question starts with "kan", "må", or "skal":

        Kort svar:
        - Start with clear yes/no or direct answer

        Viktig å huske:
        - Max 2 essential conditions from sources

        ----------------------------------

        4) Otherwise:

        Kort svar:
        - Direct answer

        - Add short bullets or steps ONLY if useful

        ----------------------------------
        WRITING STYLE
        ----------------------------------
        - Very short paragraphs
        - No introductions
        - No conclusions
        - No repetition
        - Simple wording
        - Only include what helps the user complete the task

        ----------------------------------
        MISSING OR WEAK SOURCES
        ----------------------------------

        If sources contain partial information:
        - Answer as much as possible
        - Add one short sentence about uncertainty

        If sources do NOT contain enough information:
        - Say:
        "Kildene inneholder ikke nok informasjon til å svare sikkert."
        - Do NOT guess

        ----------------------------------
        CONFLICTING SOURCES
        ----------------------------------
        - Prefer the clearest and most specific source
        - If conflict cannot be resolved:
        - Mention it briefly
        - Do NOT guess

        ----------------------------------
        SOURCE HANDLING (IMPORTANT)
        ----------------------------------
        - Do NOT mention source numbers in the answer
        - Do NOT include links
        - Do NOT include a source section
        - The system will handle sources separately
        """;

    // This method converts retrieved search chunks into formatted text that gets inserted into the prompt.
    // Builds the source block that will be sent together with the user question.
    // The sources come from Azure AI Search through RetrievalService.
    public string BuildSourcesBlock(IReadOnlyList<RetrievedChunk> chunks)
    {
        var sb = new StringBuilder();
        var usedChars = 0;

        // Go through each retrieved chunk while we are still under the total limit.
        for (int i = 0; i < chunks.Count && usedChars < MaxTotalSourceChars; i++)
        {
            var chunk = chunks[i];
            // Use empty string if Content is null.This prevents null reference errors.
            var content = chunk.Content ?? string.Empty;

            // Limit each single chunk to MaxChunkChars.
            if (content.Length > MaxChunkChars)
                content = content[..MaxChunkChars] + "…";

            // Calculate how many characters are still allowed in the total source block.
            var remaining = MaxTotalSourceChars - usedChars;

            // If this chunk is larger than the remaining allowed space, cut it so the total source block stays within the limit.
            if (content.Length > remaining)
                content = content[..remaining] + "…";

            sb.AppendLine($"[S{i + 1}] {chunk.Title ?? "(untitled)"}");

            if (!string.IsNullOrWhiteSpace(chunk.Url))
                sb.AppendLine($"URL: {chunk.Url}");

            sb.AppendLine(content);
            sb.AppendLine();

            usedChars += content.Length;
        }

        return sb.ToString();
    }
}
// Represents one retrieved document chunk from the search index.
public sealed record RetrievedChunk(
    string Content,
    string? Title,
    string? Url,
    string? DocumentId
);