using AiAssistant.Api.Utils;
using AiAssistant.Api.Infrastructure.Llm;
using AiAssistant.Api.Infrastructure.Search;
using AiAssistant.Api.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
var corsPolicyName = "Frontend";

builder.Services.AddCors(options =>
{
    options.AddPolicy(corsPolicyName, policy =>
    {
        policy.WithOrigins("http://localhost:5173", "http://localhost:5174", "https://black-mud-04ce3db03.6.azurestaticapps.net")
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