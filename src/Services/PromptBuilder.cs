using System.Text;

namespace AiAssistant.Api.Services;

public sealed class PromptBuilder
{
    private const int MaxChunkChars = 900;
    private const int MaxTotalSourceChars = 4500;

    public string BuildSystemPrompt() =>
        """
        You are a helpful assistant for Mesta employees.

        Answer ONLY from the provided sources.
        Do NOT use outside knowledge.
        Do NOT invent steps, rules, permissions, deadlines, or system behavior.

        Your answer must be:
        - in clear Norwegian
        - short
        - practical
        - easy to scan
        - directly useful for the user

        Writing rules:
        - Start with a short direct answer.
        - For practical/process questions, use step-by-step instructions.
        - Keep steps short and concrete.
        - Keep paragraphs very short.
        - Avoid long introductions and long conclusions.
        - Avoid repeating the same point.
        - Use simple wording instead of formal or heavy wording.
        - Only include details that help the user complete the task.

        Preferred structure:
        Kort svar:
        - 1 to 2 short sentences

        Steg for steg:
        1. ...
        2. ...
        3. ...

        Viktig å huske:
        - Only include this if there is an important warning, condition, or exception in the sources.
        - Maximum 2 bullet points.

        Source handling:
        - Do NOT include citation markers like [S1], [S2], etc.
        - Do NOT mention source numbers.
        - Do NOT add a separate source section in the answer.
        - Do NOT include URLs in the answer.
        - The frontend handles sources separately.

        If the sources are incomplete but still useful:
        - Give the best answer you can
        - Clearly mention uncertainty briefly

        If the sources do not contain enough information:
        - Say that briefly
        - Do not guess
        """;

    public string BuildAnswerStyleInstruction(string question)
    {
        var q = (question ?? string.Empty).Trim().ToLowerInvariant();

        if (q.StartsWith("hvordan") || q.Contains("hvordan "))
        {
            return
                """
                Format this answer in Norwegian like this:

                Kort svar:
                One very short practical answer.

                Steg for steg:
                1. First action
                2. Next action
                3. Final action

                Optional:
                Viktig å huske:
                - Only if the sources clearly support it
                - Maximum 2 short bullet points

                Keep the answer short, concrete, and action-oriented.
                Prefer 3-5 steps.
                """;
        }

        if (q.StartsWith("hva er") || q.StartsWith("hva betyr"))
        {
            return
                """
                Format this answer in Norwegian like this:

                Kort svar:
                Give a short explanation first.

                Viktige punkter:
                - 2 to 4 short bullet points only if useful

                Keep it simple, factual, and short.
                """;
        }

        if (q.StartsWith("kan") || q.StartsWith("må") || q.StartsWith("skal"))
        {
            return
                """
                Format this answer in Norwegian like this:

                Kort svar:
                Start with a direct yes/no or clear answer.

                Viktig å huske:
                - Add only the most important condition(s)
                - Maximum 2 short bullet points

                Keep it short and clear.
                """;
        }

        return
            """
            Format this answer in Norwegian with:
            - a short direct answer first
            - then short bullet points or short steps only if helpful

            Keep it concise, simple, and easy to read.
            """;
    }

    public string BuildSourcesBlock(IReadOnlyList<RetrievedChunk> chunks)
    {
        var sb = new StringBuilder();
        var usedChars = 0;

        for (int i = 0; i < chunks.Count; i++)
        {
            if (usedChars >= MaxTotalSourceChars) break;

            var c = chunks[i];
            var content = c.Content ?? string.Empty;

            if (content.Length > MaxChunkChars)
                content = content[..MaxChunkChars] + "…";

            var remaining = MaxTotalSourceChars - usedChars;
            if (remaining <= 0) break;

            if (content.Length > remaining)
                content = content[..remaining] + "…";

            sb.AppendLine($"[S{i + 1}] {c.Title ?? "(untitled)"}");

            if (!string.IsNullOrWhiteSpace(c.Url))
                sb.AppendLine($"URL: {c.Url}");

            sb.AppendLine(content);
            sb.AppendLine();

            usedChars += content.Length;
        }

        return sb.ToString();
    }
}

public sealed record RetrievedChunk(
    string Content,
    string? Title,
    string? Url,
    string? DocumentId
);