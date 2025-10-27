import { buildWorkbook, fetchCompanies, fetchToken, OpenApiError } from "@/lib/openapi";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

const bodySchema = z.object({
  username: z.string().min(1),
  apiKey: z.string().min(1),
  environment: z.enum(["production", "test"]).default("production"),
  province: z
    .string()
    .min(2)
    .max(2)
    .transform((value) => value.toUpperCase()),
  atecoCode: z.string().min(1),
  pageSize: z.coerce.number().int().positive().max(1000).default(200),
  startPage: z.coerce.number().int().min(0).default(0),
  maxPages: z.coerce.number().int().min(1).max(50).default(1),
  extraFilters: z
    .record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]))
    .optional()
    .default({}),
});

export async function POST(request: Request) {
  try {
    const raw = await request.json();
    const body = bodySchema.parse(raw);

    const normalizedAteco = normalizeAteco(body.atecoCode);
    const filters: Record<string, string> = {
      province: body.province,
      atecoCode: normalizedAteco,
      ateco: normalizedAteco,
      ...convertExtraFilters(body.extraFilters),
    };

    const token = await fetchToken({
      username: body.username,
      apiKey: body.apiKey,
      environment: body.environment,
    });

    const { records, raw: rawPayload } = await fetchCompanies({
      token: token.token,
      environment: body.environment,
      filters,
      maxPages: body.maxPages,
      pageSize: body.pageSize,
      startPage: body.startPage,
    });

    if (!records.length) {
      return NextResponse.json(
        {
          ok: true,
          message: "Nessuna azienda trovata per i parametri forniti.",
          payload: rawPayload,
        },
        { status: 200 },
      );
    }

    const workbook = await buildWorkbook(records);
    const filename = buildFilename(body.province, normalizedAteco);

    return new NextResponse(workbook, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(workbook.length),
        "X-Total-Records": String(records.length),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ ok: false, error: error.flatten() }, { status: 400 });
    }

    if (error instanceof OpenApiError) {
      return NextResponse.json(
        {
          ok: false,
          error: error.message,
          details: error.cause,
          status: error.status ?? 500,
        },
        { status: 502 },
      );
    }

    return NextResponse.json(
      {
        ok: false,
        error: "Unexpected error while building export.",
      },
      { status: 500 },
    );
  }
}

function normalizeAteco(code: string) {
  const cleaned = code.replace(/[^\d]/g, "");
  if (cleaned.length <= 2) {
    return cleaned;
  }
  if (cleaned.length === 3) {
    return `${cleaned.slice(0, 2)}.${cleaned.slice(2)}`;
  }
  return `${cleaned.slice(0, 2)}.${cleaned.slice(2, 4)}`;
}

function buildFilename(province: string, ateco: string) {
  const safeProvince = province.toUpperCase();
  const safeAteco = ateco.replace(/\./g, "");
  const timestamp = new Date().toISOString().split("T")[0];
  return `aziende_${safeProvince}_${safeAteco}_${timestamp}.xlsx`;
}

function convertExtraFilters(
  extra: Record<string, string | number | boolean | null> | undefined,
) {
  if (!extra) return {};
  return Object.entries(extra).reduce<Record<string, string>>((acc, [key, value]) => {
    if (value === null || value === undefined) {
      return acc;
    }
    acc[key] = String(value);
    return acc;
  }, {});
}
