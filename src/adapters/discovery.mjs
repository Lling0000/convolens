import { Adapter } from "./base.mjs";
import { CAPABILITIES, RISK } from "../core/schema.mjs";
import { exists } from "../core/fs-utils.mjs";
import { expandHome } from "../core/pathing.mjs";

export class DiscoveryAdapter extends Adapter {
  constructor(options = {}) {
    super(options);
    this._id = options.id;
    this.label = options.label || options.id;
    this.candidatePaths = options.candidatePaths || [];
  }

  get id() {
    return this._id;
  }

  async doctor() {
    const paths = [];
    for (const candidate of this.candidatePaths) {
      const full = expandHome(candidate);
      if (await exists(full)) paths.push(full);
    }
    return {
      provider: this.id,
      label: this.label,
      available: paths.length > 0,
      capabilities: paths.length > 0 ? [CAPABILITIES.SIDECAR_ONLY] : [],
      risk: RISK.LOW,
      paths,
      notes: paths.length > 0
        ? ["Discovery-only adapter: ConvoLens will index sidecar titles and avoid write-back."]
        : ["No known local history path found yet."]
    };
  }
}
