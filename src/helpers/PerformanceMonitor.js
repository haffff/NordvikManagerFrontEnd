// Performance monitoring utility for tracking component renders
export class PerformanceMonitor {
  static renderCounts = new Map();
  static renderTimes = new Map();

  static trackRender(componentName, props = {}) {
    const now = performance.now();
    
    // Track render count
    const currentCount = this.renderCounts.get(componentName) || 0;
    this.renderCounts.set(componentName, currentCount + 1);
    
    // Track render frequency
    const lastRenderTime = this.renderTimes.get(componentName) || now;
    const timeSinceLastRender = now - lastRenderTime;
    this.renderTimes.set(componentName, now);
    
    // Log if renders are too frequent (less than 16ms = faster than 60fps)
    if (timeSinceLastRender < 16 && currentCount > 1) {
      console.warn(`⚠️ ${componentName} rendering too frequently!`, {
        count: currentCount + 1,
        timeSinceLastRender: `${timeSinceLastRender.toFixed(2)}ms`,
        props: Object.keys(props).reduce((acc, key) => {
          acc[key] = typeof props[key];
          return acc;
        }, {})
      });
    } else if (process.env.NODE_ENV === 'development') {
      console.log(`🎨 ${componentName} render #${currentCount + 1}`, {
        timeSinceLastRender: `${timeSinceLastRender.toFixed(2)}ms`
      });
    }
  }

  static getStats() {
    const stats = {};
    for (const [component, count] of this.renderCounts.entries()) {
      stats[component] = {
        renderCount: count,
        lastRenderTime: this.renderTimes.get(component),
        averageFrequency: count > 1 ? (Date.now() - this.renderTimes.get(component)) / count : 0
      };
    }
    return stats;
  }

  static reset() {
    this.renderCounts.clear();
    this.renderTimes.clear();
  }

  // Expose to window for debugging
  static enableDebugging() {
    if (typeof window !== 'undefined') {
      window.PerformanceMonitor = this;
    }
  }
}

// Enable debugging in development
if (process.env.NODE_ENV === 'development') {
  PerformanceMonitor.enableDebugging();
}

// Usage: Add to component start
// PerformanceMonitor.trackRender('Battlemap', { withID, keyboardEventsManagerRef });
