export class Adapter {
  constructor(options = {}) {
    this.options = options;
  }

  get id() {
    throw new Error("adapter id is required");
  }

  async doctor() {
    return {
      provider: this.id,
      available: false,
      capabilities: [],
      risk: "low",
      paths: [],
      notes: ["Adapter has not implemented doctor()."]
    };
  }

  async scan() {
    return [];
  }

  async rename() {
    throw new Error(`${this.id} does not support write-back rename`);
  }
}
