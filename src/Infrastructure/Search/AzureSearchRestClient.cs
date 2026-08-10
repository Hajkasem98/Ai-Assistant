using AiAssistant.Api.Services;
using AiAssistant.Api.Utils;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

namespace AiAssistant.Api.Infrastructure.Search;

/*  this the class that talks directly to Azure AI Search using REST API.
    The class tries search in this order:
    1. Semantic search
        Best quality search. Uses Azure AI Search "semantic ranking".
    2. Simple search fallback
        If semantic search gives no result, it tries normal "keyword search".
    3. Wildcard fallback
        If nothing is found, it returns general documents using "*"
//  */

public sealed class AzureSearchRestClient : IAzureSearchClient
{
    private readonly IHttpClientFactory _http;
    private readonly IConfiguration _config;
    private readonly SystemTextJson _json;

    public AzureSearchRestClient(IHttpClientFactory http, IConfiguration config, SystemTextJson json)
    {
        _http = http;
        _config = config;
        _json = json;
    }

    // This method used to search Azure AI Search. It returns a list of RetrievedChunk objects.
    public async Task<IReadOnlyList<RetrievedChunk>> SearchAsync(
        string queryText,
        int topK,
        string contentField,
        string titleField,
        IReadOnlyList<string> urlFields,
        string documentIdField,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(queryText))
            return Array.Empty<RetrievedChunk>();

        var endpointRaw = Require("AzureSearch:Endpoint");
        var apiKey = Require("AzureSearch:ApiKey");
        var indexName = Require("AzureSearch:IndexName");

        var apiVersion = (_config["AzureSearch:ApiVersion"] ?? "2023-11-01").Trim();
        if (string.IsNullOrWhiteSpace(apiVersion))
            apiVersion = "2023-11-01";

        /* Read semantic configuration name from config.
            If it is missing, use the default semantic configuration name.*/
        var semanticConfig =
            _config["AzureSearch:SemanticConfiguration"]
            ?? "multimodal-rag-index-ai-assistent-semantic-configuration";

        // Clean endpoint by removing spaces and slash.
        var endpoint = endpointRaw.Trim().TrimEnd('/');
        // Validate that the endpoint looks like an Azure Search endpoint.
        if (!endpoint.Contains(".search.windows.net", StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException($"AzureSearch:Endpoint must be https://<name>.search.windows.net but was: '{endpointRaw}'");

        // Create a UriBuilder so we can safely build the final search URL.
        var ub = new UriBuilder(endpoint);
        // Get current path from endpoint
        var basePath = (ub.Path ?? string.Empty).TrimEnd('/');
        // Build REST API path
        ub.Path = $"{basePath}/indexes/{indexName}/docs/search";
        ub.Query = $"api-version={Uri.EscapeDataString(apiVersion)}";
        var url = ub.Uri.ToString();

        // Clean the list of URL fields
        var effectiveUrlFields = (urlFields ?? Array.Empty<string>())
            .Where(f => !string.IsNullOrWhiteSpace(f))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();

        // Build the list of fields we want Azure Search to return.
        var selectFields = new[] { contentField, titleField, documentIdField }
            .Concat(effectiveUrlFields)
            .Where(f => !string.IsNullOrWhiteSpace(f))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();

        // First attempt: "semantic search". This gives better ranking and extractive captions/answers.
        var semanticPayload = new
        {
            search = queryText,
            top = topK,
            queryType = "semantic",
            semanticConfiguration = semanticConfig,
            // Ask Azure Search to extract relevant captions without highlights.
            captions = "extractive|highlight-false",
            // Ask Azure Search to extract up to 3 answers.
            answers = "extractive|count-3",
            select = string.Join(',', selectFields)
        };

        // Send semantic search request and parse the response.
        var semanticResults = await SendAndParseAsync(
            url, apiKey, semanticPayload, contentField, titleField, effectiveUrlFields, documentIdField, ct);
        if (semanticResults.Count > 0)
            return semanticResults;

        // Second attempt: "normal/simple search". This is used if semantic search gives no useful result.
        var simplePayload = new
        {
            search = queryText,
            top = topK,
            select = string.Join(',', selectFields)
        };

        var simpleResults = await SendAndParseAsync(
            url, apiKey, simplePayload, contentField, titleField, effectiveUrlFields, documentIdField, ct);
        if (simpleResults.Count > 0)
            return simpleResults;

        // Third attempt: wildcard search. This returns general documents if the query finds nothing.
        var wildcardPayload = new
        {
            search = "*",
            top = topK,
            select = string.Join(',', selectFields)
        };

        return await SendAndParseAsync(
            url, apiKey, wildcardPayload, contentField, titleField, effectiveUrlFields, documentIdField, ct);
    }

    //  helper method, Sends one HTTP request to Azure Search and converts the JSON response
    // into a list of RetrievedChunk objects.
    private async Task<List<RetrievedChunk>> SendAndParseAsync(
        string url,
        string apiKey,
        object payload,
        string contentField,
        string titleField,
        IReadOnlyList<string> urlFields,
        string documentIdField,
        CancellationToken ct)
    {
        // Create a POST request to Azure Search.
        using var req = new HttpRequestMessage(HttpMethod.Post, url);
        // Add Azure Search API key header.
        req.Headers.TryAddWithoutValidation("api-key", apiKey);
        // Tell Azure Search that we expect JSON response.
        req.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
        // Serialize payload object to JSON and put it into request body.
        req.Content = new StringContent(
            JsonSerializer.Serialize(payload, _json.Options),
            Encoding.UTF8,
            "application/json");

        var client = _http.CreateClient();
        using var resp = await client.SendAsync(req, ct);
        var body = await resp.Content.ReadAsStringAsync(ct);

        if (!resp.IsSuccessStatusCode)
            throw new InvalidOperationException(
                $"Azure AI Search query failed. URL: {url}. Status: {(int)resp.StatusCode} {resp.ReasonPhrase}. Body: {body}");

        using var doc = JsonDocument.Parse(body);
        if (!doc.RootElement.TryGetProperty("value", out var valueEl) || valueEl.ValueKind != JsonValueKind.Array)
            return new List<RetrievedChunk>();

        var results = new List<RetrievedChunk>();

        foreach (var item in valueEl.EnumerateArray())
        {
            var content = TryGetString(item, contentField) ?? string.Empty;
            if (string.IsNullOrWhiteSpace(content))
                continue;

            var title = TryGetString(item, titleField);
            var documentId = TryGetString(item, documentIdField);

            string? urlVal = null;
            foreach (var f in urlFields)
            {
                var val = TryGetString(item, f);
                if (!string.IsNullOrWhiteSpace(val))
                {
                    urlVal = val;
                    break;
                }
            }

            results.Add(new RetrievedChunk(content, title, urlVal, documentId));
        }

        return results;
    }
    // Helper method for safely reading a field from a JSON object.
    private static string? TryGetString(JsonElement obj, string field)
    {
        if (string.IsNullOrWhiteSpace(field)) return null;
        if (!obj.TryGetProperty(field, out var el)) return null;

        return el.ValueKind switch
        {
            JsonValueKind.String => el.GetString(),
            JsonValueKind.Number => el.GetRawText(),
            JsonValueKind.True => "true",
            JsonValueKind.False => "false",
            JsonValueKind.Null => null,
            _ => el.ToString()
        };
    }
    // Helper method for reading required configuration values.
    private string Require(string key)
        => _config[key] ?? throw new InvalidOperationException($"Missing configuration: {key}");
}