// Eventos: barramento simples para a interface reagir a mudanças de estado (bus.on / bus.emit).

export const bus = {
  l: {},
  on(evt, fn) { (this.l[evt] ??= []).push(fn); return () => (this.l[evt] = this.l[evt].filter((f) => f !== fn)); },
  emit(evt, data) { (this.l[evt] || []).forEach((f) => f(data)); },
};
