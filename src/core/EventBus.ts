type EventHandler<T = unknown> = (data: T) => void;

export class EventBus {
  private listeners: Map<string, EventHandler<unknown>[]> = new Map();

  on<T>(event: string, handler: EventHandler<T>): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(handler as EventHandler<unknown>);
  }

  off<T>(event: string, handler: EventHandler<T>): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      const idx = handlers.indexOf(handler as EventHandler<unknown>);
      if (idx !== -1) handlers.splice(idx, 1);
    }
  }

  emit<T>(event: string, data?: T): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.forEach(h => h(data as unknown));
    }
  }
}

export const eventBus = new EventBus();
