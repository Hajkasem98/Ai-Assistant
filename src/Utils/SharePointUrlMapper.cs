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
 */

public static class SharePointUrlMapper
{
    //This is the expected prefix for Azure Blob Storage URLs. The mapper uses this to determine whether the URL should be converted.
    private const string BlobPrefix = "https://oslometaiassistent.blob.core.windows.net/dev/mds/";
    // The root SharePoint domain.
    private const string SharePointHost = "https://mesta.sharepoint.com";
    private const string SharePointLibraryPage =
        "/sites/OsloMet-Mesta-AIAssistent/Delte%20dokumenter/Forms/AllItems.aspx";
    //  Root folder in SharePoint where the original documents exist.
    private const string SharePointRoot =
        "/sites/OsloMet-Mesta-AIAssistent/Delte dokumenter/Generelt/AI Assistent prosjekt/Data";
    // SharePoint view identifier. Used to open the correct SharePoint library view.
    private const string ViewId = "1b40ae31-0c5e-4c08-9e2e-cb90cfa8103f";

    // This method Converts a raw URL into a SharePoint URL when possible.
    public static string? ToSharePointUrl(string? rawUrl)
    {
        if (string.IsNullOrWhiteSpace(rawUrl))
            return null;

        // If the URL is already a SharePoint URL, return it unchanged.
        if (rawUrl.StartsWith("https://mesta.sharepoint.com/", StringComparison.OrdinalIgnoreCase))
            return rawUrl;

        // If the URL is not from the expected Blob Storage container, return it unchanged.
        if (!rawUrl.StartsWith(BlobPrefix, StringComparison.OrdinalIgnoreCase))
            return rawUrl;

        // Remove the Blob prefix to get the relative file path.
        var relativePath = rawUrl.Substring(BlobPrefix.Length);
        // Decode URL-encoded characters and remove leading slashes.
        relativePath = Uri.UnescapeDataString(relativePath).TrimStart('/');

        // Build the full SharePoint file path.
        var fullPath = $"{SharePointRoot}/{relativePath}".Replace("\\", "/");
        var lastSlash = fullPath.LastIndexOf('/');
        // Extract the parent folder path.
        var parentPath = lastSlash > 0 ? fullPath[..lastSlash] : SharePointRoot;

        // Encode values so they are safe to use inside a URL query string.
        var encodedViewId = Uri.EscapeDataString(ViewId);
        var encodedId = Uri.EscapeDataString(fullPath);
        var encodedParent = Uri.EscapeDataString(parentPath);

        // Build and return the final SharePoint URL.
        return $"{SharePointHost}{SharePointLibraryPage}?viewid={encodedViewId}&id={encodedId}&parent={encodedParent}";
    }
}