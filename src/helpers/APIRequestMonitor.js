// Debug utility to track API requests and prevent excessive calls
export class APIRequestMonitor {
  static requests = new Map();
  static REQUEST_COOLDOWN = 1000; // 1 second cooldown

  static shouldAllowRequest(endpoint) {
    const now = Date.now();
    const lastRequest = this.requests.get(endpoint);
    
    if (!lastRequest || (now - lastRequest) > this.REQUEST_COOLDOWN) {
      this.requests.set(endpoint, now);
      return true;
    }
    
    console.warn(`🚫 API Request blocked: ${endpoint} (cooldown active)`);
    return false;
  }

  static trackRequest(endpoint) {
    const count = this.requests.get(`${endpoint}_count`) || 0;
    this.requests.set(`${endpoint}_count`, count + 1);
    
    if (count > 0 && count % 10 === 0) {
      console.warn(`⚠️ High API usage: ${endpoint} called ${count + 1} times`);
    }
  }

  static getStats() {
    const stats = {};
    for (const [key, value] of this.requests.entries()) {
      if (key.endsWith('_count')) {
        const endpoint = key.replace('_count', '');
        stats[endpoint] = value;
      }
    }
    return stats;
  }

  static reset() {
    this.requests.clear();
  }
}

// Usage in WebHelper or components:
// if (!APIRequestMonitor.shouldAllowRequest('battlemap/getplayer')) return;
// APIRequestMonitor.trackRequest('battlemap/getplayer');
