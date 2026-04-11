namespace AiAssistant.Api.Contracts;    // This is your API contract layer, Defines what your backend returns to the frontend


public sealed record ChatResponse(
    string Answer,                       // The final AI-generated answer
    IReadOnlyList<SourceHit> Sources    // A list of references used to generate the answer
);

public sealed record SourceHit(     //A single source/document chunk used by the AI
    string? Title,
    string? Url,            //SharePoint file
    string ContentSnippet   //A small extracted piece of text
);