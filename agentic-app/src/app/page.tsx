"use client";

import { FormEvent, useMemo, useState } from "react";

type Environment = "production" | "test";

interface MessageState {
  type: "success" | "error" | "info";
  text: string;
  details?: string;
}

interface FormState {
  username: string;
  apiKey: string;
  environment: Environment;
  province: string;
  atecoCode: string;
  pageSize: number;
  startPage: number;
  maxPages: number;
  extraFilters: string;
}

const defaultFilters = JSON.stringify(
  {
    status: "ATTIVA",
  },
  null,
  2,
);

export default function Home() {
  const [form, setForm] = useState<FormState>({
    username: "",
    apiKey: "",
    environment: "test",
    province: "VR",
    atecoCode: "1071",
    pageSize: 200,
    startPage: 0,
    maxPages: 1,
    extraFilters: defaultFilters,
  });

  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<MessageState | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [filename, setFilename] = useState<string | null>(null);
  const [recordCount, setRecordCount] = useState<number | null>(null);

  const filtersAreValid = useMemo(() => {
    if (!form.extraFilters.trim()) return true;
    try {
      JSON.parse(form.extraFilters);
      return true;
    } catch {
      return false;
    }
  }, [form.extraFilters]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    setRecordCount(null);

    if (downloadUrl) {
      URL.revokeObjectURL(downloadUrl);
      setDownloadUrl(null);
    }

    let extraFilters: Record<string, string | number | boolean | null> = {};
    if (form.extraFilters.trim()) {
      try {
        extraFilters = JSON.parse(form.extraFilters);
      } catch (error) {
        setMessage({
          type: "error",
          text: "Il JSON dei filtri avanzati non è valido.",
          details: (error as Error).message,
        });
        return;
      }
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/export", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...form,
          extraFilters,
        }),
      });

      const contentType = response.headers.get("content-type") ?? "";
      const disposition = response.headers.get("content-disposition");
      const total = response.headers.get("x-total-records");

      if (total) {
        setRecordCount(Number(total));
      }

      if (
        response.ok &&
        contentType.includes("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
      ) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        setDownloadUrl(url);
        const name = extractFilename(disposition) ?? buildFallbackFilename(form);
        setFilename(name);
        triggerDownload(url, name);
        setMessage({
          type: "success",
          text: "File generato correttamente. Il download dovrebbe partire in automatico.",
        });
        return;
      }

      if (contentType.includes("application/json")) {
        const payload = await response.json();
        if (payload?.ok && payload?.message && !downloadUrl) {
          setMessage({
            type: payload.ok ? "info" : "error",
            text: payload.message,
          });
          return;
        }
        setMessage({
          type: payload?.ok ? "info" : "error",
          text: payload?.error ?? payload?.message ?? "Impossibile completare la richiesta.",
          details: payload?.details ? JSON.stringify(payload.details) : undefined,
        });
        return;
      }

      setMessage({
        type: "error",
        text: "Il server ha restituito una risposta inattesa.",
      });
    } catch (error) {
      setMessage({
        type: "error",
        text: "Errore di rete durante la richiesta.",
        details: (error as Error).message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 py-12 md:px-10 lg:px-16">
        <header className="mb-10">
          <div className="mb-2 inline-flex rounded-full border border-slate-700/80 bg-slate-900 px-4 py-1 text-xs uppercase tracking-wider text-slate-300/70">
            Openapi · Estrattore ATECO
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">
            Estrai le aziende per codice ATECO in provincia di Verona
          </h1>
          <p className="mt-3 max-w-2xl text-base text-slate-300 md:text-lg">
            Inserisci le tue credenziali Openapi, scegli ambiente sandbox o produzione e scarica un Excel con tutte
            le aziende corrispondenti. Le credenziali non vengono mai memorizzate.
          </p>
        </header>

        <main className="grid grid-cols-1 gap-8 md:grid-cols-[3fr,2fr]">
          <section className="rounded-3xl border border-slate-800/70 bg-slate-900/60 p-6 shadow-xl shadow-black/30 backdrop-blur">
            <form className="space-y-6" onSubmit={handleSubmit}>
              <fieldset className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <legend className="sr-only">Credenziali</legend>
                <InputField
                  id="username"
                  label="Username Openapi"
                  placeholder="es. nome.cognome@email.com"
                  value={form.username}
                  onChange={(value) => setForm((prev) => ({ ...prev, username: value }))}
                  required
                  autoComplete="username"
                />
                <InputField
                  id="apiKey"
                  label="API Key"
                  placeholder="Copiata dalla tua console Openapi"
                  value={form.apiKey}
                  onChange={(value) => setForm((prev) => ({ ...prev, apiKey: value }))}
                  required
                  autoComplete="off"
                  type="password"
                />
              </fieldset>

              <fieldset className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <legend className="sr-only">Parametri di ricerca</legend>
                <SelectField
                  id="environment"
                  label="Ambiente"
                  value={form.environment}
                  options={[
                    { value: "test", label: "Sandbox (test)" },
                    { value: "production", label: "Produzione" },
                  ]}
                  onChange={(value) => setForm((prev) => ({ ...prev, environment: value as Environment }))}
                />
                <InputField
                  id="province"
                  label="Provincia"
                  placeholder="VR"
                  value={form.province}
                  onChange={(value) => setForm((prev) => ({ ...prev, province: value.toUpperCase() }))}
                  maxLength={2}
                  required
                />
                <InputField
                  id="atecoCode"
                  label="Codice ATECO"
                  placeholder="1071 o 10.71"
                  value={form.atecoCode}
                  onChange={(value) => setForm((prev) => ({ ...prev, atecoCode: value }))}
                  required
                />
              </fieldset>

              <fieldset className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <legend className="sr-only">Paginazione</legend>
                <NumericField
                  id="pageSize"
                  label="Elementi per pagina"
                  value={form.pageSize}
                  min={10}
                  max={1000}
                  onChange={(value) => setForm((prev) => ({ ...prev, pageSize: value }))}
                />
                <NumericField
                  id="startPage"
                  label="Pagina iniziale"
                  value={form.startPage}
                  min={0}
                  max={999}
                  onChange={(value) => setForm((prev) => ({ ...prev, startPage: value }))}
                />
                <NumericField
                  id="maxPages"
                  label="N° pagine da caricare"
                  value={form.maxPages}
                  min={1}
                  max={50}
                  onChange={(value) => setForm((prev) => ({ ...prev, maxPages: value }))}
                />
              </fieldset>

              <div>
                <label htmlFor="extraFilters" className="block text-sm font-medium text-slate-200">
                  Filtri avanzati (JSON opzionale)
                </label>
                <textarea
                  id="extraFilters"
                  value={form.extraFilters}
                  onChange={(event) => setForm((prev) => ({ ...prev, extraFilters: event.target.value }))}
                  rows={6}
                  className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3 font-mono text-sm text-slate-100 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-400/40"
                  spellCheck={false}
                />
                {!filtersAreValid && (
                  <p className="mt-2 text-sm text-rose-400">Il JSON non è valido. Correggi prima di procedere.</p>
                )}
                <p className="mt-2 text-xs text-slate-400">
                  Puoi aggiungere qualsiasi parametro supportato da Openapi, ad esempio{" "}
                  <code className="rounded bg-slate-800 px-1 py-0.5">{"{\"status\": \"ATTIVA\"}"}</code> oppure{" "}
                  <code className="rounded bg-slate-800 px-1 py-0.5">
                    {"{\"revenueMin\": 1000000, \"revenueMax\": 5000000}"}
                  </code>
                  .
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="submit"
                  disabled={isLoading || !filtersAreValid}
                  className="inline-flex items-center justify-center rounded-full bg-emerald-500 px-6 py-3 text-sm font-semibold text-emerald-950 shadow-lg shadow-emerald-500/30 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isLoading ? (
                    <>
                      <Spinner /> Elaborazione...
                    </>
                  ) : (
                    "Genera Excel"
                  )}
                </button>
                {recordCount !== null && (
                  <span className="text-sm text-slate-400">
                    Record ricevuti: <span className="font-semibold text-slate-200">{recordCount}</span>
                  </span>
                )}
              </div>
            </form>

            {message && (
              <div
                className={`mt-6 rounded-2xl border px-4 py-3 text-sm ${
                  message.type === "success"
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                    : message.type === "info"
                      ? "border-sky-500/30 bg-sky-500/10 text-sky-100"
                      : "border-rose-500/40 bg-rose-500/10 text-rose-100"
                }`}
              >
                <p>{message.text}</p>
                {message.details && <p className="mt-2 text-xs opacity-80">{message.details}</p>}
                {downloadUrl && filename && message.type === "success" && (
                  <a
                    href={downloadUrl}
                    download={filename}
                    className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white transition hover:bg-white/20"
                  >
                    Scarica di nuovo ({filename})
                  </a>
                )}
              </div>
            )}
          </section>

          <aside className="space-y-6">
            <div className="rounded-3xl border border-slate-800/70 bg-slate-900/50 p-5 text-sm leading-relaxed text-slate-200 shadow-lg shadow-black/30">
              <h2 className="text-lg font-semibold text-white">Come funziona</h2>
              <ol className="mt-3 list-decimal space-y-2 pl-5">
                <li>Accedi alla console Openapi e copia username e API key.</li>
                <li>Se vuoi provare senza consumare crediti usa l&apos;ambiente sandbox (test).</li>
                <li>Inserisci il codice ATECO, la provincia e (se serve) altri filtri avanzati.</li>
                <li>Clicca su &quot;Genera Excel&quot; per avviare l&apos;estrazione.</li>
              </ol>
              <p className="mt-4 text-xs text-slate-400">
                I dati passano direttamente tra il tuo browser e le API Openapi. Nessuna credenziale viene salvata sul
                server.
              </p>
            </div>

            <div className="rounded-3xl border border-slate-800/70 bg-slate-900/50 p-5 text-sm leading-relaxed text-slate-200 shadow-lg shadow-black/30">
              <h2 className="text-lg font-semibold text-white">Suggerimenti filtri</h2>
              <ul className="mt-3 space-y-2 text-slate-300">
                <li>
                  <span className="font-medium text-slate-100">Date:</span>{" "}
                  <code className="rounded bg-slate-800/70 px-1 py-0.5 text-xs">{"{\"updatedAfter\": \"2024-01-01\"}"}</code>
                </li>
                <li>
                  <span className="font-medium text-slate-100">Fatturato:</span>{" "}
                  <code className="rounded bg-slate-800/70 px-1 py-0.5 text-xs">{"{\"revenueMin\": 1000000}"}</code>
                </li>
                <li>
                  <span className="font-medium text-slate-100">Numero dipendenti:</span>{" "}
                  <code className="rounded bg-slate-800/70 px-1 py-0.5 text-xs">
                    {"{\"employeesMin\": 5, \"employeesMax\": 50}"}
                  </code>
                </li>
                <li>
                  <span className="font-medium text-slate-100">Comune (Belfiore):</span>{" "}
                  <code className="rounded bg-slate-800/70 px-1 py-0.5 text-xs">{"{\"municipality\": \"L781\"}"}</code>
                </li>
              </ul>
            </div>
          </aside>
        </main>
      </div>
    </div>
  );
}

interface InputProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  type?: "text" | "password";
  autoComplete?: string;
  maxLength?: number;
}

function InputField({
  id,
  label,
  value,
  onChange,
  placeholder,
  required = false,
  type = "text",
  autoComplete,
  maxLength,
}: InputProps) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium text-slate-200">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        autoComplete={autoComplete}
        maxLength={maxLength}
        className="h-12 rounded-2xl border border-slate-800 bg-slate-950/60 px-4 text-sm text-slate-100 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-400/40"
      />
    </div>
  );
}

interface SelectProps {
  id: string;
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}

function SelectField({ id, label, value, options, onChange }: SelectProps) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium text-slate-200">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-12 rounded-2xl border border-slate-800 bg-slate-950/60 px-4 text-sm text-slate-100 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-400/40"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

interface NumericFieldProps {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}

function NumericField({ id, label, value, min, max, onChange }: NumericFieldProps) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium text-slate-200">
        {label}
      </label>
      <input
        id={id}
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-12 rounded-2xl border border-slate-800 bg-slate-950/60 px-4 text-sm text-slate-100 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-400/40"
      />
    </div>
  );
}

function Spinner() {
  return (
    <svg className="mr-2 h-4 w-4 animate-spin text-emerald-950" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
    </svg>
  );
}

function triggerDownload(url: string, filename: string) {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

function extractFilename(disposition: string | null) {
  if (!disposition) return null;
  const match = disposition.match(/filename="?([^";]+)"?/i);
  return match ? match[1] : null;
}

function buildFallbackFilename(form: FormState) {
  const today = new Date().toISOString().split("T")[0];
  return `aziende_${form.province}_${form.atecoCode}_${today}.xlsx`;
}
