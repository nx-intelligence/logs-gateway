/**
 * Debug Configuration Loader
 * 
 * Loads logger-debug.json configuration file from project root
 * for runtime log filtering based on identity and application name.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { DebugScopingConfig } from '../types';

let cachedConfig: DebugScopingConfig | null | undefined = undefined;

/**
 * Load logger-debug.json configuration from project root
 * Searches up the directory tree from process.cwd() to find the file
 * 
 * @returns DebugScopingConfig if found and valid, null otherwise
 */
export function loadDebugConfig(): DebugScopingConfig | null {
  // Return cached result if available
  if (cachedConfig !== undefined) {
    return cachedConfig;
  }

  try {
    // Start from process.cwd() and search up for logger-debug.json
    let currentDir = process.cwd();
    const rootPath = path.parse(currentDir).root;
    
    while (currentDir !== rootPath) {
      const configPath = path.join(currentDir, 'logger-debug.json');
      
      if (fs.existsSync(configPath)) {
        try {
          const content = fs.readFileSync(configPath, 'utf8');
          const config = JSON.parse(content) as DebugScopingConfig;
          
          // Validate structure
          if (config && config.scoping) {
            // Validate status
            if (config.scoping.status !== 'enabled' && config.scoping.status !== 'disabled') {
              console.warn('[logs-gateway] Invalid logger-debug.json: scoping.status must be "enabled" or "disabled"');
              cachedConfig = null;
              return null;
            }
            
            // Ensure arrays are arrays
            if (config.scoping.filterIdentities && !Array.isArray(config.scoping.filterIdentities)) {
              console.warn('[logs-gateway] Invalid logger-debug.json: filterIdentities must be an array');
              cachedConfig = null;
              return null;
            }
            
            if (config.scoping.filteredApplications && !Array.isArray(config.scoping.filteredApplications)) {
              console.warn('[logs-gateway] Invalid logger-debug.json: filteredApplications must be an array');
              cachedConfig = null;
              return null;
            }
            
            // Validate between array if present
            if (config.scoping.between !== undefined) {
              if (!Array.isArray(config.scoping.between)) {
                console.warn('[logs-gateway] Invalid logger-debug.json: between must be an array');
                cachedConfig = null;
                return null;
              }
              
              // Validate each between rule
              for (let i = 0; i < config.scoping.between.length; i++) {
                const rule = config.scoping.between[i];
                if (!rule || typeof rule !== 'object') {
                  console.warn(`[logs-gateway] Invalid logger-debug.json: between[${i}] must be an object`);
                  cachedConfig = null;
                  return null;
                }
                
                // Validate action
                if (rule.action !== 'include' && rule.action !== 'exclude') {
                  console.warn(`[logs-gateway] Invalid logger-debug.json: between[${i}].action must be "include" or "exclude"`);
                  cachedConfig = null;
                  return null;
                }
                
                // Validate optional boolean fields
                if (rule.exactMatch !== undefined && typeof rule.exactMatch !== 'boolean') {
                  console.warn(`[logs-gateway] Invalid logger-debug.json: between[${i}].exactMatch must be a boolean`);
                  cachedConfig = null;
                  return null;
                }
                
                if (rule.searchLog !== undefined && typeof rule.searchLog !== 'boolean') {
                  console.warn(`[logs-gateway] Invalid logger-debug.json: between[${i}].searchLog must be a boolean`);
                  cachedConfig = null;
                  return null;
                }
                
                // Validate startIdentities and endIdentities are arrays
                if (!Array.isArray(rule.startIdentities)) {
                  console.warn(`[logs-gateway] Invalid logger-debug.json: between[${i}].startIdentities must be an array`);
                  cachedConfig = null;
                  return null;
                }
                
                if (!Array.isArray(rule.endIdentities)) {
                  console.warn(`[logs-gateway] Invalid logger-debug.json: between[${i}].endIdentities must be an array`);
                  cachedConfig = null;
                  return null;
                }
              }
            }
            
            // Cache and return valid config
            cachedConfig = config;
            return config;
          } else {
            console.warn('[logs-gateway] Invalid logger-debug.json: missing "scoping" field');
            cachedConfig = null;
            return null;
          }
        } catch (parseError) {
          console.warn('[logs-gateway] Failed to parse logger-debug.json:', parseError);
          cachedConfig = null;
          return null;
        }
      }
      
      // Move up one directory
      const parentDir = path.dirname(currentDir);
      if (parentDir === currentDir) {
        // Reached root, stop searching
        break;
      }
      currentDir = parentDir;
    }
    
    // File not found - cache null result
    cachedConfig = null;
    return null;
  } catch (error) {
    // If any error occurs, return null and cache it
    cachedConfig = null;
    return null;
  }
}

/**
 * Reset the cached debug config (useful for testing)
 */
export function resetDebugConfigCache(): void {
  cachedConfig = undefined;
}
