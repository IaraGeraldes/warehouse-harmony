import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/")({
  component: ArgosDashboard,
});

const WEBHOOK_URL = "https://hook.us2.make.com/vwjw0ce81chpywtcvxgj3wzcd5v6ty3u";

type FloorState = {
  floor: number;
  occupancy: number; // 0-100
  containers: { id: string; front: boolean; imo?: boolean }[];
};

type Recommendation = {
  floor: number;
  position: "Front" | "Back";
  reason?: string;
};

const INITIAL_FLOORS: FloorState[] = [
  { floor: 7, occupancy: 15, containers: [{ id: "IMO-A12", front: true, imo: true }] },
  { floor: 6, occupancy: 30, containers: [{ id: "WS-4421", front: true }, { id: "WS-4422", front: false }] },
  { floor: 5, occupancy: 40, containers: [{ id: "WS-3390", front: true }, { id: "WS-3391", front: false }] },
  { floor: 4, occupancy: 55, containers: [{ id: "WS-2201", front: true }, { id: "WS-2202", front: false }, { id: "WS-2203", front: true }] },
  { floor: 3, occupancy: 70, containers: [{ id: "HL-118", front: true }, { id: "HL-119", front: false }, { id: "HL-120", front: true }] },
  { floor: 2, occupancy: 62, containers: [{ id: "HL-081", front: true }, { id: "HL-082", front: false }, { id: "HL-083", front: true }] },
  { floor: 1, occupancy: 48, containers: [{ id: "HL-001", front: true }, { id: "HL-002", front: false }] },
];

function ArgosDashboard() {
  const [description, setDescription] = useState("");
  const [weight, setWeight] = useState<number | "">("");
  const [stay, setStay] = useState<number | "">("");
  const [imo, setImo] = useState<"No" | "Yes">("No");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);

  const [floors, setFloors] = useState<FloorState[]>(INITIAL_FLOORS);
  const [highlightFloor, setHighlightFloor] = useState<number | null>(null);

  const totalOccupancy = useMemo(
    () => Math.round(floors.reduce((s, f) => s + f.occupancy, 0) / floors.length),
    [floors],
  );

  const overweight = typeof weight === "number" && weight > 24;
  const fullOperation = totalOccupancy >= 40;

  async function handleCalculate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    setRecommendation(null);

    const payload = {
      container_description: description,
      weight_tons: typeof weight === "number" ? weight : null,
      estimated_stay_months: typeof stay === "number" ? stay : null,
      dangerous_goods_imo: imo === "Yes",
      current_occupancy_rate: totalOccupancy,
      floors: floors.map((f) => ({ floor: f.floor, occupancy: f.occupancy })),
    };

    try {
      const res = await fetch(WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const text = await res.text();
      let data: Record<string, unknown> = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = {};
      }

      // Try to extract floor/position from various common shapes
      const rawFloor =
        (data.recommended_floor as number | string | undefined) ??
        (data.floor as number | string | undefined) ??
        (data.Floor as number | string | undefined);
      const rawPos =
        (data.recommended_position as string | undefined) ??
        (data.position as string | undefined) ??
        (data.Position as string | undefined);
      const reason =
        (data.reason as string | undefined) ??
        (data.explanation as string | undefined);

      let floorNum = Number(rawFloor);
      let position: "Front" | "Back" =
        typeof rawPos === "string" && rawPos.toLowerCase().startsWith("b") ? "Back" : "Front";

      // Local fallback logic if webhook doesn't return a structured floor
      if (!floorNum || Number.isNaN(floorNum) || floorNum < 1 || floorNum > 7) {
        if (imo === "Yes") {
          floorNum = 7;
        } else if (typeof weight === "number" && weight > 20) {
          floorNum = [1, 2, 3].sort((a, b) => floors[7 - a - 1 + 0].occupancy - floors[7 - b - 1 + 0].occupancy)[0] ?? 1;
        } else if (!fullOperation) {
          floorNum = [1, 2, 3, 4].sort(
            (a, b) => (floors.find((f) => f.floor === a)?.occupancy ?? 0) - (floors.find((f) => f.floor === b)?.occupancy ?? 0),
          )[0];
        } else {
          floorNum = [...floors].sort((a, b) => a.occupancy - b.occupancy).find((f) => f.floor !== 7)?.floor ?? 4;
        }
        position =
          (floors.find((f) => f.floor === floorNum)?.occupancy ?? 0) < 50 ? "Front" : "Back";
      }

      setRecommendation({ floor: floorNum, position, reason });
      setHighlightFloor(floorNum);
    } catch (err) {
      console.error(err);
      setError("Não foi possível acessar o serviço de alocação. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  function confirmAllocation() {
    if (!recommendation) return;
    setFloors((prev) =>
      prev.map((f) =>
        f.floor === recommendation.floor
          ? {
              ...f,
              occupancy: Math.min(100, f.occupancy + 8),
              containers: [
                ...f.containers,
                {
                  id: description ? description.slice(0, 10).toUpperCase() : `NEW-${Math.floor(Math.random() * 900 + 100)}`,
                  front: recommendation.position === "Front",
                  imo: imo === "Yes",
                },
              ],
            }
          : f,
      ),
    );
    setRecommendation(null);
    setDescription("");
    setWeight("");
    setStay("");
    setImo("No");
    setHighlightFloor(null);
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header
        className="border-b border-border/60 text-[color:var(--navy-foreground)]"
        style={{ background: "var(--gradient-navy)" }}
      >
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-4">
            <div
              className="flex h-11 w-11 items-center justify-center rounded-md font-bold tracking-tight"
              style={{ background: "var(--gradient-teal)", color: "var(--teal-foreground)" }}
            >
              WS
            </div>
            <div>
              <div className="text-[11px] font-medium uppercase tracking-[0.22em] opacity-70">
                Wilson Sons · Digital Twin
              </div>
              <h1 className="text-lg font-semibold leading-tight sm:text-xl">
                Projeto Argos — Otimizador de Armazém
              </h1>
            </div>
          </div>
          <div className="hidden items-center gap-6 md:flex">
            <StatusPill label="Sistema" value="Online" tone="teal" />
            <StatusPill label="Operador" value="Guindaste · 02" tone="ghost" />
            <StatusPill label="Turno" value="A · 06:00–14:00" tone="ghost" />
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-[1600px] grid-cols-1 gap-6 px-6 py-6 lg:grid-cols-[minmax(0,440px)_minmax(0,1fr)]">
        {/* LEFT: FORM */}
        <section className="flex flex-col gap-5">
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold">Container Allocation</h2>
                <p className="text-xs text-muted-foreground">
                  Fill in the container profile to compute the optimal slot.
                </p>
              </div>
              <span
                className="rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider"
                style={{ background: "var(--secondary)", color: "var(--secondary-foreground)" }}
              >
                Step 1
              </span>
            </div>

            <form onSubmit={handleCalculate} className="space-y-4">
              <Field label="Container Description">
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Refrigerated cargo — 40ft HC"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none transition focus:border-[color:var(--ring)] focus:ring-2 focus:ring-[color:var(--ring)]/25"
                  required
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Weight (tons)">
                  <div className="relative">
                    <input
                      type="number"
                      min={0}
                      step="0.1"
                      value={weight}
                      onChange={(e) => setWeight(e.target.value === "" ? "" : Number(e.target.value))}
                      placeholder="0.0"
                      className={`w-full rounded-md border bg-background px-3 py-2 pr-14 text-sm outline-none transition focus:ring-2 ${
                        overweight
                          ? "border-[color:var(--warning)] focus:border-[color:var(--warning)] focus:ring-[color:var(--warning)]/30"
                          : "border-input focus:border-[color:var(--ring)] focus:ring-[color:var(--ring)]/25"
                      }`}
                      required
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground">
                      t
                    </span>
                  </div>
                  {overweight && (
                    <div
                      className="mt-1.5 flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium"
                      style={{
                        background: "color-mix(in oklab, var(--warning) 18%, transparent)",
                        color: "var(--warning-foreground)",
                      }}
                    >
                      <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: "var(--warning)" }} />
                      Over 24t — heavy-load zone required (Floors 1–3).
                    </div>
                  )}
                </Field>

                <Field label="Estimated Stay (months)">
                  <input
                    type="number"
                    min={0}
                    step="1"
                    value={stay}
                    onChange={(e) => setStay(e.target.value === "" ? "" : Number(e.target.value))}
                    placeholder="0"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none transition focus:border-[color:var(--ring)] focus:ring-2 focus:ring-[color:var(--ring)]/25"
                    required
                  />
                </Field>
              </div>

              <Field label="Dangerous Goods / IMO">
                <div className="grid grid-cols-2 gap-2 rounded-md border border-input bg-background p-1">
                  {(["No", "Yes"] as const).map((opt) => {
                    const active = imo === opt;
                    const danger = opt === "Yes";
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setImo(opt)}
                        className={`rounded px-3 py-1.5 text-sm font-medium transition ${
                          active
                            ? danger
                              ? "text-[color:var(--danger-foreground)]"
                              : "text-primary-foreground"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                        style={
                          active
                            ? {
                                background: danger ? "var(--danger)" : "var(--primary)",
                              }
                            : undefined
                        }
                      >
                        {opt === "Yes" ? "Yes · IMO" : "No"}
                      </button>
                    );
                  })}
                </div>
              </Field>

              <button
                type="submit"
                disabled={loading}
                className="group relative flex w-full items-center justify-center gap-2 rounded-md px-4 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition disabled:opacity-60"
                style={{ background: "var(--gradient-navy)" }}
              >
                {loading ? (
                  <>
                    <Spinner /> Calculating…
                  </>
                ) : (
                  <>
                    <BoltIcon /> Calculate Smart Allocation
                  </>
                )}
              </button>

              {error && (
                <div
                  className="rounded-md px-3 py-2 text-xs"
                  style={{
                    background: "color-mix(in oklab, var(--destructive) 12%, transparent)",
                    color: "var(--destructive)",
                  }}
                >
                  {error}
                </div>
              )}
            </form>
          </div>

          {/* Recommended location card */}
          <div
            className="rounded-xl border border-border p-5 shadow-sm"
            style={{
              background: recommendation
                ? "linear-gradient(135deg, var(--card), color-mix(in oklab, var(--teal) 10%, var(--card)))"
                : "var(--card)",
            }}
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold">Recommended Location</h2>
                <p className="text-xs text-muted-foreground">
                  Output from the Argos allocation engine.
                </p>
              </div>
              <span
                className="rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider"
                style={{
                  background: recommendation ? "var(--teal)" : "var(--secondary)",
                  color: recommendation ? "var(--teal-foreground)" : "var(--secondary-foreground)",
                }}
              >
                Step 2
              </span>
            </div>

            {!recommendation ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border/80 py-8 text-center">
                <div
                  className="mb-3 flex h-10 w-10 items-center justify-center rounded-full"
                  style={{ background: "var(--secondary)", color: "var(--muted-foreground)" }}
                >
                  <TargetIcon />
                </div>
                <p className="text-sm font-medium text-foreground">Awaiting calculation</p>
                <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                  Submit a container profile to receive an optimal floor and position.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <MetricBlock
                    label="Recommended Floor"
                    value={`0${recommendation.floor}`.slice(-2)}
                    hint={`of 07`}
                    tone="navy"
                  />
                  <MetricBlock
                    label="Position"
                    value={recommendation.position}
                    hint={recommendation.position === "Front" ? "Fast access" : "Long stay"}
                    tone="teal"
                  />
                </div>
                {recommendation.reason && (
                  <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
                    {recommendation.reason}
                  </p>
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setRecommendation(null)}
                    className="flex-1 rounded-md border border-input bg-background px-3 py-2.5 text-sm font-medium text-foreground transition hover:bg-accent"
                  >
                    Dismiss
                  </button>
                  <button
                    type="button"
                    onClick={confirmAllocation}
                    className="flex-[2] rounded-md px-3 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:brightness-110"
                    style={{ background: "var(--gradient-teal)", color: "var(--teal-foreground)" }}
                  >
                    ✓ Confirm allocation
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* RIGHT: DIGITAL TWIN */}
        <section className="flex flex-col gap-5">
          {/* Top metric bar */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div
              className="col-span-1 rounded-xl border border-border p-5 shadow-sm md:col-span-1"
              style={{
                background: "var(--gradient-navy)",
                color: "var(--navy-foreground)",
              }}
            >
              <div className="text-[11px] font-medium uppercase tracking-[0.2em] opacity-70">
                Total Occupancy Rate
              </div>
              <div className="mt-2 flex items-end gap-2">
                <span className="text-4xl font-bold leading-none tracking-tight">{totalOccupancy}%</span>
                <span className="mb-1 text-xs opacity-70">across 7 floors</span>
              </div>
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${totalOccupancy}%`,
                    background: "var(--gradient-teal)",
                  }}
                />
              </div>
            </div>

            <div
              className="col-span-1 flex flex-col justify-center rounded-xl border p-5 shadow-sm md:col-span-2"
              style={
                fullOperation
                  ? {
                      background: "color-mix(in oklab, var(--success) 12%, var(--card))",
                      borderColor: "color-mix(in oklab, var(--success) 40%, var(--border))",
                    }
                  : {
                      background: "color-mix(in oklab, var(--warning) 14%, var(--card))",
                      borderColor: "color-mix(in oklab, var(--warning) 45%, var(--border))",
                    }
              }
            >
              <div className="flex items-center gap-3">
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-full"
                  style={{
                    background: fullOperation ? "var(--success)" : "var(--warning)",
                    color: "white",
                  }}
                >
                  {fullOperation ? <CheckIcon /> : <AlertIcon />}
                </span>
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    Operational Status
                  </div>
                  <div className="text-lg font-bold tracking-tight text-foreground">
                    {fullOperation ? "FULL OPERATION" : "RESTRICTED TO FLOORS 1–4"}
                  </div>
                </div>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {fullOperation
                  ? "Occupancy above 40%. All floors available under standard safety rules."
                  : "Occupancy below 40%. Upper floors (5–7) locked for structural balance; IMO zone (Floor 7) always exclusive."}
              </p>
            </div>
          </div>

          {/* Warehouse twin */}
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold">Digital Twin · Warehouse Stack</h2>
                <p className="text-xs text-muted-foreground">
                  Live view of 7 vertical floors · Front row is closest to the loading bay.
                </p>
              </div>
              <div className="flex items-center gap-3 text-[11px]">
                <LegendDot color="var(--danger)" label="IMO zone" />
                <LegendDot color="var(--primary)" label="Heavy load" />
                <LegendDot color="var(--teal)" label="Standard" />
              </div>
            </div>

            <div
              className="rounded-lg p-4"
              style={{
                background:
                  "linear-gradient(180deg, color-mix(in oklab, var(--navy) 8%, var(--card)), var(--card))",
                boxShadow: "var(--shadow-panel)",
              }}
            >
              <div className="flex flex-col gap-2">
                {floors.map((f) => (
                  <FloorRow
                    key={f.floor}
                    floor={f}
                    highlighted={highlightFloor === f.floor}
                    recommendationPosition={
                      highlightFloor === f.floor ? recommendation?.position : undefined
                    }
                  />
                ))}
                {/* Ground */}
                <div className="mt-1 flex items-center gap-3 border-t border-dashed border-border pt-3 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                  <span className="h-1 flex-1 rounded-full" style={{ background: "var(--grid-line)" }} />
                  Loading Bay · Ground
                  <span className="h-1 flex-1 rounded-full" style={{ background: "var(--grid-line)" }} />
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

/* ---------- Sub-components ---------- */

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

function StatusPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "teal" | "ghost";
}) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="inline-block h-2 w-2 rounded-full"
        style={{
          background: tone === "teal" ? "var(--teal)" : "rgba(255,255,255,0.5)",
          boxShadow: tone === "teal" ? "0 0 0 4px color-mix(in oklab, var(--teal) 25%, transparent)" : undefined,
        }}
      />
      <div className="text-xs">
        <div className="opacity-60">{label}</div>
        <div className="font-semibold">{value}</div>
      </div>
    </div>
  );
}

function MetricBlock({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone: "navy" | "teal";
}) {
  return (
    <div
      className="rounded-lg p-4"
      style={{
        background: tone === "navy" ? "var(--gradient-navy)" : "var(--gradient-teal)",
        color: tone === "navy" ? "var(--navy-foreground)" : "var(--teal-foreground)",
      }}
    >
      <div className="text-[10px] font-semibold uppercase tracking-[0.2em] opacity-75">{label}</div>
      <div className="mt-1 text-3xl font-bold tracking-tight">{value}</div>
      {hint && <div className="mt-0.5 text-[11px] opacity-75">{hint}</div>}
    </div>
  );
}

function FloorRow({
  floor,
  highlighted,
  recommendationPosition,
}: {
  floor: FloorState;
  highlighted: boolean;
  recommendationPosition?: "Front" | "Back";
}) {
  const isIMO = floor.floor === 7;
  const isHeavy = floor.floor <= 3;

  const accent = isIMO ? "var(--danger)" : isHeavy ? "var(--primary)" : "var(--teal)";
  const label = isIMO ? "IMO / Dangerous Goods" : isHeavy ? "Heavy Load Zone (Base)" : "Standard Zone";

  return (
    <div
      className="relative overflow-hidden rounded-lg border transition"
      style={{
        borderColor: highlighted
          ? accent
          : "color-mix(in oklab, var(--border) 80%, transparent)",
        background: isIMO
          ? "color-mix(in oklab, var(--danger) 8%, var(--card))"
          : isHeavy
            ? "color-mix(in oklab, var(--primary) 5%, var(--card))"
            : "var(--card)",
        boxShadow: highlighted
          ? `0 0 0 2px ${accent}, 0 10px 30px -15px ${accent}`
          : undefined,
      }}
    >
      <div className="flex items-stretch">
        {/* Floor number */}
        <div
          className="flex w-16 flex-col items-center justify-center border-r border-border/60 py-3"
          style={{ background: "color-mix(in oklab, var(--navy) 6%, transparent)" }}
        >
          <div className="text-[9px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Floor
          </div>
          <div className="text-2xl font-bold leading-none tracking-tight text-foreground">
            {floor.floor.toString().padStart(2, "0")}
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: accent }}
              />
              <span className="text-xs font-semibold text-foreground">{label}</span>
              {highlighted && (
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                  style={{
                    background: accent,
                    color: isIMO ? "var(--danger-foreground)" : "var(--primary-foreground)",
                  }}
                >
                  Recommended
                </span>
              )}
            </div>
            <div className="text-xs font-semibold tabular-nums text-foreground">
              {floor.occupancy}%
            </div>
          </div>

          {/* Occupancy bar */}
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${floor.occupancy}%`,
                background: accent,
              }}
            />
          </div>

          {/* Container slots — front / back */}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <SlotRow
              title="Front"
              containers={floor.containers.filter((c) => c.front)}
              accent={accent}
              highlighted={highlighted && recommendationPosition === "Front"}
            />
            <SlotRow
              title="Back"
              containers={floor.containers.filter((c) => !c.front)}
              accent={accent}
              highlighted={highlighted && recommendationPosition === "Back"}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function SlotRow({
  title,
  containers,
  accent,
  highlighted,
}: {
  title: string;
  containers: { id: string; imo?: boolean }[];
  accent: string;
  highlighted: boolean;
}) {
  return (
    <div
      className="rounded-md border p-2"
      style={{
        borderColor: highlighted ? accent : "color-mix(in oklab, var(--border) 90%, transparent)",
        background: highlighted
          ? `color-mix(in oklab, ${accent} 12%, transparent)`
          : "color-mix(in oklab, var(--muted) 60%, transparent)",
      }}
    >
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          {title}
        </span>
        <span className="text-[10px] tabular-nums text-muted-foreground">
          {containers.length} unit{containers.length === 1 ? "" : "s"}
        </span>
      </div>
      <div className="flex flex-wrap gap-1">
        {containers.length === 0 && (
          <span className="rounded border border-dashed border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">
            empty
          </span>
        )}
        {containers.map((c) => (
          <span
            key={c.id}
            className="rounded px-1.5 py-0.5 text-[10px] font-medium tabular-nums"
            style={{
              background: c.imo
                ? "color-mix(in oklab, var(--danger) 20%, transparent)"
                : "color-mix(in oklab, var(--navy) 10%, transparent)",
              color: c.imo ? "var(--danger)" : "var(--foreground)",
              border: `1px solid color-mix(in oklab, ${c.imo ? "var(--danger)" : "var(--navy)"} 30%, transparent)`,
            }}
          >
            {c.id}
          </span>
        ))}
      </div>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5 text-muted-foreground">
      <span className="h-2 w-2 rounded-full" style={{ background: color }} />
      {label}
    </div>
  );
}

/* Icons */
function BoltIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  );
}
function TargetIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.5" />
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
function AlertIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
    </svg>
  );
}
function Spinner() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" className="animate-spin">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
