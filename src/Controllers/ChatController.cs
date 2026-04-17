using AiAssistant.Api.Contracts;
using AiAssistant.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace AiAssistant.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public sealed class ChatController : ControllerBase
{
    private readonly ChatService _chat;

    public ChatController(ChatService chat)
    {
        _chat = chat;
    }

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
        Response.ContentType = "text/plain; charset=utf-8";

        await foreach (var chunk in _chat.StreamAnswerAsync(req, ct))
        {
            if (string.IsNullOrEmpty(chunk))
                continue;

            await Response.WriteAsync(chunk, ct);
            await Response.Body.FlushAsync(ct);
        }
    }

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

    [HttpPost("sources")]
    [ProducesResponseType(typeof(IReadOnlyList<SourceHit>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<SourceHit>>> Sources([FromBody] ChatRequest req, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(req.Question))
            return BadRequest("Question is required.");

        var sources = await _chat.GetSourcesAsync(req, ct);
        return Ok(sources);
    }

    [HttpPost]
    [ProducesResponseType(typeof(ChatResponse), StatusCodes.Status200OK)]
    public async Task<ActionResult<ChatResponse>> Post([FromBody] ChatRequest req, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(req.Question))
            return BadRequest("Question is required.");

        var result = await _chat.AskAsync(req, ct);
        return Ok(result);
    }
}