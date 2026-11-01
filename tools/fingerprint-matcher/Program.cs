using System.Text.Json;
using DPUruNet;

const int ProbabilityOne = 0x7fffffff;
const int ThresholdScore = ProbabilityOne / 100000;

try
{
    string input = Console.In.ReadToEnd();
    MatchRequest? request = JsonSerializer.Deserialize<MatchRequest>(input, new JsonSerializerOptions
    {
        PropertyNameCaseInsensitive = true
    });

    if (request is null)
    {
        Write(new MatchResponse(false, null, null, "Solicitud invalida"));
        return;
    }

    if (request.Mode == "enroll")
    {
        if (request.EnrollmentTemplates is null || request.EnrollmentTemplates.Count < 2)
        {
            Write(new MatchResponse(false, null, null, "Se necesitan al menos dos muestras para enrolar"));
            return;
        }

        List<Fmd> preEnrollmentFmds = request.EnrollmentTemplates.Select(ReadPreEnrollmentFmd).ToList();
        DataResult<Fmd> enrollment = Enrollment.CreateEnrollmentFmd(
            Constants.Formats.Fmd.DP_REGISTRATION,
            preEnrollmentFmds
        );

        if (enrollment.ResultCode != Constants.ResultCode.DP_SUCCESS)
        {
            Write(new MatchResponse(false, null, null, $"No se pudo crear enrolamiento: {enrollment.ResultCode}"));
            return;
        }

        string xml = Fmd.SerializeXml(enrollment.Data);
        string encodedXml = Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes(xml));
        Write(new MatchResponse(true, null, null, null, null, $"digitalpersona-fmd-xml:{encodedXml}"));
        return;
    }

    if (string.IsNullOrWhiteSpace(request.ProbeTemplate))
    {
        Write(new MatchResponse(false, null, null, "Solicitud invalida"));
        return;
    }

    List<Fmd> probeVariants = ReadFmdVariants(request.ProbeTemplate);
    MatchCandidate? best = null;
    MatchCandidate? bestAttempt = null;

    foreach (MatchCandidate candidate in request.Candidates ?? [])
    {
        if (string.IsNullOrWhiteSpace(candidate.Template))
        {
            continue;
        }

        try
        {
            List<Fmd> enrolledVariants = ReadFmdVariants(candidate.Template);
            foreach (Fmd probe in probeVariants)
            {
                foreach (Fmd enrolled in enrolledVariants)
                {
                    CompareResult result;
                    try
                    {
                        result = Comparison.Compare(probe, 0, enrolled, 0);
                    }
                    catch
                    {
                        continue;
                    }

                    if (result.ResultCode != Constants.ResultCode.DP_SUCCESS)
                    {
                        continue;
                    }

                    if (bestAttempt is null || result.Score < bestAttempt.Score)
                    {
                        bestAttempt = candidate with { Score = result.Score };
                    }

                    if (result.Score < ThresholdScore && (best is null || result.Score < best.Score))
                    {
                        best = candidate with { Score = result.Score };
                    }
                }
            }
        }
        catch
        {
            // Ignora plantillas danadas y sigue evaluando el resto de la galeria.
        }
    }

    Write(best is null
        ? new MatchResponse(false, bestAttempt?.EmployeeId, bestAttempt?.FingerprintId, "Sin coincidencias", bestAttempt?.Score)
        : new MatchResponse(true, best.EmployeeId, best.FingerprintId, null, best.Score));
}
catch (Exception ex)
{
    Write(new MatchResponse(false, null, null, ex.Message));
}

static Fmd ReadPreEnrollmentFmd(string storedTemplate)
{
    string base64 = storedTemplate.Replace("digitalpersona-intermediate:", "", StringComparison.OrdinalIgnoreCase);
    byte[] bytes = Convert.FromBase64String(base64);
    DataResult<Fmd> imported = Importer.ImportFmd(
        bytes,
        Constants.Formats.Fmd.DP_PRE_REGISTRATION,
        Constants.Formats.Fmd.DP_PRE_REGISTRATION
    );

    if (imported.ResultCode == Constants.ResultCode.DP_SUCCESS)
    {
        return imported.Data;
    }

    throw new InvalidOperationException(imported.ResultCode.ToString());
}

static List<Fmd> ReadFmdVariants(string storedTemplate)
{
    if (storedTemplate.StartsWith("digitalpersona-fmd-xml:", StringComparison.OrdinalIgnoreCase))
    {
        string encodedXml = storedTemplate.Replace("digitalpersona-fmd-xml:", "", StringComparison.OrdinalIgnoreCase);
        string xml = System.Text.Encoding.UTF8.GetString(Convert.FromBase64String(encodedXml));
        return [Fmd.DeserializeXml(xml)];
    }

    string base64 = storedTemplate.Replace("digitalpersona-intermediate:", "", StringComparison.OrdinalIgnoreCase);
    byte[] bytes = Convert.FromBase64String(base64);

    Constants.Formats.Fmd[] formats =
    [
        Constants.Formats.Fmd.DP_PRE_REGISTRATION,
        Constants.Formats.Fmd.DP_REGISTRATION,
        Constants.Formats.Fmd.DP_VERIFICATION,
        Constants.Formats.Fmd.ANSI,
        Constants.Formats.Fmd.ISO
    ];

    List<Fmd> variants = [];
    foreach (Constants.Formats.Fmd inputFormat in formats)
    {
        foreach (Constants.Formats.Fmd outputFormat in formats)
        {
            DataResult<Fmd> imported;
            try
            {
                imported = Importer.ImportFmd(bytes, inputFormat, outputFormat);
            }
            catch
            {
                continue;
            }

            if (imported.ResultCode == Constants.ResultCode.DP_SUCCESS)
            {
                variants.Add(imported.Data);
            }
        }
    }

    return variants;
}

static void Write(MatchResponse response)
{
    Console.Write(JsonSerializer.Serialize(response, new JsonSerializerOptions
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    }));
}

public sealed record MatchRequest(
    string? ProbeTemplate,
    List<MatchCandidate>? Candidates,
    string? Mode = null,
    List<string>? EnrollmentTemplates = null
);

public sealed record MatchCandidate(
    int FingerprintId,
    int EmployeeId,
    string Template,
    int? Score = null
);

public sealed record MatchResponse(
    bool Matched,
    int? EmployeeId,
    int? FingerprintId,
    string? Error,
    int? Score = null,
    string? EnrollmentTemplate = null
);
