namespace AiAssistant.Api.Contracts;

/// Stateless by default. For multi-turn chat without a database,
/// send the last N messages (role: system|user|assistant).
/// 
///  sealed record: "An immutable data object that cannot be extended or inherited"

public sealed record ChatRequest(       //Represents a request sent to your AI/chat API
    string Question,
    IReadOnlyList<ChatMessageDto>? Messages = null, // IReadOnlyList ? cannot be modified after creation (safe + predictable)
    int? TopK = null        // Controls how many results/documents to fetch
);

public sealed record ChatMessageDto(string Role, string Content);   //Represents a single message in the conversation


/*
 -sealed Prevents inheritance Improves: Performance and Predictability. Good practice for DTOs (they shouldn’t be extended)
 -A record (immutable data object in C#)
 -sealed record: "An immutable data object that cannot be extended or inherited"

Why use sealed record?
? 1. You want a pure data model (DTO)

Perfect for:

API requests/responses
Database transfer objects
Messaging systems

?? Your example (ChatRequest) is exactly this ??

? 2. You want immutability (safe data)

Once created ? cannot be changed accidentally

var req = new ChatRequest("Hi");
// req.Question = "New"; ? not allowed
? 3. You want value comparison

Two objects with same data = equal

Great for:

Caching
Testing
State comparison
? 4. You want to prevent misuse

sealed ensures:

No one extends your model in weird ways
Your API contract stays stable
 
 */