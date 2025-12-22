/**
 * Automatic detection of consuming application's package name and version
 * 
 * This module automatically reads the consuming project's package.json
 * to include app name and version in log entries for better traceability.
 */

import * as fs from 'fs';
import * as path from 'path';

export interface AppInfo {
  name?: string;
  version?: string;
}

let cachedAppInfo: AppInfo | null = null;

/**
 * Automatically detect the consuming application's package name and version
 * by searching up the directory tree for the nearest package.json file
 * that is not in node_modules.
 * 
 * This is cached after first call for performance.
 * 
 * @returns Object with name and version, or empty object if not found
 */
export function detectAppInfo(): AppInfo {
  // Return cached result if available
  if (cachedAppInfo !== null) {
    return cachedAppInfo;
  }

  try {
    // Start from the caller's directory (where logs-gateway is being used)
    // We need to go up from where the module is being called, not from logs-gateway's own directory
    // __dirname in this file will be logs-gateway's dist directory
    // We need to find the consuming project's package.json
    
    // Strategy: Start from process.cwd() (the working directory where the app is running)
    // and search up until we find a package.json that's not in node_modules
    let currentDir = process.cwd();
    const rootPath = path.parse(currentDir).root; // Get root to avoid infinite loop
    
    while (currentDir !== rootPath) {
      const packageJsonPath = path.join(currentDir, 'package.json');
      
      // Check if package.json exists and is not in node_modules
      if (fs.existsSync(packageJsonPath) && !currentDir.includes('node_modules')) {
        try {
          const packageJsonContent = fs.readFileSync(packageJsonPath, 'utf8');
          const packageJson = JSON.parse(packageJsonContent);
          
          // Found a valid package.json - extract name and version
          const appInfo: AppInfo = {};
          if (packageJson.name) {
            appInfo.name = packageJson.name;
          }
          if (packageJson.version) {
            appInfo.version = packageJson.version;
          }
          
          // Cache the result
          cachedAppInfo = appInfo;
          return appInfo;
        } catch (parseError) {
          // Invalid JSON, continue searching
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
    
    // If we reach here, no package.json was found
    // Cache empty result to avoid repeated searches
    cachedAppInfo = {};
    return {};
  } catch (error) {
    // If any error occurs, return empty and cache it
    cachedAppInfo = {};
    return {};
  }
}

/**
 * Reset the cached app info (useful for testing)
 */
export function resetAppInfoCache(): void {
  cachedAppInfo = null;
}

