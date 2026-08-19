using AiAssistant.Api.Infrastructure.Search;
using AiAssistant.Api.Utils;

namespace AiAssistant.Api.Services;

// Service responsible for retrieving relevant document chunks from Azure AI Search.
public sealed class RetrievalService
{
    private readonly IAzureSearchClient _search;
    private readonly IConfiguration _config;
    private readonly SharePointUrlMapper _sharePointUrlMapper;

    public RetrievalService(IAzureSearchClient search, IConfiguration config, SharePointUrlMapper sharePointUrlMapper)
    {
        _search = search;
        _config = config;
        _sharePointUrlMapper = sharePointUrlMapper;
    }

    // Retrieves the most relevant chunks for a user query.
    public async Task<IReadOnlyList<RetrievedChunk>> RetrieveAsync(string query, int topK, CancellationToken ct)
    {
        var contentField = _config["AzureSearch:ContentField"] ?? "content_text";
        var titleField = _config["AzureSearch:TitleField"] ?? "document_title";
        var documentIdField = _config["AzureSearch:DocumentIdField"] ?? "content_id";

        var urlFieldsRaw = _config["AzureSearch:UrlField"] ?? "sharepoint_url,content_path";
        var urlFields = urlFieldsRaw
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Where(x => !string.IsNullOrWhiteSpace(x))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();

        var chunks = await _search.SearchAsync(query, topK, contentField, titleField, urlFields, documentIdField, ct);

        return chunks
            .Select(c => new RetrievedChunk(
                c.Content,
                c.Title,
                _sharePointUrlMapper.ToSharePointUrl(c.Url),
                c.DocumentId))
            .ToList();
    }
}