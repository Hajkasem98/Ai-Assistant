using System.Text;

namespace AiAssistant.Api.Services;

public sealed class PromptBuilder
{
    private const int MaxChunkChars = 900;
    private const int MaxTotalSourceChars = 4500;

    public string BuildSystemPrompt() =>
        """
        You are a helpful assistant answering questions about Mesta work processes and system usage.

        Use ONLY the provided sources.
        Do not use outside knowledge.
        Do not invent steps, rules, or facts that are not supported by the sources.

        If the sources clearly support an answer, give the best direct answer in Norwegian.
        If the sources are incomplete but still useful, give the best possible answer and briefly mention any uncertainty.
        Only say that you do not know if the sources do not contain enough information to answer at all.

        Ignore irrelevant, duplicated, or weakly related source text.

        Write the answer in clean, natural Norwegian.
        Do not include citation markers like [S1] or [S2].
        Do not mention source numbers.
        Do not add a separate source section.
        File links are handled by the system.

        Structure answers clearly so they are easy to read in the frontend.

        Preferred structure:
        - Start with a short direct answer.
        - Then organize the answer using short section headings when helpful.
        - For practical questions, use step-by-step instructions.
        - For overview questions, use short sections or bullet points.
        - Keep paragraphs short.
        - Keep the answer concise, but complete enough to be useful.

        Use headings like:
        Kort svar:
        Steg for steg:
        Viktig å huske:

        Only include headings that are actually useful for the question.
        """;

    public string BuildAnswerStyleInstruction(string question)
    {
        var q = (question ?? string.Empty).Trim().ToLowerInvariant();

        if (q.StartsWith("hvordan") || q.Contains("hvordan "))
        {
            return
                """
                Answer in Norwegian using this structure when possible:

                Kort svar:
                Give one short direct answer.

                Steg for steg:
                1. First step
                2. Next step
                3. Final step

                Viktig å huske:
                - Add only important warnings, conditions, or exceptions if the sources support them.

                Keep it practical, precise, and easy to follow.
                Do not include any citation markers.
                """;
        }

        if (q.StartsWith("hva er") || q.StartsWith("hva betyr"))
        {
            return
                """
                Answer in Norwegian using this structure when possible:

                Kort svar:
                Give a short definition or explanation first.

                Viktige detaljer:
                - List the most important points supported by the sources.

                Keep it short, clear, and factual.
                Do not include any citation markers.
                """;
        }

        if (q.StartsWith("kan") || q.StartsWith("må") || q.StartsWith("skal"))
        {
            return
                """
                Answer in Norwegian with a direct answer first.

                If useful, structure the answer like this:
                Kort svar:
                ...

                Viktig å huske:
                - ...
                - ...

                Keep the answer clear and grounded in the sources.
                Do not include any citation markers.
                """;
        }

        return
            """
            Answer in Norwegian as clearly and directly as possible.

            Prefer this structure when helpful:
            Kort svar:
            ...

            Viktige punkter:
            - ...
            - ...

            If the question is practical, use short steps instead.
            Do not include any citation markers.
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