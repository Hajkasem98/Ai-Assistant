using AiAssistant.Api.Contracts;
using AiAssistant.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace AiAssistant.Api.Controllers;

/*
 ChatController, an ASP.NET Core API controller. It exposes HTTP endpoints that
the frontend can call to interact with the AI assistant.
The controller does not contain the AI logic itself. 
Instead, it delegates the real work to ChatService.
Main responsibilities:

    1.Receive chat questions from the frontend.
    2.Validate that the question is not empty.
    3.Return normal AI answers.
    4.Stream AI answers chunk by chunk.
    5.Return source documents used by the assistant.
    6.Generate an Azure Speech token for voice features. 
 */

[ApiController]
[Route("api/[controller]")]
public sealed class ChatController : ControllerBase
{
    private readonly ChatService _chat;

    public ChatController(ChatService chat)
    {
        _chat = chat;
    }

    //  Its purpose is to send the answer back piece by piece while the AI is generating it
    // Instead of waiting for the full answer, the frontend receives small text chunks continuously.
    [HttpPost("stream")]
    public async Task Stream([FromBody] ChatRequest req, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(req.Question))
        {
            Response.StatusCode = StatusCodes.Status400BadRequest;
            await Response.WriteAsync("Question is required.", ct);
            return;
        }

        Response.StatusCode = StatusCodes.Status200OK;
        //  Tell the client that the response is plain UTF-8 text.
        Response.ContentType = "text/plain; charset=utf-8";

        // Call ChatService to get the AI answer as a stream of text chunks.
        await foreach (var chunk in _chat.StreamAnswerAsync(req, ct))
        {
            if (string.IsNullOrEmpty(chunk))
                continue;

            await Response.WriteAsync(chunk, ct);
            await Response.Body.FlushAsync(ct);
        }
    }
    
     // It creates a temporary Azure Speech token.
     // The frontend can use this token for speech-to-text or text-to-speech.
    [HttpGet("speech-token")] // Sm-Dev
    public async Task<IActionResult> GetSpeechToken()
    {
        try
        {
            var key = Environment.GetEnvironmentVariable("SPEECH_KEY");
            var region = Environment.GetEnvironmentVariable("SPEECH_REGION");

            if (string.IsNullOrEmpty(key) || string.IsNullOrEmpty(region))
            {
                return BadRequest($"Missing config. Key: {key != null}, Region: {region != null}");
            }

            using var client = new HttpClient();
            client.DefaultRequestHeaders.Add("Ocp-Apim-Subscription-Key", key);

            var response = await client.PostAsync(
                $"https://{region}.api.cognitive.microsoft.com/sts/v1.0/issueToken",
                null
            );

            if (!response.IsSuccessStatusCode)
            {
                var error = await response.Content.ReadAsStringAsync();
                return StatusCode((int)response.StatusCode, error);
            }

            var token = await response.Content.ReadAsStringAsync();

            return Ok(new
            {
                token = token,
                region = region
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, ex.ToString());
        }
    }

    // It returns the source documents related to the user’s question.
    [HttpPost("sources")]
    [ProducesResponseType(typeof(IReadOnlyList<SourceHit>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<SourceHit>>> Sources([FromBody] ChatRequest req, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(req.Question))
            return BadRequest("Question is required.");

        // Ask ChatService to retrieve the sources related to the question.
        var sources = await _chat.GetSourcesAsync(req, ct);
        return Ok(sources);
    }

}