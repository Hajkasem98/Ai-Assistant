namespace AiAssistant.Api.Contracts;

public sealed record SourceHit(
    string? Title,
    string? Url,
    string ContentSnippet
);