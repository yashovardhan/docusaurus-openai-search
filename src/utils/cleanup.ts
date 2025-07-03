/**
 * Cleanup Manager Utility for Docusaurus AI Search
 * Provides centralized cleanup mechanisms for DOM elements, refs, and resources
 */

import React from 'react';

export interface CleanupTask {
  id: string;
  cleanup: () => void;
  priority?: number; // Higher priority runs first
}

export class CleanupManager {
  private static instance: CleanupManager;
  private tasks: Map<string, CleanupTask> = new Map();
  private isDestroyed = false;

  private constructor() {}

  static getInstance(): CleanupManager {
    if (!CleanupManager.instance) {
      CleanupManager.instance = new CleanupManager();
    }
    return CleanupManager.instance;
  }

  /**
   * Reset the singleton instance (for testing/cleanup)
   */
  static reset(): void {
    if (CleanupManager.instance) {
      CleanupManager.instance.cleanup();
      CleanupManager.instance = null as any;
    }
  }

  /**
   * Register a cleanup task
   */
  register(task: CleanupTask): void {
    if (this.isDestroyed) return;
    
    this.tasks.set(task.id, task);
  }

  /**
   * Unregister a cleanup task
   */
  unregister(taskId: string): void {
    this.tasks.delete(taskId);
  }

  /**
   * Execute cleanup for a specific task
   */
  cleanupTask(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (task) {
      try {
        task.cleanup();
      } catch (error) {
        console.error(`Cleanup failed for task ${taskId}:`, error);
      }
      this.tasks.delete(taskId);
    }
  }

  /**
   * Execute all cleanup tasks
   */
  cleanup(): void {
    if (this.isDestroyed) return;

    // Sort tasks by priority (higher priority first)
    const sortedTasks = Array.from(this.tasks.values())
      .sort((a, b) => (b.priority || 0) - (a.priority || 0));

    // Execute cleanup tasks
    for (const task of sortedTasks) {
      try {
        task.cleanup();
      } catch (error) {
        console.error(`Cleanup failed for task ${task.id}:`, error);
      }
    }

    this.tasks.clear();
    this.isDestroyed = true;
  }

  /**
   * Get number of registered tasks
   */
  getTaskCount(): number {
    return this.tasks.size;
  }

  /**
   * Check if cleanup manager is destroyed
   */
  isDestroyed_(): boolean {
    return this.isDestroyed;
  }
}

/**
 * DOM Element Cleanup Utilities
 */
export class DOMCleanupUtils {
  /**
   * Clear all child nodes from an element
   */
  static clearElement(element: Element | null): void {
    if (!element) return;
    
    while (element.firstChild) {
      element.removeChild(element.firstChild);
    }
  }

  /**
   * Remove element from DOM if it exists
   */
  static removeElement(element: Element | null): void {
    if (element && element.parentNode) {
      element.parentNode.removeChild(element);
    }
  }

  /**
   * Clear element attributes
   */
  static clearAttributes(element: Element | null, preserveAttributes: string[] = []): void {
    if (!element) return;
    
    const attributesToRemove: string[] = [];
    
    // Collect attributes to remove
    for (let i = 0; i < element.attributes.length; i++) {
      const attr = element.attributes[i];
      if (!preserveAttributes.includes(attr.name)) {
        attributesToRemove.push(attr.name);
      }
    }
    
    // Remove attributes
    attributesToRemove.forEach(attrName => {
      element.removeAttribute(attrName);
    });
  }

  /**
   * Reset element to initial state
   */
  static resetElement(element: Element | null, preserveAttributes: string[] = ['id', 'class']): void {
    if (!element) return;
    
    this.clearElement(element);
    this.clearAttributes(element, preserveAttributes);
  }
}

/**
 * Ref Cleanup Utilities
 */
export class RefCleanupUtils {
  /**
   * Clear React ref
   */
  static clearRef<T>(ref: React.RefObject<T>): void {
    if (ref && 'current' in ref) {
      (ref as React.MutableRefObject<T | null>).current = null;
    }
  }

  /**
   * Clear multiple refs of any type
   */
  static clearRefs(...refs: React.RefObject<any>[]): void {
    refs.forEach(ref => this.clearRef(ref));
  }

  /**
   * Reset ref to initial value
   */
  static resetRef<T>(ref: React.RefObject<T>, initialValue: T): void {
    if (ref && 'current' in ref) {
      (ref as React.MutableRefObject<T>).current = initialValue;
    }
  }
}

/**
 * Timer Cleanup Utilities
 */
export class TimerCleanupUtils {
  private static timers: Set<NodeJS.Timeout> = new Set();

  /**
   * Register a timer for cleanup
   */
  static registerTimer(timer: NodeJS.Timeout): NodeJS.Timeout {
    this.timers.add(timer);
    return timer;
  }

  /**
   * Clear a specific timer
   */
  static clearTimer(timer: NodeJS.Timeout): void {
    clearTimeout(timer);
    this.timers.delete(timer);
  }

  /**
   * Clear all registered timers
   */
  static clearAllTimers(): void {
    this.timers.forEach(timer => clearTimeout(timer));
    this.timers.clear();
  }

  /**
   * Create a timeout that auto-registers for cleanup
   */
  static setTimeout(callback: () => void, delay: number): NodeJS.Timeout {
    const timer = setTimeout(() => {
      callback();
      this.timers.delete(timer);
    }, delay);
    
    return this.registerTimer(timer);
  }

  /**
   * Create an interval that auto-registers for cleanup
   */
  static setInterval(callback: () => void, delay: number): NodeJS.Timeout {
    const timer = setInterval(callback, delay);
    return this.registerTimer(timer);
  }
}

/**
 * Modal-specific cleanup utilities
 */
export class ModalCleanupUtils {
  /**
   * Reset modal state
   */
  static resetModalState(setState: React.Dispatch<React.SetStateAction<any>>, initialState: any): void {
    setState(initialState);
  }

  /**
   * Clear modal refs and DOM elements
   */
  static clearModalRefs(...refs: React.RefObject<any>[]): void {
    RefCleanupUtils.clearRefs(...refs);
  }

  /**
   * Complete modal cleanup
   */
  static cleanupModal(options: {
    refs?: React.RefObject<any>[];
    states?: Array<{
      setter: React.Dispatch<React.SetStateAction<any>>;
      initialValue: any;
    }>;
    cleanupTasks?: string[];
  }): void {
    const { refs = [], states = [], cleanupTasks = [] } = options;
    
    // Clear refs
    RefCleanupUtils.clearRefs(...refs);
    
    // Reset states
    states.forEach(({ setter, initialValue }) => {
      setter(initialValue);
    });
    
    // Execute cleanup tasks
    const cleanupManager = CleanupManager.getInstance();
    cleanupTasks.forEach(taskId => {
      cleanupManager.cleanupTask(taskId);
    });
  }
}

/**
 * Hook for component cleanup
 */
export function useCleanup(componentId: string) {
  const cleanupManager = CleanupManager.getInstance();
  
  const registerCleanup = (taskId: string, cleanup: () => void, priority?: number) => {
    cleanupManager.register({
      id: `${componentId}-${taskId}`,
      cleanup,
      priority
    });
  };

  const unregisterCleanup = (taskId: string) => {
    cleanupManager.unregister(`${componentId}-${taskId}`);
  };

  const cleanupComponent = () => {
    // Find and cleanup all tasks for this component
    const tasks = Array.from(cleanupManager['tasks'].entries())
      .filter(([id]) => id.startsWith(`${componentId}-`));
    
    tasks.forEach(([id]) => {
      cleanupManager.cleanupTask(id);
    });
  };

  return {
    registerCleanup,
    unregisterCleanup,
    cleanupComponent
  };
} 