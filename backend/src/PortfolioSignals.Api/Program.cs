using System.Text.Json.Serialization;
using Azure.Monitor.OpenTelemetry.AspNetCore;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc.Controllers;
using Microsoft.OpenApi;
using PortfolioSignals.Api.Infrastructure;
using PortfolioSignals.Application;
using PortfolioSignals.Infrastructure;

var builder = WebApplication.CreateBuilder(args);

var authSettings = builder.Configuration.GetSection(AuthenticationSettings.SectionName).Get<AuthenticationSettings>() ?? new AuthenticationSettings();
var developmentAuth = string.Equals(authSettings.Mode, "Development", StringComparison.OrdinalIgnoreCase);
if (developmentAuth && !builder.Environment.IsDevelopment())
{
    throw new InvalidOperationException("Authentication:Mode=Development is only allowed in the Development environment.");
}

if (!developmentAuth && (string.IsNullOrWhiteSpace(authSettings.Jwt.Authority) || string.IsNullOrWhiteSpace(authSettings.Jwt.Audience)))
{
    throw new InvalidOperationException("Authentication:Jwt:Authority and Authentication:Jwt:Audience must be configured.");
}

builder.Services.AddApplication();
builder.Services.AddInfrastructure(builder.Configuration);

builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ICurrentUser, CurrentUser>();
builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<ApiExceptionHandler>();

builder.Services.AddControllers().AddJsonOptions(options =>
{
    options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
    options.JsonSerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull;
});
builder.Services.AddOpenApi(options =>
{
    options.AddDocumentTransformer((document, _, _) =>
    {
        document.Info.Title = "Portfolio Signals API";
        document.Info.Version = "v1";

        var schemeName = developmentAuth ? "DevUser" : "Bearer";
        IOpenApiSecurityScheme scheme = developmentAuth
            ? new OpenApiSecurityScheme
            {
                Type = SecuritySchemeType.ApiKey,
                In = ParameterLocation.Header,
                Name = DevelopmentAuthenticationHandler.HeaderName,
                Description = "Development only: any user name, for example 'alice'.",
            }
            : new OpenApiSecurityScheme
            {
                Type = SecuritySchemeType.Http,
                Scheme = "bearer",
                BearerFormat = "JWT",
            };

        document.Components ??= new OpenApiComponents();
        document.Components.SecuritySchemes ??= new Dictionary<string, IOpenApiSecurityScheme>();
        document.Components.SecuritySchemes[schemeName] = scheme;
        document.Security ??= [];
        document.Security.Add(new OpenApiSecurityRequirement
        {
            [new OpenApiSecuritySchemeReference(schemeName, document)] = [],
        });
        return Task.CompletedTask;
    });

    // Stable "Controller_Action" operation ids let NSwag generate one client class per controller.
    options.AddOperationTransformer((operation, context, _) =>
    {
        if (context.Description.ActionDescriptor is ControllerActionDescriptor action)
        {
            operation.OperationId = $"{action.ControllerName}_{action.ActionName}";
        }

        return Task.CompletedTask;
    });
});

if (developmentAuth)
{
    builder.Services.AddAuthentication(DevelopmentAuthenticationHandler.SchemeName)
        .AddScheme<AuthenticationSchemeOptions, DevelopmentAuthenticationHandler>(DevelopmentAuthenticationHandler.SchemeName, _ => { });
}
else
{
    builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
        .AddJwtBearer(options =>
        {
            options.Authority = authSettings.Jwt.Authority;
            options.Audience = authSettings.Jwt.Audience;
            options.MapInboundClaims = false;
        });
}

builder.Services.AddAuthorizationBuilder()
    .SetFallbackPolicy(new AuthorizationPolicyBuilder().RequireAuthenticatedUser().Build());

var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [];
builder.Services.AddCors(options => options.AddDefaultPolicy(policy =>
{
    if (allowedOrigins.Length > 0)
    {
        policy.WithOrigins(allowedOrigins).AllowAnyHeader().AllowAnyMethod();
    }
}));

builder.Services.AddHealthChecks();

if (!string.IsNullOrWhiteSpace(builder.Configuration["APPLICATIONINSIGHTS_CONNECTION_STRING"]))
{
    builder.Services.AddOpenTelemetry().UseAzureMonitor();
}

var app = builder.Build();

app.UseExceptionHandler();
app.UseStatusCodePages();
app.UseHttpsRedirection();
app.UseCors();
app.UseSwaggerUI(options =>
{
    options.SwaggerEndpoint("/openapi/v1.json", "Portfolio Signals API v1");
    options.RoutePrefix = "swagger";
});
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapHealthChecks("/health/live").AllowAnonymous();
app.MapOpenApi().AllowAnonymous();

app.Run();

public partial class Program;
