import fs from 'fs';
import path from 'path';

const BASE_DATA_DIR = process.env.DATA_DIRECTORY || path.resolve(process.cwd(), 'zyrocloud_data');
const SERVERS_DIR = path.join(BASE_DATA_DIR, 'servers');

export function getServerRoot(serverId: string): string {
  const cleanId = serverId.replace(/[^a-zA-Z0-9_-]/g, '');
  if (!cleanId) {
    throw new Error('Invalid server ID specified.');
  }
  const serversBase = path.resolve(SERVERS_DIR);
  const targetRoot = path.resolve(SERVERS_DIR, cleanId);
  if (targetRoot !== serversBase && !targetRoot.startsWith(serversBase + path.sep)) {
    throw new Error('Access Denied: Path traversal detected.');
  }
  return targetRoot;
}

export function getServerDataRoot(serverId: string): string {
  const serverRoot = getServerRoot(serverId);
  const dataDir = path.resolve(serverRoot, 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true, mode: 0o750 });
  }
  return dataDir;
}

export function initServerFilesystem(serverId: string) {
  const root = getServerRoot(serverId);
  // Internal server management directories (NOT exposed to user File Manager)
  const internalDirs = ['data', 'config', 'runtime', 'logs', 'backups', 'tmp'];
  for (const sub of internalDirs) {
    fs.mkdirSync(path.join(root, sub), { recursive: true, mode: 0o750 });
  }

  // User-facing game server data directory contents
  const dataDir = getServerDataRoot(serverId);
  const gameSubdirs = ['world', 'plugins', 'mods', 'logs'];
  for (const sub of gameSubdirs) {
    fs.mkdirSync(path.join(dataDir, sub), { recursive: true, mode: 0o750 });
  }

  // Create default sample server files inside data/ if empty
  const propFile = path.join(dataDir, 'server.properties');
  if (!fs.existsSync(propFile)) {
    fs.writeFileSync(
      propFile,
      `# ZyroCloud Game Server Configuration\nserver-port=25565\nmotd=Welcome to ZyroCloud!\nmax-players=20\npvp=true\ndifficulty=normal\nlevel-name=world\nonline-mode=true\n`,
      'utf-8'
    );
  }

  const eulaFile = path.join(dataDir, 'eula.txt');
  if (!fs.existsSync(eulaFile)) {
    fs.writeFileSync(
      eulaFile,
      `eula=true\n# By changing the setting below to TRUE you are indicating your agreement to our EULA.\n`,
      'utf-8'
    );
  }

  return root;
}

export function initNodeFilesystem(nodeId: string) {
  const cleanId = nodeId.replace(/[^a-zA-Z0-9_-]/g, '');
  if (!cleanId) throw new Error('Invalid node ID specified.');
  const nodeRoot = path.resolve(BASE_DATA_DIR, 'nodes', cleanId);
  const subdirs = ['config', 'runtime', 'logs', 'data', 'cache', 'backups'];
  for (const sub of subdirs) {
    fs.mkdirSync(path.join(nodeRoot, sub), { recursive: true, mode: 0o750 });
  }
  return nodeRoot;
}

export function resolveSafePath(serverId: string, relativePath: string = ''): string {
  initServerFilesystem(serverId);
  const dataRoot = getServerDataRoot(serverId);

  // Normalize and prevent ../ traversal, null bytes, absolute paths
  const cleaned = relativePath.replace(/\0/g, '').replace(/\\/g, '/').replace(/^\/+/, '');
  const safeRelative = path.normalize(cleaned).replace(/^(\.\.[\/\\])+/, '');
  const absoluteTarget = path.resolve(dataRoot, safeRelative);

  const realDataRoot = fs.existsSync(dataRoot) ? fs.realpathSync(dataRoot) : dataRoot;

  if (absoluteTarget !== dataRoot && !absoluteTarget.startsWith(dataRoot + path.sep)) {
    throw new Error('Access Denied: Path traversal detected. Target is outside server data boundary.');
  }

  if (fs.existsSync(absoluteTarget)) {
    const realTarget = fs.realpathSync(absoluteTarget);
    if (realTarget !== realDataRoot && !realTarget.startsWith(realDataRoot + path.sep)) {
      throw new Error('Access Denied: Symlink escape detected.');
    }
  }

  return absoluteTarget;
}

export interface FileItemInfo {
  name: string;
  path: string;
  is_directory: boolean;
  size: number;
  modified_at: string;
  permissions: string;
  extension?: string;
}

export class FileManager {
  static listFiles(serverId: string, relativePath: string = ''): FileItemInfo[] {
    const targetDir = resolveSafePath(serverId, relativePath);
    if (!fs.existsSync(targetDir) || !fs.statSync(targetDir).isDirectory()) {
      throw new Error('Directory not found.');
    }

    const entries = fs.readdirSync(targetDir, { withFileTypes: true });
    const dataRoot = getServerDataRoot(serverId);

    const items: FileItemInfo[] = [];
    for (const ent of entries) {
      try {
        const full = path.join(targetDir, ent.name);
        const st = fs.statSync(full);
        const isDir = ent.isDirectory();
        const ext = isDir ? undefined : path.extname(ent.name).replace('.', '').toLowerCase();
        const rel = path.relative(dataRoot, full).replace(/\\/g, '/');

        items.push({
          name: ent.name,
          path: rel,
          is_directory: isDir,
          size: isDir ? 0 : st.size,
          modified_at: st.mtime.toISOString(),
          permissions: (st.mode & 0o777).toString(8),
          extension: ext
        });
      } catch (err) {
        continue;
      }
    }

    // Directories first, then alphabetical
    items.sort((a, b) => {
      if (a.is_directory !== b.is_directory) {
        return a.is_directory ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });

    return items;
  }

  static readFile(serverId: string, relativePath: string): string {
    const filePath = resolveSafePath(serverId, relativePath);
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      throw new Error('File not found or is a directory.');
    }

    const stat = fs.statSync(filePath);
    if (stat.size > 5 * 1024 * 1024) {
      throw new Error('File is too large for the editor (max 5MB).');
    }

    return fs.readFileSync(filePath, 'utf-8');
  }

  static writeFile(serverId: string, relativePath: string, content: string): boolean {
    const filePath = resolveSafePath(serverId, relativePath);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content, 'utf-8');
    return true;
  }

  static createDirectory(serverId: string, relativePath: string): boolean {
    const dirPath = resolveSafePath(serverId, relativePath);
    if (fs.existsSync(dirPath)) {
      throw new Error('Directory already exists.');
    }
    fs.mkdirSync(dirPath, { recursive: true });
    return true;
  }

  static deleteItem(serverId: string, relativePath: string): boolean {
    const targetPath = resolveSafePath(serverId, relativePath);
    const dataRoot = getServerDataRoot(serverId);
    if (targetPath === dataRoot) {
      throw new Error('Cannot delete server data root.');
    }
    if (!fs.existsSync(targetPath)) {
      throw new Error('Target not found.');
    }
    const stat = fs.statSync(targetPath);
    if (stat.isDirectory()) {
      fs.rmSync(targetPath, { recursive: true, force: true });
    } else {
      fs.unlinkSync(targetPath);
    }
    return true;
  }

  static renameItem(serverId: string, oldRelative: string, newName: string): boolean {
    const src = resolveSafePath(serverId, oldRelative);
    if (!fs.existsSync(src)) {
      throw new Error('Source not found.');
    }
    const cleanName = path.basename(newName.trim());
    const dst = path.join(path.dirname(src), cleanName);
    if (fs.existsSync(dst)) {
      throw new Error('Target name already exists.');
    }
    fs.renameSync(src, dst);
    return true;
  }

  static copyItem(serverId: string, srcRel: string, dstRel: string): boolean {
    const src = resolveSafePath(serverId, srcRel);
    const dst = resolveSafePath(serverId, dstRel);
    if (!fs.existsSync(src)) {
      throw new Error('Source not found.');
    }
    const stat = fs.statSync(src);
    if (stat.isDirectory()) {
      fs.cpSync(src, dst, { recursive: true });
    } else {
      fs.copyFileSync(src, dst);
    }
    return true;
  }

  static uploadFile(serverId: string, relativeDir: string, filename: string, content: string | Buffer): string {
    const cleanName = path.basename(filename.trim());
    if (!cleanName || cleanName === '.' || cleanName === '..') {
      throw new Error('Invalid filename.');
    }
    const targetDir = resolveSafePath(serverId, relativeDir);
    fs.mkdirSync(targetDir, { recursive: true });
    const targetFile = path.join(targetDir, cleanName);
    fs.writeFileSync(targetFile, content);
    const dataRoot = getServerDataRoot(serverId);
    return path.relative(dataRoot, targetFile).replace(/\\/g, '/');
  }
}

