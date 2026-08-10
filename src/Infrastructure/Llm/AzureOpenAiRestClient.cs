using AiAssistant.Api.Utils;
using System.Runtime.CompilerServices;
using System.Text;
using System.Text.Json;

namespace AiAssistant.Api.Infrastructure.Llm;

/* <summary>
     This class is a small Azure OpenAI client for the backend. 
     It talks directly to Azure OpenAI through REST API, without using an SDK.
     It has two main jobs:
     - Create embeddings
     - Send chat messages and get an answer, either normally or as streaming text
 </summary> */

/*  two interfaces:
    IEmbeddingClient ? used when the app needs embeddings for search/RAG
    IChatCompletionClient ? used when the app needs an answer from the LLM
*/
public sealed class AzureOpenAiRestClient : IEmbeddingClient, IChatCompletionClient
{
    private readonly IHttpClientFactory _http;
    private readonly IConfiguration _config;
    private readonly SystemTextJson _json;

    public AzureOpenAiRestClient(IHttpClientFactory http, IConfiguration config, SystemTextJson json)
    {
        _http = http;
        _config = config;
        _json = json;
    }

    //  This method converts text into a vector.
    public async Task<float[]> EmbedAsync(string input, CancellationToken ct)
    {
        //  Read Azure OpenAI configuration
        var endpoint = Require("AzureOpenAI:Endpoint").TrimEnd('/');
        var key = Require("AzureOpenAI:ApiKey");
        var deployment = Require("AzureOpenAI:EmbeddingDeployment");
        var apiVersion = _config["AzureOpenAI:ApiVersion"] ?? "2024-02-15-preview";

        //  Builds the embeddings URL
        var url = $"{endpoint}/openai/deployments/{deployment}/embeddings?api-version={apiVersion}";

        // Text that should be converted to an embedding vector
        var payload = new
        {
            input
        };
       
        using var req = new HttpRequestMessage(HttpMethod.Post, url);

        // Add API key and JSON body
        req.Headers.Add("api-key", key);    
        req.Content = new StringContent(JsonSerializer.Serialize(payload, _json.Options), Encoding.UTF8, "application/json");

        // Send request to Azure OpenAI
        var client = _http.CreateClient();
        using var resp = await client.SendAsync(req, ct);

        // Read response as text
        var body = await resp.Content.ReadAsStringAsync(ct);

        // Throw error if Azure returns failure
        if (!resp.IsSuccessStatusCode)
            throw new InvalidOperationException($"Azure OpenAI embeddings failed: {(int)resp.StatusCode} {resp.ReasonPhrase}. Body: {body}");

        // Parse the embedding vector from the JSON response
        using var doc = JsonDocument.Parse(body);
        var emb = doc.RootElement
            .GetProperty("data")[0]
            .GetProperty("embedding")
            .EnumerateArray()
            .Select(x => x.GetSingle())
            .ToArray();

        return emb;
    }

    //  This method sends chat messages to Azure OpenAI and returns the final answer
    public async Task<string> CompleteAsync(IReadOnlyList<LlmChatMessage> messages, CancellationToken ct)
    {
        var endpoint = Require("AzureOpenAI:Endpoint").TrimEnd('/');
        var key = Require("AzureOpenAI:ApiKey");
        var deployment = Require("AzureOpenAI:ChatDeployment");
        var apiVersion = _config["AzureOpenAI:ApiVersion"] ?? "2024-02-15-preview";

        // Build the chat completions API URL
        var url = $"{endpoint}/openai/deployments/{deployment}/chat/completions?api-version={apiVersion}";

        //  Build chat request payload
        var payload = new
        {
            messages = messages.Select(m => new { role = m.Role, content = m.Content }),
            //  controls accuracy vs creativity
            temperature = 1,
            //  It defines the maximum number of tokens the model can generate, controls response length
            max_completion_tokens = 16000,
            stream = false
        };

        using var req = new HttpRequestMessage(HttpMethod.Post, url);
        req.Headers.Add("api-key", key);
        req.Content = new StringContent(JsonSerializer.Serialize(payload, _json.Options), Encoding.UTF8, "application/json");

        // Send request to Azure OpenAI
        var client = _http.CreateClient();
        using var resp = await client.SendAsync(req, ct);
        // Read response as text
        var body = await resp.Content.ReadAsStringAsync(ct);

        if (!resp.IsSuccessStatusCode)
            throw new InvalidOperationException($"Azure OpenAI chat failed: {(int)resp.StatusCode} {resp.ReasonPhrase}. Body: {body}");

        // Parse the final answer from JSON
        using var doc = JsonDocument.Parse(body);
        return ExtractChatContent(doc.RootElement);
    }

    //  This is the proper streaming method.
    public async IAsyncEnumerable<string> CompleteStreamingAsync(
        IReadOnlyList<LlmChatMessage> messages,
        [EnumeratorCancellation] CancellationToken ct)
    {
        var endpoint = Require("AzureOpenAI:Endpoint").TrimEnd('/');
        var key = Require("AzureOpenAI:ApiKey");
        var deployment = Require("AzureOpenAI:ChatDeployment");
        var apiVersion = _config["AzureOpenAI:ApiVersion"] ?? "2024-02-15-preview";

        // Build the chat completions API URL
        var url = $"{endpoint}/openai/deployments/{deployment}/chat/completions?api-version={apiVersion}";

        // Build streaming chat request payload
        var payload = new
        {
            messages = messages.Select(m => new { role = m.Role, content = m.Content }),
            temperature = 1,
            max_completion_tokens = 16000,
            stream = true
        };

        using var req = new HttpRequestMessage(HttpMethod.Post, url);
        // Add API key and JSON body
        req.Headers.Add("api-key", key);

        // Converts payload into a JSON string, wraps JSON into HTTP content and attaches it to the HTTP request 
        // in short send this data to the API as JSON
        req.Content = new StringContent(JsonSerializer.Serialize(payload, _json.Options), Encoding.UTF8, "application/json");

        var client = _http.CreateClient();

        // Start reading response as soon as headers arrive
        using var resp = await client.SendAsync(req, HttpCompletionOption.ResponseHeadersRead, ct);

        var stream = await resp.Content.ReadAsStreamAsync(ct);

        if (!resp.IsSuccessStatusCode)
        {
            using var errorReader = new StreamReader(stream);
            var errorBody = await errorReader.ReadToEndAsync(ct);
            throw new InvalidOperationException($"Azure OpenAI streaming chat failed: {(int)resp.StatusCode} {resp.ReasonPhrase}. Body: {errorBody}");
        }

        using var reader = new StreamReader(stream);

        // Read streaming response line by line
        while (!reader.EndOfStream)
        {
            ct.ThrowIfCancellationRequested();

            var line = await reader.ReadLineAsync();
            // Ignore empty lines
            if (string.IsNullOrWhiteSpace(line))
                continue;

            // Azure sends streaming data with "data:"
            if (!line.StartsWith("data:", StringComparison.Ordinal))
                continue;

            var data = line["data:".Length..].Trim();

            // Streaming is finished
            if (data == "[DONE]")
                yield break;

            JsonDocument? doc = null;

            //  This block is part of streaming response handling
            //  It takes one chunk of data from Azure OpenAI and extracts the text piece from it.
            try
            {
                doc = JsonDocument.Parse(data);

                if (!doc.RootElement.TryGetProperty("choices", out var choices) ||
                    choices.ValueKind != JsonValueKind.Array ||
                    choices.GetArrayLength() == 0)
                {
                    continue;
                }

                var firstChoice = choices[0];

                if (!firstChoice.TryGetProperty("delta", out var delta))
                    continue;

                if (!delta.TryGetProperty("content", out var contentElement))
                    continue;

                var text = ExtractText(contentElement);
                if (!string.IsNullOrWhiteSpace(text))
                    yield return text; // This lets frontend show the answer gradually, word by word 
            }
            finally
            {
                doc?.Dispose(); //Clean up memory
            }
        }
    }

    //  This method extracts the final text from a (normal chat response).
    private static string ExtractChatContent(JsonElement root)
    {
        //  Get choices array from Azure response
        if (!root.TryGetProperty("choices", out var choices) || choices.ValueKind != JsonValueKind.Array || choices.GetArrayLength() == 0)
            return string.Empty;

        var firstChoice = choices[0];

        // Normal chat response: choices[0].message.content
        if (firstChoice.TryGetProperty("message", out var message))
        {
            if (message.TryGetProperty("content", out var contentElement))
            {
                var extracted = ExtractText(contentElement);
                if (!string.IsNullOrWhiteSpace(extracted))
                    return extracted;
            }
            //   Fallback if the model refused the request
            if (message.TryGetProperty("refusal", out var refusalElement))
            {
                var refusal = ExtractText(refusalElement);
                if (!string.IsNullOrWhiteSpace(refusal))
                    return refusal;
            }
        }
        // Extra fallback for older/different response formats
        if (firstChoice.TryGetProperty("text", out var fallbackText))
        {
            var extracted = ExtractText(fallbackText);
            if (!string.IsNullOrWhiteSpace(extracted))
                return extracted;
        }

        return string.Empty;
    }

    //  This helper extracts text from different (JSON shapes).
    private static string ExtractText(JsonElement element)
    {
        // If JSON value is a normal string, return it
        if (element.ValueKind == JsonValueKind.String)
            return element.GetString() ?? string.Empty;

        // If JSON value is an array, extract text from each item
        if (element.ValueKind == JsonValueKind.Array)
        {
            var sb = new StringBuilder();
            foreach (var child in element.EnumerateArray())
                sb.Append(ExtractText(child));

            return sb.ToString();
        }

        if (element.ValueKind != JsonValueKind.Object)
            return string.Empty;

        if (element.TryGetProperty("text", out var textValue))
        {
            var text = ExtractText(textValue);
            if (!string.IsNullOrWhiteSpace(text))
                return text;
        }

        if (element.TryGetProperty("value", out var valueElement))
        {
            var value = ExtractText(valueElement);
            if (!string.IsNullOrWhiteSpace(value))
                return value;
        }

        if (element.TryGetProperty("content", out var contentElement))
        {
            var content = ExtractText(contentElement);
            if (!string.IsNullOrWhiteSpace(content))
                return content;
        }

        return string.Empty;
    }

    private string Require(string key)
        => _config[key] ?? throw new InvalidOperationException($"Missing configuration: {key}");

    private int GetInt(string key, int defaultValue)
       => int.TryParse(_config[key], out var value) ? value : defaultValue;

    private double GetDouble(string key, double defaultValue)
        => double.TryParse(_config[key], out var value) ? value : defaultValue;
}