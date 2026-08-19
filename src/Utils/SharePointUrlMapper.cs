namespace AiAssistant.Api.Utils;

/*
 SharePointUrlMapper is a utility class responsible for converting stored document URLs into usable SharePoint links.
 many source documents come from Azure Blob Storage
However, users should ideally open the original document directly in SharePoint, not Blob Storage.
This class maps Blob Storage URLs back into SharePoint document library URLs.

The class handles 3 scenarios:

    1. The URL is empty → returns null
    2. The URL is already a SharePoint URL → returns it unchanged
    3. The URL is a Blob Storage URL → converts it into a SharePoint URL

 All tenant-specific values (blob prefix, SharePoint host/paths, view id) come from
 configuration (see the "SharePoint" section in appsettings.json) instead of being
 hardcoded here. If they aren't configured, the mapper is a no-op and returns the
 raw URL unchanged.
 */

public sealed class SharePointUrlMapper
{
    private readonly string? _blobPrefix;
    private readonly string? _sharePointHost;
    private readonly string? _sharePointLibraryPage;
    private readonly string? _sharePointRoot;
    private readonly string? _viewId;

    public SharePointUrlMapper(IConfiguration config)
    {
        _blobPrefix = config["SharePoint:BlobPrefix"];
        _sharePointHost = config["SharePoint:Host"];
        _sharePointLibraryPage = config["SharePoint:LibraryPage"];
        _sharePointRoot = config["SharePoint:RootPath"];
        _viewId = config["SharePoint:ViewId"];
    }

    // Converts a raw URL into a SharePoint URL when possible.
    public string? ToSharePointUrl(string? rawUrl)
    {
        if (string.IsNullOrWhiteSpace(rawUrl))
            return null;

        // If SharePoint mapping isn't configured, leave the URL unchanged.
        if (string.IsNullOrWhiteSpace(_sharePointHost) ||
            string.IsNullOrWhiteSpace(_blobPrefix) ||
            string.IsNullOrWhiteSpace(_sharePointLibraryPage) ||
            string.IsNullOrWhiteSpace(_sharePointRoot) ||
            string.IsNullOrWhiteSpace(_viewId))
            return rawUrl;

        // If the URL is already a SharePoint URL, return it unchanged.
        if (rawUrl.StartsWith(_sharePointHost, StringComparison.OrdinalIgnoreCase))
            return rawUrl;

        // If the URL is not from the expected Blob Storage container, return it unchanged.
        if (!rawUrl.StartsWith(_blobPrefix, StringComparison.OrdinalIgnoreCase))
            return rawUrl;

        // Remove the Blob prefix to get the relative file path.
        var relativePath = rawUrl.Substring(_blobPrefix.Length);
        // Decode URL-encoded characters and remove leading slashes.
        relativePath = Uri.UnescapeDataString(relativePath).TrimStart('/');

        // Build the full SharePoint file path.
        var fullPath = $"{_sharePointRoot}/{relativePath}".Replace("\\", "/");
        var lastSlash = fullPath.LastIndexOf('/');
        // Extract the parent folder path.
        var parentPath = lastSlash > 0 ? fullPath[..lastSlash] : _sharePointRoot;

        // Encode values so they are safe to use inside a URL query string.
        var encodedViewId = Uri.EscapeDataString(_viewId);
        var encodedId = Uri.EscapeDataString(fullPath);
        var encodedParent = Uri.EscapeDataString(parentPath);

        // Build and return the final SharePoint URL.
        return $"{_sharePointHost}{_sharePointLibraryPage}?viewid={encodedViewId}&id={encodedId}&parent={encodedParent}";
    }
}
