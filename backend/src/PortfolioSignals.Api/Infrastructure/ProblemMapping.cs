using FluentValidation;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using PortfolioSignals.Application.Common;
using PortfolioSignals.Domain.Common;

namespace PortfolioSignals.Api.Infrastructure;

internal static class ResultExtensions
{
    /// <summary>Maps an application <see cref="Error"/> to an RFC 9457 problem response.</summary>
    public static IActionResult ToProblem(this ControllerBase controller, Error error)
    {
        var status = error.Type switch
        {
            ErrorType.Validation => StatusCodes.Status400BadRequest,
            ErrorType.NotFound => StatusCodes.Status404NotFound,
            ErrorType.Conflict => StatusCodes.Status409Conflict,
            ErrorType.TooManyRequests => StatusCodes.Status429TooManyRequests,
            _ => StatusCodes.Status500InternalServerError,
        };

        return controller.Problem(title: error.Message, statusCode: status, extensions: new Dictionary<string, object?> { ["code"] = error.Code });
    }

    public static IActionResult ToResponse<T>(this ControllerBase controller, Result<T> result, Func<T, IActionResult>? onSuccess = null)
        => result.IsSuccess
            ? onSuccess is null ? controller.Ok(result.Value) : onSuccess(result.Value)
            : controller.ToProblem(result.Error!);

    public static IActionResult ToResponse(this ControllerBase controller, Result result, Func<IActionResult>? onSuccess = null)
        => result.IsSuccess
            ? onSuccess is null ? controller.NoContent() : onSuccess()
            : controller.ToProblem(result.Error!);
}

/// <summary>Turns validation and domain-rule exceptions into documented problem responses; everything else falls through to the default 500 handler.</summary>
internal sealed class ApiExceptionHandler(IProblemDetailsService problemDetails) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext httpContext, Exception exception, CancellationToken cancellationToken)
    {
        ProblemDetails problem;
        switch (exception)
        {
            case ValidationException validation:
                problem = new ValidationProblemDetails(
                    validation.Errors
                        .GroupBy(e => string.IsNullOrEmpty(e.PropertyName) ? "request" : e.PropertyName)
                        .ToDictionary(g => g.Key, g => g.Select(e => e.ErrorMessage).ToArray()))
                {
                    Status = StatusCodes.Status400BadRequest,
                    Title = "One or more validation errors occurred.",
                };
                break;
            case DomainException domain:
                problem = new ProblemDetails { Status = StatusCodes.Status422UnprocessableEntity, Title = domain.Message };
                break;
            default:
                return false;
        }

        httpContext.Response.StatusCode = problem.Status!.Value;
        return await problemDetails.TryWriteAsync(new ProblemDetailsContext { HttpContext = httpContext, ProblemDetails = problem, Exception = exception });
    }
}
