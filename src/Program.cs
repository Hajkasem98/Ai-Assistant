using AiAssistant.Api.Utils;
using AiAssistant.Api.Infrastructure.Llm;
using AiAssistant.Api.Infrastructure.Search;
using AiAssistant.Api.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
var corsPolicyName = "Frontend";

// Local dev origins are always allowed; production origins (e.g. the deployed
// Static Web App URL) come from configuration via "Cors:AllowedOrigins".
var localOrigins = new[] { "http://localhost:5173", "http://localhost:5174" };
var configuredOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? Array.Empty<string>();
var allowedOrigins = localOrigins.Concat(configuredOrigins).Distinct().ToArray();

builder.Services.AddCors(options =>
{
    options.AddPolicy(corsPolicyName, policy =>
    {
        policy.WithOrigins(allowedOrigins)
              .AllowAnyHeader()
              .AllowAnyMethod()
              .WithExposedHeaders("*"); // SMDev addition for tts
    });
});
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// App services
builder.Services.AddSingleton<SystemTextJson>();
builder.Services.AddHttpClient();

builder.Services.AddSingleton<IChatCompletionClient, AzureOpenAiRestClient>();
builder.Services.AddSingleton<IAzureSearchClient, AzureSearchRestClient>();

builder.Services.AddSingleton<SharePointUrlMapper>();
builder.Services.AddSingleton<PromptBuilder>();
builder.Services.AddSingleton<RetrievalService>();
builder.Services.AddSingleton<ChatService>();

var app = builder.Build();


app.UseSwagger();
app.UseSwaggerUI();

app.UseHttpsRedirection();

app.UseCors(corsPolicyName);

app.MapControllers();

app.Run();