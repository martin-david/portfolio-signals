using FluentValidation;
using FreeMediator;
using Microsoft.Extensions.DependencyInjection;
using PortfolioSignals.Application.Analysis;
using PortfolioSignals.Application.Common;

namespace PortfolioSignals.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        var assembly = typeof(DependencyInjection).Assembly;

        services.AddMediator(configuration =>
        {
            configuration.RegisterServicesFromAssembly(assembly);
            configuration.AddOpenBehavior(typeof(ValidationBehavior<,>));
        });
        services.AddValidatorsFromAssembly(assembly, includeInternalTypes: true);
        services.AddScoped<AnalysisLoader>();
        services.AddSingleton(TimeProvider.System);

        return services;
    }
}
