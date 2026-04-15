using AiAssistant.Api.Contracts;
using AiAssistant.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace AiAssistant.Api.Controllers;

[ApiController]
[Route("api/[controller]")] //Defines endpoint URL
public sealed class ChatController : ControllerBase //Cannot be inherited (good for API stability)
{
    // Service that contains the core AI logic (retrieval + generation)
    private readonly ChatService _chat;

    public ChatController(ChatService chat) //Constructor with dependency injection.
    {
        _chat = chat;
    }

    /// <summary>
    /// Stateless chat endpoint (no database).
    ///
    /// Flow:
    /// 1. Receives user question + optional chat history
    /// 2. Calls ChatService (RAG pipeline)
    ///    - Azure AI Search ? retrieve documents
    ///    - Azure OpenAI ? generate answer
    /// 3. Returns answer + sources
    /// </summary>
    [HttpPost]
    [ProducesResponseType(typeof(ChatResponse), StatusCodes.Status200OK)]
    public async Task<ActionResult<ChatResponse>> Post(
        [FromBody] ChatRequest req,     // Request body (JSON ? ChatRequest)
        CancellationToken ct)       // Allows request cancellation (important for async/AI calls)
    {
        if (string.IsNullOrWhiteSpace(req.Question))
            return BadRequest("Question is required.");

        var result = await _chat.AskAsync(req, ct);
        return Ok(result);
    }
}
