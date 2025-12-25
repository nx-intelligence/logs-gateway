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
    // Determine logs-gateway's own package.json location
    // __dirname in compiled code will be dist/app-info.js, so we go up to find logs-gateway root
    let logsGatewayPackageJsonPath: string | null = null;
    let logsGatewayRootDir: string | null = null;
    
    // Search up from __dirname to find logs-gateway's own package.json
    const rootPath = path.parse(__dirname).root;
    let searchDir = __dirname;
    while (searchDir !== rootPath) {
      const packageJsonPath = path.join(searchDir, 'package.json');
      if (fs.existsSync(packageJsonPath) && !searchDir.includes('node_modules')) {
        try {
          const packageJsonContent = fs.readFileSync(packageJsonPath, 'utf8');
          const packageJson = JSON.parse(packageJsonContent);
          // Check if this is logs-gateway's own package.json
          if (packageJson.name === 'logs-gateway') {
            logsGatewayPackageJsonPath = path.resolve(packageJsonPath);
            logsGatewayRootDir = path.resolve(searchDir);
            break;
          }
        } catch (parseError) {
          // Invalid JSON, continue searching
        }
      }
      const parentDir = path.dirname(searchDir);
      if (parentDir === searchDir) {
        break;
      }
      searchDir = parentDir;
    }
    
    // Strategy: Start from process.cwd() (the working directory where the app is running)
    // and search up until we find a package.json that's not in node_modules
    // If we find logs-gateway's own package.json, check if we're running from within logs-gateway
    // (i.e., logs-gateway IS the app). If so, use it. Otherwise, skip it and continue searching.
    let currentDir = process.cwd();
    const cwdRootPath = path.parse(currentDir).root;
    
    while (currentDir !== cwdRootPath) {
      const packageJsonPath = path.join(currentDir, 'package.json');
      
      // Check if package.json exists and is not in node_modules
      if (fs.existsSync(packageJsonPath) && !currentDir.includes('node_modules')) {
        try {
          const packageJsonContent = fs.readFileSync(packageJsonPath, 'utf8');
          const packageJson = JSON.parse(packageJsonContent);
          const resolvedPackageJsonPath = path.resolve(packageJsonPath);
          
          // If this is logs-gateway's own package.json
          if (packageJson.name === 'logs-gateway') {
            // Check if we're running from within logs-gateway's directory
            // (i.e., logs-gateway IS the app, not a dependency)
            // We check if the current working directory is within logs-gateway's root
            const resolvedCwd = path.resolve(process.cwd());
            const isWithinLogsGateway = logsGatewayRootDir && (
              resolvedCwd === logsGatewayRootDir ||
              resolvedCwd.startsWith(logsGatewayRootDir + path.sep)
            );
            if (isWithinLogsGateway && 
                resolvedPackageJsonPath === logsGatewayPackageJsonPath) {
              // We're running from logs-gateway itself, use its package.json
              const appInfo: AppInfo = {};
              if (packageJson.name) {
                appInfo.name = packageJson.name;
              }
              if (packageJson.version) {
                appInfo.version = packageJson.version;
              }
              cachedAppInfo = appInfo;
              return appInfo;
            } else {
              // This is logs-gateway's package.json but we're using it as a dependency
              // Skip it and continue searching for the consuming app's package.json
              const parentDir = path.dirname(currentDir);
              if (parentDir === currentDir) {
                break;
              }
              currentDir = parentDir;
              continue;
            }
          }
          
          // Found a valid package.json that's not logs-gateway - extract name and version
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

