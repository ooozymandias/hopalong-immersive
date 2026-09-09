export const performanceSteps = [245000, 200000, 160000, 120000];

export class AutoPerformance {
  constructor() { this.reset(); }
  reset(ceiling = 245000, hz = 72) {
    this.steps = performanceSteps.filter((count) => count <= ceiling);
    if (!this.steps.length || this.steps[0] !== ceiling) this.steps.unshift(ceiling);
    this.index = 0; this.hz = hz; this.age = 0; this.bad = 0; this.good = 0;
    this.cadence = 1000 / hz; this.cost = 0; this.cooldown = 5;
  }
  get count() { return this.steps[this.index]; }
  warmup() {
    this.bad = this.good = 0; this.cadence = 1000 / this.hz; this.cost = 0; this.cooldown = 5;
  }
  sample(intervalMs, cpuMs, gpuMs = null) {
    if (!(intervalMs > 0)) return this.count;
    // Cap a stall's contribution: one pause cannot lower quality, sustained stalls can.
    const dt = Math.min(intervalMs, 250) / 1000;
    const budget = 1000 / this.hz;
    this.age += dt; this.cooldown = Math.max(0, this.cooldown - dt);
    const blend = 1 - Math.exp(-dt / 2);
    this.cadence += (Math.min(intervalMs, budget * 3) - this.cadence) * blend;
    const work = Math.min(budget * 3, Math.max(cpuMs, gpuMs ?? 0));
    this.cost += (work - this.cost) * blend;
    if (this.cooldown > 0) return this.count;
    const overloaded = this.cadence > budget * 1.12 || this.cost > budget * 0.94;
    this.bad = overloaded ? this.bad + dt : Math.max(0, this.bad - dt * 2);
    // Upgrade only with real measured GPU headroom, not CPU submission time.
    const headroom = gpuMs !== null && this.cadence < budget * 1.04 && this.cost < budget * 0.6;
    this.good = headroom ? this.good + dt : 0;
    if (this.bad > 3 && this.index < this.steps.length - 1) {
      this.index++; this.bad = this.good = 0; this.cooldown = 6;
    } else if (this.good > 30 && this.index > 0) {
      this.index--; this.bad = this.good = 0; this.cooldown = 10;
    }
    return this.count;
  }
}

/** Non-blocking GPU timer. On unsupported runtimes, cadence + CPU remain usable. */
export class GpuTimer {
  constructor(renderer) {
    this.gl = renderer.getContext();
    this.ext = this.gl.getExtension('EXT_disjoint_timer_query_webgl2');
    this.pending = []; this.active = null; this.latest = null;
  }
  begin() {
    if (!this.ext || this.active || this.pending.length >= 4) return;
    this.active = this.gl.createQuery();
    this.gl.beginQuery(this.ext.TIME_ELAPSED_EXT, this.active);
  }
  end() {
    if (!this.active) return;
    this.gl.endQuery(this.ext.TIME_ELAPSED_EXT);
    this.pending.push(this.active); this.active = null;
  }
  poll() {
    if (!this.ext) return null;
    if (this.gl.getParameter(this.ext.GPU_DISJOINT_EXT)) { this.clear(); return null; }
    while (this.pending.length && this.gl.getQueryParameter(this.pending[0], this.gl.QUERY_RESULT_AVAILABLE)) {
      const query = this.pending.shift();
      this.latest = this.gl.getQueryParameter(query, this.gl.QUERY_RESULT) / 1e6;
      this.gl.deleteQuery(query);
    }
    return this.latest;
  }
  clear() {
    this.end();
    for (const query of this.pending) this.gl.deleteQuery(query);
    this.pending = []; this.latest = null;
  }
}
